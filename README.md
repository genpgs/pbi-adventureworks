# powerbi-dev-template

[![Validate](https://github.com/genpgs/powerbi-dev-template/actions/workflows/validate.yml/badge.svg)](https://github.com/genpgs/powerbi-dev-template/actions/workflows/validate.yml)

**Linux-first, agent-agnostic GitHub Template** for AI-assisted Power BI (Standard workspace) development.

Ships with:
- 🗓️ **Fiscal calendar library** — month-aligned + week-based (4-4-5 / 4-5-4 / 5-4-4 / 13-period) Power Query M functions with configurable start date and week-start day
- 🤖 **Antigravity agent skills** — `powerbi-report-cli`, `semantic-model-authoring`, `fabriciq`
- 🔗 **Thin bridges** for GitHub Copilot (`.github/agents/`) and Claude Code (`CLAUDE.md`)
- ✅ **Validation** — Python scripts + pre-commit hook + GitHub Actions CI
- 📦 **Sample PBIP** — `CalendarBaseline` with 4-4-5 calendar, time-intelligence measures, FactSales stub
- 🐳 **Dev Container** — ready for GitHub Codespaces

---

## Quick Start (5 steps)

```bash
# 1. Clone your new repo (after clicking "Use this template" on GitHub)
git clone https://github.com/genpgs/<your-repo>.git && cd <your-repo>

# 2. Run setup (installs uv, pbir-cli, OpenCode, registers the Power BI MCP server, copies .env, optional pre-commit hook)
bash setup.sh

# 3. Edit .env with your workspace and fiscal calendar settings
#    Then update config/fiscal-calendar.json to match

# 4. Run validation
python3 scripts/validate_repo.py && python3 scripts/validate_date_table.py && python3 scripts/validate_m_expressions.py

# 5. Open the sample PBIP in Power BI Desktop (Windows) to render and refresh
#    samples/pbip-calendar-baseline/CalendarBaseline.pbip
```

→ Full walkthrough: **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## Fiscal Calendar Patterns

| Pattern | Weeks/quarter | Periods/year | Use case |
|---------|--------------|--------------|----------|
| `standard` | varies | 12 (months) | General business, month-aligned |
| `445` | 4+4+5 | 12 | US retail, CPG |
| `454` | 4+5+4 | 12 | Retail variant |
| `544` | 5+4+4 | 12 | Retail variant |
| `13period` | 4 | 13 | Hospitality, period-based reporting |

Set `pattern` in [`config/fiscal-calendar.json`](config/fiscal-calendar.json) and update the Calendar partition in the PBIP.

See **[docs/fiscal-calendar.md](docs/fiscal-calendar.md)** for full pattern docs and M function usage.

---

## Agent Harness Support

| Harness | Config location | Status |
|---------|----------------|--------|
| **Antigravity** | `.agents/skills/` | ✅ Canonical |
| **GitHub Copilot** | `.github/agents/` + `.github/instructions/` | ✅ Bridge stubs |
| **Claude Code** | `CLAUDE.md` | ✅ Bridge |
| **OpenCode** | `opencode.json` + `.opencode/commands/` | ✅ Bridge + commands |

### OpenCode

`setup.sh` (and the dev container, for Codespaces) installs the OpenCode CLI and
registers the `powerbi` modeling MCP server globally. Both steps are idempotent —
re-running setup will not duplicate the registration or overwrite a pinned version.

In Codespaces the dev container also installs the **OpenCode V2** VS Code extension
(`sst-dev.opencode-v2`) for the in-editor chat panel. The extension needs the
`opencode` CLI on `PATH`, which `postCreateCommand` installs.

In this repo, two project commands wrap the MCP authoring loop:

| Command | What it does |
|---------|--------------|
| `/pbi-sync` | Exports the MCP server's in-memory model to the `.tmdl` files, then reviews the `git diff`. |
| `/pbi-commit` | Runs all three validators, then commits only if every one passes. |

> Model edits live in the MCP server's memory. Nothing reaches the `.tmdl` files
> until `database_operations` → `ExportToTmdlFolder` runs — which is what `/pbi-sync` does.

---

## Repo Layout

```
powerbi-dev-template/
├── .agents/skills/          # Antigravity skills (canonical)
│   ├── powerbi-report-cli/
│   ├── semantic-model-authoring/
│   └── fabriciq/
├── .github/agents/          # Copilot bridge stubs
├── .github/instructions/    # Copilot development instructions
├── .github/workflows/       # CI (validate.yml)
├── .devcontainer/           # Codespaces / VS Code Remote
├── CLAUDE.md                # Claude Code bridge
├── config/fiscal-calendar.json
├── power-query/
│   ├── fnCalendar.m         # Month-aligned calendar
│   ├── fnCalendarWeekBased.m# 4-4-5 / 454 / 544 / 13-period
│   └── fnFiscalCalendarConfig.m
├── samples/pbip-calendar-baseline/  # Working PBIP sample
├── dax/queries/validate-calendar.dax
├── scripts/                 # Validation + report theming scripts
│   ├── setup_opencode.sh    # OpenCode install + MCP registration (idempotent)
│   ├── validate_report.py   # PBIR canvas layout: overlap + out-of-bounds
│   ├── apply_report_theme.js# Idempotent report restyle pipeline
│   └── build_*/relayout_*.js# Individual theming steps (see apply_report_theme)
├── hooks/pre-commit         # Git pre-commit hook
├── mcp/mcp.json.example     # powerbi-modeling-mcp config stub (+ OpenCode variant)
├── .opencode/commands/      # /pbi-sync and /pbi-commit
├── docs/                    # GETTING_STARTED.md, fiscal-calendar.md
├── .env.example
└── setup.sh
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10+ | <https://python.org> |
| Node.js | 18+ | <https://nodejs.org> |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| git | 2.30+ | package manager |
| OpenCode | latest | auto-installed by `setup.sh`, or <https://opencode.ai> |
| Power BI Desktop | latest | Windows only — for rendering & publish |

---

## License

MIT
