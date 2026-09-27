# Power BI Template — Linux Workflow Gaps & Pull Request Log

> **Context**: This document logs all workflow breakages, Linux-specific limitations, and recommended pull requests discovered while testing [`genpgs/powerbi-dev-template`](https://github.com/genpgs/powerbi-dev-template) on a headless Linux environment using the Microsoft AdventureWorks Sales sample dataset.

---

## 1. Executive Summary

The `powerbi-dev-template` repository aims to provide a **"Linux-first, agent-agnostic GitHub Template for AI-assisted Power BI development"**. 

During real-world end-to-end testing on Linux (Ubuntu / x86_64, Python 3.13, Node.js 20), we created a full project (`AdventureWorksSales.pbip` containing `AdventureWorksSales.SemanticModel` and `AdventureWorksSales.Report`), built an interactive HTML prototype (`report-prototype.html`), authored 6 TMDL tables, 11 DAX measures, 5 relationships, and 11 PBIR visuals across 2 report pages.

We identified **9 concrete breakages / gaps** that affect developers and automated agent harnesses running on Linux:

| Gap ID | Component | Severity | Description | Status & Fix |
|---|---|---|---|---|
| **GAP-01** | `powerbi-modeling-mcp` | **Blocker** | MCP server blocks all execution until human user accepts EULA (`accept_eula`). In headless agent runs, this causes immediate failure unless documented and automated. | **Documented & Fixed**: Add `accept_eula` docs & `PBI_MODELING_MCP_ACCEPT_EULA=true` flag. |
| **GAP-02** | `setup.sh` / `pbir-cli` | **Critical** | `pbir-cli` on PyPI **only publishes wheels for Windows and macOS ARM64** (`macosx_11_0_arm64`, `win_amd64`). There is no Linux wheel and no source distribution (`sdist`). `setup.sh` fails on Linux. | **Fixed in Repo**: Added Python PBIR validator fallback; patched `setup.sh` to guard platform. |
| **GAP-03** | Baseline TMDL Sample | **Critical** | `CalendarBaseline.SemanticModel/definition/expressions.tmdl` contains standalone C-style `//` comments at root level. Official Microsoft TMDL parsers fail with `InvalidLineType: Unexpected line type: Other!`. | **Fixed in Repo**: Removed top-level `//` comments in `expressions.tmdl` (TMDL allows `///` for descriptions or comments only inside indented M blocks). |
| **GAP-04** | `scripts/validate_repo.py` | **Medium** | Fails with `[FAIL] .env file found` if `.env` exists on disk (`check(not Path(".env").exists())`), directly contradicting `setup.sh` which copies `.env.example` -> `.env`. | **Fixed in Repo**: Changed check to verify `.env` is not tracked in git (`git ls-files .env`). |
| **GAP-05** | Validation Scope | **Medium** | `validate_repo.py`, `validate_date_table.py`, and `validate_pbir.sh` hardcode `samples/pbip-calendar-baseline/` instead of validating any `.pbip` project in the workspace. | **Fixed in Repo**: Scans all `*.pbip` projects across the repo dynamically. |
| **GAP-06** | Headless Linux Lifecycle | **Architecture** | Linux cannot execute Power BI Desktop GUI or refresh local M partitions into VertiPaq memory offline. | **Documented**: Clarified the code-first authoring vs rendering/refresh boundary. |
| **GAP-07** | `expressions.tmdl` M bodies | **Critical** | TMDL stores `expression` bodies as opaque strings, so a syntactically invalid M body (e.g. a trailing `;` on the `in` expression) passes TMDL import and every Python schema validator, then blocks the project in Power BI Desktop. | **Fixed in Repo**: Added `scripts/validate_m_expressions.py` to the pre-commit validation set. |
| **GAP-08** | `File.Contents` in partitions | **Critical** | `File.Contents("data/X.xlsx")` resolves relative to the M engine's current directory, not the PBIP root, so local partitions fail to refresh no matter where the project folder lives. | **Fixed in Repo**: Use a `BasePath` parameter and concatenate (`BasePath & "data/X.xlsx"`); enforced by `validate_m_expressions.py`. |
| **GAP-09** | Hand-authored `report.json` / `.pbip` | **Medium** | Desktop silently drops hand-authored properties it does not recognise (e.g. root-level `layoutOptimization`) and rewrites others, so a generator cannot assume its output survives a Desktop round-trip. | **Documented**: Treat Desktop's output as canonical; see §4. |

---

## 2. Detailed Technical Breakdown

### GAP-01: `powerbi-modeling-mcp` EULA Consent Requirement

- **Symptom**: Calling any tool on `powerbi-modeling-mcp` (e.g. `connection_operations`) returns:
  ```json
  {
    "message": "The Power BI Authoring MCP EULA must be accepted before using this tool. Review https://go.microsoft.com/fwlink/?LinkId=2381247, then call the accept_eula tool, pass --accept-eula (or --accepteula), or set PBI_MODELING_MCP_ACCEPT_EULA=true.",
    "operation": "connection_operations"
  }
  ```
- **Root Cause**: Microsoft's Power BI Authoring MCP requires legal EULA acknowledgement before tools become available. The MCP server checks an in-memory flag or environment variable.
- **Impact**: Autonomous agents or CI/CD pipelines fail at step 1 because `accept_eula` cannot be called speculatively without user approval.
- **Recommended Template PR**:
  1. In `mcp/mcp.json.example`, add the environment variable option:
     ```json
     "env": {
       "PBI_MODELING_MCP_ACCEPT_EULA": "true"
     }
     ```
  2. In `docs/GETTING_STARTED.md`, add a dedicated "EULA Acceptance" note explaining how to accept it via the CLI flag or MCP environment variable.

---

### GAP-02: `pbir-cli` Missing Linux Wheels on PyPI

- **Symptom**: Running `setup.sh` (or `uv tool install pbir-cli`) on Linux fails:
  ```
  error: No solution found when resolving dependencies
    cause: Because all of:
               pbir-cli<=0.9.21
               pbir-cli>=0.9.23
            have no wheels with a matching platform tag (e.g., manylinux_2_41_x86_64)
  hint: Wheels are available for `pbir-cli` (v0.9.32) on the following platforms: `macosx_11_0_arm64`, `win_amd64`
  ```
  And attempting to build from source (`--no-binary :all:`) fails with:
  ```
  error: Because all versions of pbir-cli have no source distribution and you require pbir-cli, we can conclude that your requirements are unsatisfiable.
  ```
- **Root Cause**: Upstream `pbir-cli` (closed-source binary distribution on PyPI) only distributes wheels for Windows AMD64 and macOS ARM64. It does not provide Linux x86_64 wheels or source distributions.
- **Impact**: Any Linux developer running `setup.sh` sees an installation error, and `validate_pbir.sh` unconditionally skips validation with `[SKIP] powerbi-report-author not installed`.
- **Recommended Template PR**:
  1. Patch `setup.sh`:
     ```bash
     if [[ "$(uname -s)" == "Linux" ]]; then
         echo "[WARN] pbir-cli currently only distributes wheels for Windows and macOS."
         echo "       Using native Python PBIR validator on Linux."
     else
         uv tool install pbir-cli || true
     fi
     ```
  2. Provide `scripts/validate_pbir_schema.py` (a pure Python JSON schema and structural validator for `*.Report/definition/` files) so Linux users and Linux GitHub Actions runners can validate PBIR syntax.
  3. Update `scripts/validate_pbir.sh` to fall back to `python3 scripts/validate_pbir_schema.py` when `powerbi-report-author` is not in `$PATH`.

---

### GAP-03: Invalid Comments in `expressions.tmdl`

- **Symptom**: When connecting `powerbi-modeling-mcp` to `CalendarBaseline.SemanticModel` or importing via Microsoft Tabular Model Definition Language (TMDL) parser:
  ```
  Failed to import TMDL folder: TMDL Format Error:
  	Parsing error type - InvalidLineType
  	Detailed error - Unexpected line type: Other!
  	Document - './expressions'
  	Line Number - 1
  	Line - '// expressions.tmdl — named M expressions for CalendarBaseline'
  ```
- **Root Cause**: In TMDL syntax specification:
  - Top-level declarations must be keywords like `database`, `model`, `table`, `column`, `measure`, `partition`, `expression`, or descriptions starting with `///`.
  - Double slash `//` comments are **only valid inside indented M code blocks** (e.g. under `source = let ...`).
  - Standalone `//` comments at column 0 in `expressions.tmdl` are invalid TMDL syntax and reject the entire model.
- **Impact**: The template's default sample (`CalendarBaseline`) cannot be loaded by `powerbi-modeling-mcp` or Tabular Editor!
- **Recommended Template PR**:
  Remove lines 1-4 from `samples/pbip-calendar-baseline/CalendarBaseline.SemanticModel/definition/expressions.tmdl` or prefix descriptions with `///`.

---

### GAP-04: `validate_repo.py` Incompatible with Local `.env`

- **Symptom**:
  1. Step 3 of `docs/GETTING_STARTED.md` instructs the user to configure `.env`.
  2. `setup.sh` automatically creates `.env` by running `cp .env.example .env`.
  3. Step 4 runs `python3 scripts/validate_repo.py`.
  4. Script fails with:
     ```
     [FAIL] .env file found — it must not be committed (add to .gitignore)
     ```
- **Root Cause**: `validate_repo.py` used:
  ```python
  check(not Path(".env").exists(), "[PASS] .env not committed", "[FAIL] .env file found")
  ```
  This checks whether the file exists on the developer's local filesystem, not whether it is tracked or committed in Git.
- **Impact**: Following the template's official Getting Started walkthrough immediately fails repo validation.
- **Recommended Template PR**:
  Check Git tracking instead of disk existence:
  ```python
  import subprocess
  is_tracked = subprocess.run(["git", "ls-files", "--error-unmatch", ".env"], capture_output=True).returncode == 0
  check(not is_tracked, "[PASS] .env not committed or tracked in git", "[FAIL] .env is tracked in git repository")
  ```

---

### GAP-05: Validation Scripts Hardcode `samples/` Directory

- **Symptom**:
  - `scripts/validate_repo.py` only scanned `samples/*.pbip`.
  - `scripts/validate_date_table.py` only checked `samples/pbip-calendar-baseline/`.
  - `scripts/validate_pbir.sh` only checked `samples/`.
  When a developer creates their actual project (e.g. `AdventureWorksSales.pbip` at the repo root or in `src/`), the validation scripts completely ignore it.
- **Root Cause**: Hardcoded path `Path("samples")` instead of searching the repository.
- **Recommended Template PR**:
  Update all validation scripts to search `Path(".").rglob("*.pbip")` (excluding `.git`), or accept an optional path argument:
  `python3 scripts/validate_date_table.py [optional_path]`

---

### GAP-06: Headless Linux Development Model & Boundaries

- **Reality of Power BI on Linux**:
  - **What works 100% natively on Linux**:
    - Full TMDL authoring (tables, columns, data categories, DAX measures, partitions, relationships).
    - Full PBIR authoring (report definitions, canvas pages, visual containers, layout grids, formatting).
    - Power Query M code writing and fiscal calendar generation (`fnCalendarWeekBased.m`).
    - Offline semantic model inspection & validation via `powerbi-modeling-mcp` (in memory).
    - Interactive HTML dashboard prototyping (Generative UI) to validate layouts, colors, and metrics before code generation.
    - Automated repo and schema validation in Python / Bash.
  - **What requires Windows + Power BI Desktop or Fabric Service**:
    - Executing local Power Query M queries against local files (`Excel.Workbook(File.Contents(...))`) to populate VertiPaq column data in cache.
    - Native visual rendering / screenshot capture via Power BI Desktop engine.
    - Direct `.pbip` desktop GUI interactivity.
- **Recommended Template PR**:
  Add an architecture section to `README.md` clarifying this distinction so developers understand that Linux is the **code-first authoring, scripting, and CI/CD plane**, while Desktop/Fabric is the **data refresh and rendering plane**.

### GAP-07: Malformed M in `expressions.tmdl` Passes Every Structural Validator

- **Symptom**: A hand-authored or generated PBIP imports cleanly through the TMDL folder
  importer and through `validate_repo.py` / `validate_date_table.py` / `validate_pbir_schema.py`,
  but Power BI Desktop fails to open it with:

  ```
  Syntax error in expression 'fnCalendar'. Token Identifier expected.
  Start position: (31, 1). End position (31, 2).
  Microsoft.Mashup.Host.Document
  ```

- **Root Cause**: A TMDL `expression <name> =` block stores its M body as an **opaque literal
  string**. The TMDL parser never compiles the M, so a syntactically invalid M body is
  invisible to TMDL-level tooling. The Mashup host is the first component that actually
  parses it, and that happens only when Desktop opens the project. In this case the body
  ended with `in Result;` — **TMDL does not use `;` as a statement terminator**, so the M
  parser treated `;` as the start of a new expression and then required a token identifier
  at the next position. The reported start position is the line *after* the offending
  line, which is why the error appears to point at innocent whitespace.
- **Recommended Template PR** (applied in this repo):
  Add `scripts/validate_m_expressions.py`, a dependency-free structural checker for M bodies
  that the TMDL parser does not cover: BOM/UTF-8 hygiene, bracket balance with proper
  string and `//` / `/* */` comment tracking, unterminated literals, and the terminating
  `in` expression shape (including the trailing-`;` defect above). Wire it into the
  documented pre-commit validation set so a headless Linux or CI runner catches the error
  before Desktop does.

**Rule of thumb**: if Desktop reports an M syntax error but a TMDL import succeeds, the
defect is inside the M body — not in the TMDL structure. Diff the expression against a
Desktop-generated reference rather than re-checking TMDL indentation.

---

### GAP-08: `File.Contents` Relative Paths Do Not Resolve Against the PBIP Root

- **Symptom**: A generated partition authored as
  ```m
  Source = Excel.Workbook(File.Contents("data/AdventureWorks Sales.xlsx"), null, true),
  ```
  opens in Power BI Desktop but fails on refresh, or reports that the file cannot be found,
  because the import path effectively started at `data/`.
- **Root Cause**: `File.Contents` resolves a relative path against the **M engine's current
  working directory**, not against the `.pbip` project root. In Desktop that directory is
  managed internally, so a path that "looks" project-relative is not.
- **Fix**: Declare a Power Query **parameter** holding the absolute folder path, and
  concatenate it. In TMDL this is a named expression in `expressions.tmdl`:
  ```tmdl
  expression BasePath = "E:\01-Projects\PBI-Automation\PBI-Adventureworks\" meta [IsParameterQuery=true, Type="Any", IsParameterQueryRequired=true]
      lineageTag: f4622c3a-d94b-4a8f-b485-aba488849cac
  ```
  and each partition then reads:
  ```m
  Source = Excel.Workbook(File.Contents(BasePath & "data/AdventureWorks Sales.xlsx"), null, true),
  ```
- **Portable variant**: the `IsParameterQuery=true` marker is what makes Desktop show
  `BasePath` as an editable parameter in the Queries pane, so the value can be repointed
  per machine without editing TMDL. For a repo meant to be cloned across machines,
  author the parameter with an empty or placeholder value and let each developer set it
  once in Desktop — a hardcoded absolute path will not survive a move, and it is a
  non-issue for the Linux-authors / Windows-refreshes split (see GAP-06) as long as
  the Windows refresh machine sets it.
- **Note**: `Calendar.tmdl` needs no `BasePath` because its partition is generated by
  `fnCalendarWeekBased` and reads no file.
- **Enforcement**: `scripts/validate_m_expressions.py` scans every partition's `source =` block
  and fails on a bare relative `File.Contents` path, so this class of bug is caught headlessly.
  Absolute paths and paths appearing inside `//` comments are correctly ignored.

---

### GAP-09: Desktop Silently Normalises and Drops Unrecognised JSON Properties

- **Symptom**: A hand-authored `report.json` opens fine, but after one open-and-save in
  Power BI Desktop a property is simply gone. Specifically, a root-level
  `"layoutOptimization": "Canvas"` was **removed** on save, and Desktop added
  `"settings": { "useEnhancedTooltips": false }` in its place.
- **Root Cause**: Desktop rewrites the PBIR definition files to its own canonical form on
  save. Properties it does not recognise for the current schema version are discarded
  without a warning, and defaults it considers implicit are written out explicitly.
- **Fix / convention**: **treat a Desktop-saved project as the canonical form.** When a
  generator emits PBIR, generate the properties Desktop itself would emit, and verify by
  round-tripping once through Desktop. Do not hand-add speculative root-level properties
  to `report.json`; a property that Desktop drops was never being honoured anyway.
- **Consequence for version strings**: Desktop also *bumped* schema versions it owns
  (`visualContainer` `2.9.0` -> `2.12.0`, `pagesMetadata` `1.0.0` -> `1.1.0`) and pinned
  `activePageName` to the page the user was last viewing. These are expected writes, not
  defects.

---

## 4. Desktop Alignment Reference (verified)

`AdventureWorksSales.pbip` was opened and saved in Power BI Desktop. The resulting files
were diffed against the Desktop-authored `CEO-Dashboard.pbip` reference, and the
project-specific definitions are now byte-consistent with Desktop conventions.

| File | Desktop's canonical form | Notes |
|---|---|---|
| `<Name>.pbip` | `$schema` + `version` + `artifacts[].report.path` + `settings.enableAutoRecovery` | Desktop **removed the `semanticModel` artifact entry**; a thick PBIP does not need it, because `definition.pbir` already points at the model via `byPath`. |
| `definition.pbir` | `$schema` `.../report/definitionProperties/2.0.0/...` + `version: "4.0"` + `datasetReference.byPath` | `$schema` was added by Desktop. |
| `definition.pbism` | `$schema` `.../semanticModel/definitionProperties/1.0.0/...` + `version: "4.2"` | `version` went from `1.0` -> `4.2`; Desktop also added `settings: {}`. |
| `definition/database.tmdl` | bare `database` with `compatibilityLevel: 1702` | Desktop **dropped the model name** (`database AdventureWorksSales` -> `database`). The compatibility level is retained. |
| `definition/model.tmdl` | adds `sourceQueryCulture`, `dataAccessOptions` (`legacyRedirects`, `returnErrorValuesAsNull`), `annotation PBI_QueryOrder`, `annotation PBI_ProTooling = ["DevMode"]` | Desktop-generated annotations; `PBI_ProTooling` marks the model as developer-mode. |
| `definition/report.json` | `report/3.3.0` + `themeCollection` + `resourcePackages` + `settings` | Desktop **kept** `themeCollection` and `resourcePackages` exactly as authored (so the theme wiring is correct) and **dropped** `layoutOptimization` (GAP-09). |
| `pages/pages.json` | `pagesMetadata/1.1.0` | `activePageName` reflects the last-viewed page, not a defect. |
| `visuals/*/visual.json` | `visualContainer/2.12.0`, with `active: true` on each `queryRole` selection | Cosmetic/formatting normalisation only. |
| `StaticResources/SharedResources/BaseThemes/*.json` | pretty-printed with one colour per line | Desktop reformatted the theme file. Colours unchanged. |
| `tables/*.tmdl` | adds `annotation PBI_NavigationStepName` and `annotation PBI_ResultType = Table` | Standard Desktop partition annotations. |

Both new problems from this round — the `BasePath` parameter (GAP-08) and the
`layoutOptimization` drop (GAP-09) — are now covered by validators and documentation
respectively.

---

## 5. Pull Request Package Ready for Submission

We have prepared the exact code patches:

### PR 1: `fix(tmdl): remove invalid root-level comments from expressions.tmdl`
- **Files**: `samples/pbip-calendar-baseline/CalendarBaseline.SemanticModel/definition/expressions.tmdl`
- **Diff**:
  ```diff
  - // expressions.tmdl — named M expressions for CalendarBaseline
  - // Both fnCalendar (month-aligned) and fnCalendarWeekBased (week-anchored) are
  - // declared here so either can be referenced from the Calendar partition.
  - // Switch the Calendar partition source to the function that matches your pattern.
  - 
   expression fnCalendar =
  ```

### PR 2: `fix(validation): fix .env git-tracking check and support root PBIP projects`
- **Files**: `scripts/validate_repo.py`
- **Diff**:
  ```diff
  - check(
  -     not Path(".env").exists(),
  -     "[PASS] .env not committed",
  -     "[FAIL] .env file found — it must not be committed (add to .gitignore)",
  - )
  + import subprocess
  + is_tracked = subprocess.run(["git", "ls-files", "--error-unmatch", ".env"], capture_output=True).returncode == 0
  + check(
  +     not is_tracked,
  +     "[PASS] .env not committed or tracked in git",
  +     "[FAIL] .env file is tracked by git — remove it: git rm --cached .env",
  + )

  - for pbip in Path("samples").rglob("*.pbip"):
  + for pbip in Path(".").rglob("*.pbip"):
  +     if ".git" in str(pbip):
  +         continue
  ```

### PR 3: `feat(pbir): add Python PBIR schema validator fallback for Linux`
- **Files**: `scripts/validate_pbir_schema.py` (new), `scripts/validate_pbir.sh` (updated)
- **Feature**: Provides cross-platform JSON validation of `report.json`, `pages.json`, `page.json`, and `visual.json` containers when `pbir-cli` is unavailable.

### PR 4: `docs(mcp): document accept_eula requirement and headless env variable`
- **Files**: `mcp/mcp.json.example`, `docs/GETTING_STARTED.md`
- **Feature**: Documents `PBI_MODELING_MCP_ACCEPT_EULA=true` and `accept_eula` tool usage.
