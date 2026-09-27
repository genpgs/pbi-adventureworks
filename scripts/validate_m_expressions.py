#!/usr/bin/env python3
"""Structural validator for M expression bodies embedded in TMDL.

The TMDL parser stores `expression` bodies as opaque strings, so a malformed M
body survives a TMDL folder import and only fails later when the Mashup host
parses the document (as Power BI Desktop does on open). This script checks what
the TMDL parser does not: delimiter balance, string/comment state, the shape of
the terminating `in` expression, and file encoding hygiene.

Usage: python3 scripts/validate_m_expressions.py [path-to-.SemanticModel ...]
"""

import sys
from pathlib import Path

EXIT_OK, EXIT_FAIL = 0, 2
PAIRS = {"(": ")", "[": "]", "{": "}"}


def extract_expressions(text):
    """Return [(name, body_lines)] for each `expression <name> =` block."""
    exprs, current, body = [], None, []

    for line in text.splitlines():
        if line.startswith("expression ") and line.rstrip().endswith("="):
            if current is not None:
                exprs.append((current, body))
            current = line[len("expression "):].rstrip()[:-1].strip()
            body = []
        elif current is not None:
            # A new top-level declaration (no leading indent) ends the body.
            if line and not line[0].isspace():
                exprs.append((current, body))
                current, body = None, []
            else:
                body.append(line)

    if current is not None:
        exprs.append((current, body))
    return exprs


def check_delimiters(name, body):
    """Walk the M body tracking string/comment state; return a list of errors."""
    errors = []
    stack, i, n = [], 0, len(body)
    line_no = 1
    in_str = in_line_comment = in_block_comment = False

    while i < n:
        ch = body[i]
        nxt = body[i + 1] if i + 1 < n else ""

        if ch == "\n":
            line_no += 1
            in_line_comment = False
            i += 1
            continue

        if in_line_comment:
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_str:
            if ch == '"':
                if nxt == '"':  # escaped quote inside a verbatim string
                    i += 2
                    continue
                in_str = False
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if ch == '"':
            in_str = True
            i += 1
            continue
        if ch in PAIRS:
            stack.append((ch, line_no))
            i += 1
            continue
        if ch in PAIRS.values():
            if not stack:
                errors.append(f"{name}: line {line_no}: unmatched closing '{ch}'")
            else:
                open_ch, open_line = stack.pop()
                if PAIRS[open_ch] != ch:
                    errors.append(
                        f"{name}: line {line_no}: '{ch}' closes '{open_ch}' "
                        f"opened at line {open_line}"
                    )
            i += 1
            continue
        i += 1

    if in_str:
        errors.append(f"{name}: unterminated string literal at end of body")
    if in_block_comment:
        errors.append(f"{name}: unterminated /* */ comment at end of body")
    for open_ch, open_line in stack:
        errors.append(f"{name}: unclosed '{open_ch}' opened at line {open_line}")

    return errors


def check_body_shape(name, body):
    """Catch the TMDL gotcha: a semicolon on the terminating `in` expression."""
    errors = []
    meaningful = [ln for ln in body if ln.strip() and not ln.strip().startswith("//")]

    for idx, line in enumerate(body):
        stripped = line.strip()
        if (stripped.startswith("in ") or stripped == "in") and stripped.endswith(";"):
            errors.append(
                f"{name}: line {idx + 1}: trailing ';' after '{stripped}' - "
                f"TMDL does not use ';' as a statement terminator; the M parser "
                f"then demands a token identifier at the next position"
            )

    if meaningful and not any(
        ln.strip().startswith("in ") or ln.strip() == "in" for ln in meaningful
    ):
        errors.append(f"{name}: body has no terminating 'in' expression")

    return errors


def resolve_tmdl(target):
    if target.is_file():
        return target
    for candidate in (target / "definition" / "expressions.tmdl", target / "expressions.tmdl"):
        if candidate.is_file():
            return candidate
    return None


def main(argv):
    if len(argv) > 1:
        targets = [Path(a) for a in argv[1:]]
    else:
        repo = Path(__file__).resolve().parent.parent
        targets = sorted(p for p in repo.rglob("expressions.tmdl") if ".git" not in p.parts)

    if not targets:
        print("[FAIL] No expressions.tmdl found")
        return EXIT_FAIL

    total_errors, checked, skipped = [], 0, 0

    for target in targets:
        tmdl = resolve_tmdl(target)
        if tmdl is None:
            print(f"[SKIP] No expressions.tmdl at {target}")
            skipped += 1
            continue

        print(f"[INFO] {tmdl}")
        raw = tmdl.read_bytes()
        if raw[:3] == b"\xef\xbb\xbf":
            total_errors.append(f"{tmdl}: UTF-8 BOM present - must be UTF-8 without BOM")
            print("[FAIL] UTF-8 BOM detected")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            total_errors.append(f"{tmdl}: not valid UTF-8 ({exc})")
            print("[FAIL] Not valid UTF-8")
            continue

        exprs = extract_expressions(text)
        if not exprs:
            print("[WARN] No 'expression' blocks found")
            continue

        for name, body in exprs:
            checked += 1
            errs = check_delimiters(name, body) + check_body_shape(name, body)
            if errs:
                total_errors.extend(errs)
                print(f"[FAIL] {name}")
                for err in errs:
                    print(f"       {err}")
            else:
                print(f"[PASS] {name} - {len(body)} lines, delimiters balanced, 'in' well formed")

    print()
    if total_errors:
        print(f"[FAIL] {len(total_errors)} problem(s) across {checked} expression(s).")
        return EXIT_FAIL
    print(f"[PASS] All {checked} M expression(s) are structurally valid."
          + (f" ({skipped} target(s) skipped.)" if skipped else ""))
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main(sys.argv))
