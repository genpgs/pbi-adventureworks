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

## Reference Resources

See `.github/instructions/reference-resources.instructions.md` for DAX, M, PBIP, and TMDL reference URLs.
