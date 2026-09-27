# Getting Started with powerbi-dev-template

This guide walks you through cloning the template, configuring your environment, and running your first agent-assisted Power BI development session.

---

## 1. Prerequisites

Install these tools before starting:

| Tool | Min version | Install |
|------|------------|---------|
| **Python** | 3.10 | <https://python.org> or OS package manager |
| **Node.js** | 18 | <https://nodejs.org> |
| **uv** | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| **git** | 2.30 | OS package manager |
| **Power BI Desktop** | latest | Windows only — for rendering and publishing |

> **Linux users**: All authoring (TMDL editing, validation, M functions) runs on Linux. You only need Windows + Power BI Desktop when you want to render visuals or publish to a workspace.

---

## 2. Create your project from the template

1. Go to <https://github.com/genpgs/powerbi-dev-template>
2. Click the green **"Use this template"** button → **"Create a new repository"**
3. Name your repo (e.g., `my-pbi-project`) and choose visibility
4. Click **Create repository**

Then clone it:

```bash
git clone https://github.com/genpgs/my-pbi-project.git
cd my-pbi-project
```

> **Codespaces users**: Click **"Code" → "Create codespace"** — the Dev Container will auto-install everything.

---

## 3. Run setup.sh

```bash
bash setup.sh
```

The script:
- Installs **uv** (if not present)
- Installs **pbir-cli** via uv
- Copies `.env.example` → `.env`
- Optionally installs the pre-commit validation hook

---

## 4. Configure .env

Edit `.env` with your workspace and fiscal calendar settings:

```dotenv
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_WORKSPACE_NAME=My Power BI Workspace
FISCAL_CALENDAR_PATTERN=445
FISCAL_YEAR_START_DATE=2025-02-01
FISCAL_WEEK_START_DAY=Saturday
FISCAL_NUMBER_OF_YEARS=5
```

> `.env` is gitignored — never commit it.

### What else is gitignored, and why

`.gitignore` deliberately excludes four categories of generated or per-machine state. None of
them are definition data, so excluding them keeps diffs limited to real model/report changes.

| Pattern | Why it is excluded |
|---|---|
| `**/.pbi/` | The whole folder is per-user runtime state that Desktop regenerates (`localSettings.json`, `cache.abf`, `editorSettings.json`, pending-query state). It contains machine-specific paths and a large binary cache. |
| `**/diagramLayout.json`, `**/semanticModelDiagramLayout.json` | Diagram positions are Desktop state, not definition. They rewrite on nearly every save, which would bury real changes in diff noise. |
| `.vscode/`, `.idea/` | Editor-specific workspace preferences. |
| `PBIP_STRUCTURE_COMPARISON_REPORT.md` | Regenerable audit output, not a source file. |

> **Note on `.pbi/editorSettings.json`**: the PBIP skill lists it as committable, but this repo
> ignores it along with the rest of `.pbi/`. It is regenerated on demand, so nothing is lost —
> and ignoring the whole tree avoids re-discovering stray files one at a time.

---

## 5. Configure the fiscal calendar

Edit [`config/fiscal-calendar.json`](../config/fiscal-calendar.json) to match your business:

```json
{
  "pattern": "445",
  "fiscalYearStartDate": "2025-02-01",
  "weekStartDay": "Saturday",
  "numberOfYears": 5
}
```

Then update the Calendar partition in the sample PBIP (`CalendarBaseline.SemanticModel/definition/tables/Calendar.tmdl`) to pass the same values to `fnCalendarWeekBased`.

See [`docs/fiscal-calendar.md`](fiscal-calendar.md) for full pattern documentation.

---

## 5b. Point partitions at your data files

A partition that reads a local file must **not** use a bare relative path. `File.Contents`
resolves relative paths against the M engine's working directory rather than the PBIP root, so
a path that looks project-relative fails on refresh. Declare a parameter and concatenate.

In `<Model>.SemanticModel/definition/expressions.tmdl`:

```tmdl
expression BasePath = "E:\01-Projects\PBI-Automation\PBI-Adventureworks\" meta [IsParameterQuery=true, Type="Any", IsParameterQueryRequired=true]
	lineageTag: f4622c3a-d94b-4a8f-b485-aba488849cac
```

Then in each partition's `source =` block:

```m
Source = Excel.Workbook(File.Contents(BasePath & "data/AdventureWorks Sales.xlsx"), null, true),
```

`IsParameterQuery=true` is what makes Desktop expose `BasePath` as an editable parameter in the
Queries pane, so each machine can repoint it without editing TMDL. For a repo cloned across
machines, author a placeholder value and have each developer set it once. This is GAP-08 in
[`LINUX_WORKFLOW_GAPS.md`](LINUX_WORKFLOW_GAPS.md).

---

## 6. Run validation

From the repo root:

```bash
python3 scripts/validate_repo.py          # structure, JSON, required files
python3 scripts/validate_date_table.py    # Calendar TMDL columns for your pattern
python3 scripts/validate_m_expressions.py # M bodies in expressions.tmdl
bash scripts/validate_pbir.sh           # PBIR JSON (requires pbir-cli)
```

All checks should show `[PASS]`.

---

## 7. Open the sample in Power BI Desktop (Windows)

1. Copy the repo to a Windows machine (or use a shared drive/WSL path)
2. Open `samples/pbip-calendar-baseline/CalendarBaseline.pbip`
3. Click **Refresh** — the Calendar partition calls `fnCalendarWeekBased` against FactSales dates
4. Open DAX Studio and run `dax/queries/validate-calendar.dax` — confirm `ValidationPassed = TRUE`
5. Browse `FiscalWeekNumber`, `FiscalPeriodLabel`, `FiscalQuarter` columns to spot-check

---

## 8. Configure the MCP server

The `powerbi-modeling-mcp` MCP server enables Tier 1 semantic model authoring (live model edits, measure creation, etc.).

Copy `mcp/mcp.json.example` to the correct location for your harness:

| Harness | Location |
|---------|----------|
| Antigravity (global) | `~/.config/antigravity/mcp.json` |
| Antigravity (per repo) | `.antigravity/mcp.json` in repo root |
| VS Code / GitHub Copilot | `.vscode/mcp.json` in repo root |
| Claude Code | `~/.claude/mcp.json` |

Then remove the `_comment` and `_locations` keys from the copied file.

---

## 9. Start your first agent session

Open your agent harness (Antigravity, GitHub Copilot, Claude Code) in the repo directory and try these example prompts:

### Semantic model authoring
```
Load .agents/skills/semantic-model-authoring/SKILL.md.
Inspect the CalendarBaseline semantic model and list all measures.
```

### Report planning
```
Load .agents/skills/powerbi-report-cli/SKILL.md.
Plan a Sales Performance report using the CalendarBaseline semantic model.
```

### DAX review
```
Load .agents/skills/semantic-model-authoring/SKILL.md.
Review the 'Total Amount FYTD' measure in Calendar.tmdl for correctness
with a 4-4-5 week-based fiscal calendar.
```

### Switch fiscal pattern
```
Load .agents/skills/semantic-model-authoring/SKILL.md.
Update the Calendar partition to use the 13-period pattern
(13 × 4-week periods, Sunday-anchored, starting 2025-01-05).
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `powerbi-report-author: command not found` | Run `uv tool install pbir-cli` and ensure `~/.local/bin` is on `PATH` |
| `npx: command not found` | Install Node.js 18+ |
| Calendar refresh fails in Desktop | Check that `FactSales[OrderDate]` has valid dates; the partition derives its range from fact data |
| `ValidationPassed = FALSE` in DAX | Check `NoNullWeeks`/`NoNullPeriods` — a null week usually means the date falls outside the generated fiscal years; increase `NumberOfYears` |
| MCP not connecting | Check that `powerbi-modeling-mcp` is in your harness MCP config and that Node.js is on PATH |
