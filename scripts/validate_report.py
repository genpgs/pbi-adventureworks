#!/usr/bin/env python3
"""
validate_report.py — Offline PBIR layout checks that complement
scripts/validate_pbir_schema.py (schema/JSON shape) and
`powerbi-report-author validate` (PBIR contracts).

This script checks CANVAS-LEVEL layout: overlap, out-of-bounds, and off-canvas
positions. Those are the failure modes a scaffolder or an LLM-generated layout
produces, and they are invisible to schema validation — every file is
structurally valid while the page is unusable.

Usage: python3 scripts/validate_report.py [path-to-.Report-dir]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

TOLERANCE = 0  # exact-pixel overlap detection

FAIL = 0
WARN = 0


def fail(msg: str) -> None:
    global FAIL
    FAIL += 1
    print(f"[FAIL] {msg}")


def warn(msg: str) -> None:
    global WARN
    WARN += 1
    print(f"[WARN] {msg}")


def ok(msg: str) -> None:
    print(f"[PASS] {msg}")


def rect(pos: dict) -> tuple[float, float, float, float]:
    return (
        float(pos["x"]),
        float(pos["y"]),
        float(pos["x"]) + float(pos["width"]),
        float(pos["y"]) + float(pos["height"]),
    )


def overlaps(a: tuple, b: tuple) -> bool:
    return not (a[2] <= b[0] + TOLERANCE or b[2] <= a[0] + TOLERANCE
                or a[3] <= b[1] + TOLERANCE or b[3] <= a[1] + TOLERANCE)


def check_page(page_file: Path) -> None:
    page = json.loads(page_file.read_text())
    name = page.get("displayName", page_file.parent.name)
    page_w = float(page.get("width", 1280))
    page_h = float(page.get("height", 720))
    ok(f"Page '{name}': canvas {int(page_w)}x{int(page_h)}")

    visuals_dir = page_file.parent / "visuals"
    if not visuals_dir.is_dir():
        warn(f"Page '{name}': no visuals directory")
        return

    boxes: list[tuple[str, tuple, int]] = []
    for vdir in sorted(visuals_dir.iterdir()):
        vfile = vdir / "visual.json"
        if not vfile.is_file():
            continue
        v = json.loads(vfile.read_text())
        pos = v.get("position")
        if not pos:
            fail(f"Page '{name}': visual '{vdir.name}' has no position block")
            continue
        r = rect(pos)

        # Bounds
        if pos["x"] < 0 or pos["y"] < 0:
            fail(f"Page '{name}': '{vdir.name}' has negative position "
                 f"({pos['x']}, {pos['y']})")
        if r[2] > page_w or r[3] > page_h:
            fail(f"Page '{name}': '{vdir.name}' extends past the canvas "
                 f"(right={r[2]:.0f} bottom={r[3]:.0f}, canvas {int(page_w)}x{int(page_h)})")
        boxes.append((vdir.name, r, int(pos.get("z", 0))))

    # Overlap, skipping pairs that differ in z (deliberate stacking)
    errored = False
    for i, (n1, r1, z1) in enumerate(boxes):
        for n2, r2, z2 in boxes[i + 1:]:
            if z1 == z2:
                continue
            if overlaps(r1, r2):
                fail(f"Page '{name}': '{n1}' (z={z1}) overlaps '{n2}' (z={z2})")
                errored = True

    if not errored:
        ok(f"Page '{name}': {len(boxes)} visuals, layout bounds and overlaps clean")


def main() -> int:
    if len(sys.argv) > 1:
        report_dir = Path(sys.argv[1])
    else:
        candidates = sorted(Path(".").glob("*.Report"))
        if not candidates:
            print("[FAIL] No .Report directory found.")
            return 1
        report_dir = candidates[0]

    if not report_dir.is_dir():
        print(f"[FAIL] Not a directory: {report_dir}")
        return 1

    print(f"Validating PBIR layout for {report_dir}\n")
    pages_dir = report_dir / "definition" / "pages"
    if not pages_dir.is_dir():
        print(f"[FAIL] No pages directory under {report_dir}")
        return 1

    for page_file in sorted(pages_dir.glob("*/page.json")):
        check_page(page_file)

    print()
    if FAIL:
        print(f"[FAIL] {FAIL} layout error(s), {WARN} warning(s).")
        return 1
    print(f"[PASS] PBIR layout validation passed ({WARN} warning(s)).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
