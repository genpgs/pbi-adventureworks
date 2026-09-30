# Power BI Dev Template — Claude Code Instructions

> Load this file automatically on every conversation in this repo.

## Skill Library

All agent skills live in `.agents/skills/`. **Always load the relevant `SKILL.md` before starting any Power BI task.**

| What you want to do | Load this skill |
|---------------------|----------------|
| Plan, design, author, or publish a **report** | `.agents/skills/powerbi-report-cli/SKILL.md` |
| Build or modify a **semantic model** (TMDL, DAX, measures, deploy) | `.agents/skills/semantic-model-authoring/SKILL.md` |
| Answer a **data question** in natural language over an existing report | `.agents/skills/fabriciq/SKILL.md` *(requires FabricIQ MCP endpoint — see mcp/mcp.json.example)* |

Common reference docs referenced by skills: `.agents/common/`

## MCP

The `powerbi-modeling-mcp` MCP server is required for Tier 1 semantic model authoring.
Copy `mcp/mcp.json.example` to `~/.claude/mcp.json` (global) and fill in your Desktop port or workspace URL.

`mcp/mcp.json.example` also carries an `_opencode` block for OpenCode users. Claude Code should ignore that key — OpenCode uses a different schema (servers nested under `mcp.servers`, `"type": "local"`, single `command` array).

## Guardrails

- **Plan before editing any files.** Never work directly on `main`.
- **Never commit `.env`** or any credentials. Use `.env` (gitignored) locally; CI secrets for automation.
- **Never commit generated or per-machine state.** `.pbi/`, `diagramLayout.json`, `.vscode/`, and
  audit reports are gitignored. Only definition files belong in Git.
- **Never invent** schema objects, workspace GUIDs, or measure values.
- **Never hand-add speculative root-level properties to PBIR JSON.** Power BI Desktop rewrites
  `report.json` on save and silently discards properties it does not recognise — a root-level
  `layoutOptimization` is dropped this way. Treat a Desktop-saved project as canonical, and
  verify generated output by round-tripping it through Desktop once.
- **Never use bare relative paths in `File.Contents`.** Declare a `BasePath` parameter
  (`IsParameterQuery=true`) and concatenate — see `docs/GETTING_STARTED.md` §5b.
- **Never publish to production** before the release checklist passes.
- **Linux is the authoring environment.** Power BI Desktop (Windows) is for rendering and publish validation only.
- **Standard workspace only** — no Fabric capacity, no OneLake, no XMLA write assumed.
- **Week-based fiscal calendars** (4-4-5, 454, 544, 13period): do NOT use standard `TOTALYTD`/`DATESYTD` — these require custom DAX against `FiscalYear`/`FiscalWeekNumber`/`FiscalPeriodNumber` columns.

## Validation (run before every commit)

```bash
python3 scripts/validate_repo.py
python3 scripts/validate_date_table.py
python3 scripts/validate_m_expressions.py
bash scripts/validate_pbir.sh
```

### OpenCode automation

OpenCode users get two project commands in `.opencode/commands/`:

| Command | What it does |
|---------|--------------|
| `/pbi-sync` | Exports the MCP server's in-memory model to the `.tmdl` files, then shows and reviews `git diff`. |
| `/pbi-commit` | Runs all three validators above, then commits only if every one passes. |

`/pbi-sync` exists because the MCP server holds model edits in memory. Nothing reaches the `.tmdl` files until `database_operations` → `ExportToTmdlFolder` runs, so committing without it commits nothing.

`/pbi-commit` refuses to run on `main` and blocks on a non-zero validator exit. Do not treat its gates as a substitute for reading the diff.

Note that `hooks/pre-commit` is opt-in (`setup.sh` offers it) and covers only two of the three validators — it omits `validate_pbir.sh`. Do not rely on it as the gate.

## Report Layout & Theming

`AdventureWorksSales.Report` is themed to match `report-prototype.html`. The custom
theme is `StaticResources/RegisteredResources/AdventureWorksClean-a7c3e91b.json`.

Re-apply the layout after changing anything under `definition/pages/`:

```bash
node scripts/apply_report_theme.js
```

The pipeline is idempotent — every step reads the current file state and writes
it back, so re-running is safe. Step order matters: the KPI cards must exist
before the page-1 relayout runs, and the page-1 relayout must run before the
bottom-row positions are set.

Author PBIR changes through `powerbi-report-author`, not by hand-editing JSON:

```bash
powerbi-report-author validate AdventureWorksSales.Report
python3 scripts/validate_report.py AdventureWorksSales.Report
```

`validate_report.py` catches canvas-level defects that schema validation cannot:
overlapping visuals, negative positions, and anything extending past the page
bounds. It runs in the pre-commit hook and in CI.

## Reference Resources

See `.github/instructions/reference-resources.instructions.md` for DAX, M, PBIP, and TMDL reference URLs.
