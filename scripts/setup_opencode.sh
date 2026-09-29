#!/usr/bin/env bash
# scripts/setup_opencode.sh — install OpenCode and register the Power BI modeling MCP server.
#
# Non-interactive and idempotent: safe to run from setup.sh and .devcontainer/setup.sh,
# and safe to re-run without duplicating the MCP registration.
set -euo pipefail

MCP_NAME="powerbi"
MCP_ARGS=(npx -y @microsoft/powerbi-modeling-mcp@latest --start)
MCP_STARTUP_TIMEOUT_MS=180000

# OpenCode honours XDG_CONFIG_HOME; fall back to the documented default.
OPENCODE_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.json"

ok()   { echo "[OK] $*"; }
warn() { echo "[WARN] $*"; }

# ── 1. OpenCode ────────────────────────────────────────────────────────────────
install_opencode() {
    if command -v opencode &>/dev/null; then
        ok "opencode already installed ($(opencode --version 2>/dev/null || echo 'version unknown'))"
        return 0
    fi

    echo "==> Installing OpenCode..."
    # Prefer npm: Node is already a devcontainer feature and a documented prerequisite.
    if command -v npm &>/dev/null; then
        if npm install -g @opencode/cli &>/dev/null 2>&1; then
            # npm's global bin dir is not always on PATH in a fresh container.
            local npm_bin
            npm_bin="$(npm prefix -g 2>/dev/null)/bin"
            case ":$PATH:" in
                *":$npm_bin:"*) ;;
                *) export PATH="$npm_bin:$PATH" ;;
            esac
            if command -v opencode &>/dev/null; then
                ok "opencode installed via npm ($(opencode --version 2>/dev/null || echo 'version unknown'))"
                return 0
            fi
        fi
        warn "npm install of OpenCode failed — falling back to the curl installer."
    fi

    if curl -fsSL https://opencode.ai/v2/install | bash &>/dev/null 2>&1; then
        export PATH="$HOME/.opencode/bin:$PATH"
        if command -v opencode &>/dev/null; then
            ok "opencode installed via curl installer"
            return 0
        fi
    fi

    warn "Could not install OpenCode automatically."
    warn "  Install manually: curl -fsSL https://opencode.ai/v2/install | bash"
    return 1
}

install_opencode || true

if ! command -v opencode &>/dev/null; then
    warn "Skipping MCP registration — OpenCode is not available on PATH."
    warn "The Power BI modeling MCP server must be registered manually; see mcp/mcp.json.example."
    exit 0
fi

# ── 2. Node/npx prerequisite ───────────────────────────────────────────────────
if ! command -v npx &>/dev/null; then
    warn "Node.js / npx not found — the '$MCP_NAME' MCP server will not start."
    warn "  Install Node.js 18+ from https://nodejs.org, then re-run: bash scripts/setup_opencode.sh"
    exit 0
fi
ok "Node $(node --version 2>/dev/null || echo '?') available"

# ── 3. Warm the npx cache ──────────────────────────────────────────────────────
# The first run downloads a .NET binary. Doing it here keeps the MCP server's
# cold start inside the client's startup timeout on first connect.
echo "==> Warming up @microsoft/powerbi-modeling-mcp cache (first run downloads a runtime)..."
npx -y @microsoft/powerbi-modeling-mcp@latest --version &>/dev/null 2>&1 || true

# ── 4. Register the MCP server (only if absent) ────────────────────────────────
mcp_already_registered() {
    [ -f "$OPENCODE_CONFIG" ] || return 1

    # Parse the config; distinguish "parsed, absent" (1) from "unparseable" (2).
    local parse_status=0
    python3 - "$OPENCODE_CONFIG" "$MCP_NAME" <<'PY' || parse_status=$?
import json, sys
try:
    with open(sys.argv[1]) as f:
        cfg = json.load(f)
except Exception:
    sys.exit(2)  # JSONC or hand-edited
servers = (cfg.get("mcp") or {}).get("servers") or {}
sys.exit(0 if sys.argv[2] in servers else 1)
PY

    case "$parse_status" in
        0) return 0 ;;  # server present
        1) return 1 ;;  # parsed cleanly, server genuinely absent
        *)              # unparseable — fall back to a text match
            grep -q "\"$MCP_NAME\"" "$OPENCODE_CONFIG" && return 0
            return 1
            ;;
    esac
}

if mcp_already_registered; then
    ok "MCP server '$MCP_NAME' already registered — leaving it untouched."
else
    if opencode mcp add "$MCP_NAME" --global -- "${MCP_ARGS[@]}" &>/dev/null 2>&1; then
        ok "Registered MCP server '$MCP_NAME' (global, from $OPENCODE_CONFIG)"
    else
        warn "Could not register the MCP server automatically. Run manually:"
        warn "  opencode mcp add $MCP_NAME --global -- ${MCP_ARGS[*]}"
    fi
fi

# ── 5. Raise the MCP startup timeout ──────────────────────────────────────────
# `opencode mcp add` writes a bare server entry. The default 30s startup timeout
# is not enough the first time a container starts the server, so add the timeout
# if it is not already set at or above the target. Additive only — existing keys
# and any other servers in the file are left alone.
python3 - "$OPENCODE_CONFIG" "$MCP_STARTUP_TIMEOUT_MS" &>/dev/null 2>&1 <<'PY' && ok "MCP startup timeout set to ${MCP_STARTUP_TIMEOUT_MS}ms" || true
import json, os, sys

path, target = sys.argv[1], int(sys.argv[2])
if not os.path.exists(path):
    sys.exit(1)

with open(path) as f:
    raw = f.read()
try:
    cfg = json.loads(raw)
except Exception:
    sys.exit(1)  # JSONC or hand-edited — leave it alone rather than clobber comments.

current = ((cfg.get("mcp") or {}).get("timeout") or {}).get("startup")
if isinstance(current, int) and current >= target:
    sys.exit(1)  # already fine

cfg.setdefault("mcp", {}).setdefault("timeout", {})["startup"] = target
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
PY

echo ""
echo "  OpenCode is ready. Useful commands in this repo:"
echo "    /pbi-sync     export the in-memory model to TMDL, then review the diff"
echo "    /pbi-commit   run all validators, then commit if they pass"
echo ""
