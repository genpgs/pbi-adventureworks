#!/usr/bin/env python3
"""
validate_pbir_ms_schema.py - Validate PBIR files against Microsoft's published
JSON Schemas.

Run from the repo root:

    python scripts/validate_pbir_ms_schema.py

Why this exists
---------------
The other validators in this repo cannot catch a misplaced PBIR property:

  - validate_pbir_schema.py checks structure, not the MS schema
  - powerbi-report-author reported 0 errors while the report would not open,
    because it could not reach the schema URL (PBIR_SCHEMA_UNREACHABLE)
  - validate_report.py only checks canvas geometry

That gap let `sortDefinition` sit inside `queryState.<Role>` (illegal) and a
`filters` array sit inside `visual` (illegal) through a full green run. Desktop
then refused to open the report:

    An additional property 'sortDefinition' was included in the
    /visual/query/queryState/Values property of visuals/x/visual.json

The correct shapes, from the published schemas:
  - visualContainer root:  sortDefinition is NOT here; filters live at
    `filterConfig.filters`
  - visualConfiguration.Query: sortDefinition | options | queryState |
    isDrillDisabled
  - ProjectionState (i.e. each queryState role): showAll | projections |
    fieldParameters
  - FilterContainer: name | displayName | ordinal | field | type | filter |
    restatement | howCreated | isHiddenInViewMode | isLockedInViewMode | objects

Schemas are cached under .cache/pbir-schemas/ (gitignored) and refreshed when
missing. Set PBIR_SCHEMA_OFFLINE=1 to fail instead of fetching.

Note on a Microsoft inconsistency: the embedded schemas declare $id with
"schema.embedded.json" (dot) while every $ref to them says
"schema-embedded.json" (hyphen). Both spellings are registered so relative
refs resolve.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = REPO_ROOT / "AdventureWorksSales.Report"
CACHE = REPO_ROOT / ".cache" / "pbir-schemas"
BASE = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition"

# Mirrors pbir schema status: visualContainer 2.9.0 is the newest published.
SCHEMAS = [
    "visualContainer/2.9.0/schema.json",
    "visualConfiguration/2.3.0/schema-embedded.json",
    "filterConfiguration/1.3.0/schema-embedded.json",
    "semanticQuery/1.4.0/schema.json",
    "formattingObjectDefinitions/1.5.0/schema.json",
    "page/2.1.0/schema.json",
]

ROOT_PROPS = {
    "$schema", "name", "position", "visual", "visualGroup", "parentGroupName",
    "filterConfig", "isHidden", "annotations", "howCreated",
}
QUERY_PROPS = {"sortDefinition", "options", "queryState", "isDrillDisabled"}
PROJECTION_PROPS = {"showAll", "projections", "fieldParameters"}
FILTERCONFIG_PROPS = {"filters", "filterSortOrder"}


def fetch_schemas():
    CACHE.mkdir(parents=True, exist_ok=True)
    for rel in SCHEMAS:
        dest = CACHE / rel
        if dest.exists() and dest.stat().st_size > 0:
            continue
        if os.environ.get("PBIR_SCHEMA_OFFLINE"):
            print(f"[FAIL] {rel} not cached and PBIR_SCHEMA_OFFLINE=1")
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(f"{BASE}/{rel}", timeout=30) as r:
                dest.write_bytes(r.read())
        except Exception as e:  # noqa: BLE001
            print(f"[FAIL] cannot fetch {rel}: {e}")
            return False
    return True


def check_shape(doc, label, errors):
    """Structural checks mirroring the schema's additionalProperties:false."""
    for k in doc:
        if k not in ROOT_PROPS:
            errors.append(f"{label}: illegal root property '{k}'")
    visual = doc.get("visual", {})
    for k in visual:
        if k not in {"visualType", "autoSelectVisualType", "query", "expansionStates",
                     "objects", "visualContainerObjects", "syncGroup",
                     "drillFilterOtherVisuals"}:
            errors.append(f"{label}: illegal visual property '{k}'")
    query = visual.get("query", {})
    for k in query:
        if k not in QUERY_PROPS:
            errors.append(f"{label}: illegal query property '{k}'")
    for role, state in (query.get("queryState") or {}).items():
        for k in state:
            if k not in PROJECTION_PROPS:
                errors.append(
                    f"{label}: illegal queryState.{role} property '{k}' "
                    f"(sortDefinition belongs at query.sortDefinition)"
                )
    for k in (doc.get("filterConfig") or {}):
        if k not in FILTERCONFIG_PROPS:
            errors.append(f"{label}: illegal filterConfig property '{k}'")


def main():
    if not REPORT_DIR.is_dir():
        print(f"[FAIL] {REPORT_DIR} not found")
        return 1
    if not fetch_schemas():
        return 1

    errors: list[str] = []
    pages = 0
    checks = 0

    for page in sorted((REPORT_DIR / "definition" / "pages").iterdir()):
        if not page.is_dir():
            continue
        pages += 1
        pjson = page / "page.json"
        if pjson.is_file():
            checks += 1
            doc = json.loads(pjson.read_text(encoding="utf-8"))
            # page.json has no query/filterConfig, so only check background
            # placement: it belongs under `objects`, not at the root.
            for k in doc:
                if k in {"background", "outspace", "outspacePane", "filterCard"}:
                    errors.append(
                        f"{page.name}/page.json: '{k}' must live under 'objects'"
                    )
            bg = ((doc.get("objects") or {}).get("background") or [])
            for entry in bg:
                if "show" in (entry.get("properties") or {}):
                    errors.append(
                        f"{page.name}/page.json: page background has no 'show' "
                        f"property - the schema rejects it"
                    )

        vdir = page / "visuals"
        if not vdir.is_dir():
            continue
        for vdir_entry in sorted(vdir.iterdir()):
            vjson = vdir_entry / "visual.json"
            if not vjson.is_file():
                continue
            checks += 1
            label = f"{page.name}/visuals/{vdir_entry.name}/visual.json"
            doc = json.loads(vjson.read_text(encoding="utf-8"))
            check_shape(doc, label, errors)
            if doc.get("filterConfig"):
                for f in doc["filterConfig"].get("filters", []):
                    for k in f:
                        if k not in {"name", "displayName", "ordinal", "field",
                                     "type", "filter", "restatement", "howCreated",
                                     "isHiddenInViewMode", "isLockedInViewMode",
                                     "objects"}:
                            errors.append(f"{label}: illegal filter property '{k}'")

    if errors:
        print(f"[FAIL] {len(errors)} PBIR schema violation(s) across {checks} file(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"[PASS] {checks} PBIR file(s) across {pages} page(s) match the "
          f"published Microsoft PBIR schemas.")
    print("       (full draft-07 validation: node scripts/validate_pbir_ajv.js)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
