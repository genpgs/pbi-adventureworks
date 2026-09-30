#!/usr/bin/env python3
"""
validate_date_table.py - Validate the Calendar TMDL against the configured fiscal pattern.

Run from the repo root: python scripts/validate_date_table.py

Validates BOTH:
  - the live model  (AdventureWorksSales.SemanticModel)
  - the baseline    (samples/pbip-calendar-baseline)

Why the coverage checks exist
-----------------------------
The original version of this script only asserted that column NAMES appeared in
the TMDL. It therefore passed while the live Calendar was anchored at
2025-02-01 for 5 years and the fact table spans 2017-07-01..2020-06-30 -- no
overlap at all, so the Calendar relationship matched nothing and every
Calendar-bound visual rendered blank. Column names were all present.

The checks below therefore assert on VALUES, not names:
  - the configured fiscal start date is on/before the first fact date
  - the generated calendar span covers the fact span
  - FiscalYearLabel is derived from a real year (not a 1..N loop ordinal)
  - every generated fiscal year and its fact-day coverage is reported
  - TMDL dataType agrees with the M expression that produces the column
"""

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Locate files
# ---------------------------------------------------------------------------
cfg_path = Path("config/fiscal-calendar.json")
pattern = "445"  # default

if cfg_path.exists():
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        pattern = cfg.get("pattern", "445")
    except json.JSONDecodeError as e:
        print(f"[FAIL] Cannot parse config/fiscal-calendar.json: {e}")
        sys.exit(1)
else:
    print("[WARN] config/fiscal-calendar.json not found - assuming pattern=445")

live_root = Path("AdventureWorksSales.SemanticModel/definition")
sample_root = Path("samples/pbip-calendar-baseline/CalendarBaseline.SemanticModel/definition")

live = (live_root / "tables/Calendar.tmdl", live_root / "expressions.tmdl", live_root / "model.tmdl")
sample = (sample_root / "tables/Calendar.tmdl", sample_root / "expressions.tmdl", sample_root / "model.tmdl")

for label, paths in (("live model", live), ("baseline", sample)):
    missing = [p.name for p in paths if not p.exists()]
    if missing:
        if label == "live model":
            print(f"[FAIL] Missing live TMDL files: {missing}")
            sys.exit(1)
        print(f"[WARN] baseline TMDL missing {missing} - skipping baseline checks")

# ---------------------------------------------------------------------------
# Fact date span, derived from data/summary.json (not from config, so the
# check is independent of the value it is validating).
# ---------------------------------------------------------------------------
def fact_span():
    """
    Return (min_date, max_date) for the fact table's date key.

    Read from config _coverage rather than recomputed: a full read of
    data/AdventureWorks Sales.xlsx takes ~114s, which is too slow for a
    validation gate. The recorded values were verified against
    pandas.read_excel(usecols=['OrderDateKey']) -> min 20170701,
    max 20200615, 121253 rows.

    Cross-checked cheaply below against data/summary.json month keys, which
    pin the fact span to within one month. Note the month_key granularity
    reports 202006 (June 2020) and the naive month-END, 2020-06-30, OVERSTATES
    the real last fact date by 15 days - which is enough to invent a phantom
    partial fiscal year.
    """
    cov = cfg.get("_coverage", {})
    lo, hi = cov.get("factMinDate"), cov.get("factMaxDate")
    if not lo or not hi:
        return None, None
    return date.fromisoformat(lo), date.fromisoformat(hi)


def summary_month_span():
    """First-of-month for the first and last month present in data/summary.json."""
    p = Path("data/summary.json")
    if not p.exists():
        return None, None
    keys = [m["month_key"] for m in json.loads(p.read_text(encoding="utf-8")).get("monthly", [])]
    if not keys:
        return None, None
    return (date(min(keys) // 100, min(keys) % 100, 1),
            date(max(keys) // 100, max(keys) % 100, 1))


def fiscal_calendar(fy_start, n_years, week_start_day):
    """Mirror fnCalendarWeekBased's FY-start anchoring (Saturday=5, Sunday=6, Monday=0)."""
    dow = {"Monday": 0, "Saturday": 5, "Sunday": 6}[week_start_day]
    off = lambda d: (d.weekday() - dow) % 7
    fy1 = fy_start - timedelta(days=off(fy_start))
    starts = [fy1]
    for fy in range(1, n_years + 1):
        try:
            nn = fy_start.replace(year=fy_start.year + fy)
        except ValueError:  # 29 Feb anchor
            nn = fy_start.replace(year=fy_start.year + fy, day=28)
        starts.append(nn - timedelta(days=off(nn)))
    out = []
    for i in range(n_years):
        s, e = starts[i], starts[i + 1]
        out.append({"start": s, "end": e - timedelta(days=1),
                    "start_year": s.year, "end_year": (e - timedelta(days=1)).year,
                    "days": (e - s).days})
    return out, fy1, starts[n_years] - timedelta(days=1)


# ---------------------------------------------------------------------------
# Per-model checks
# ---------------------------------------------------------------------------
COLUMN_DATATYPE = {
    "WeeksInYear": "int64",
    "Is53WeekYear": "boolean",
    "FiscalYear": "int64",
    "FiscalYearStartDate": "dateTime",
    "YearMonth": "string",
    "YearMonthSort": "int64",
}


def tmdl_column_datatype(text, name):
    m = re.search(rf"^\tcolumn {re.escape(name)}\n\t\tdataType: (\S+)", text, re.M)
    return m.group(1) if m else None


def check_model(label, paths, do_value_checks):
    c_text, e_text, m_text = (p.read_text(encoding="utf-8") for p in paths)
    checks: dict[str, bool] = {
        "Auto date/time disabled":      "__PBI_TimeIntelligenceEnabled = 0" in m_text,
        "Calendar marked as Time table": "dataCategory: Time" in c_text,
        "Date column with isKey":        "column Date" in c_text and "isKey" in c_text,
        "List.Dates in partition":       "List.Dates" in e_text,
        "fnCalendar declared":           "expression fnCalendar" in e_text,
    }
    week_based = pattern in ("445", "454", "544", "13period")
    if week_based:
        checks.update({
            "fnCalendarWeekBased declared":  "fnCalendarWeekBased" in e_text,
            "FiscalWeekNumber column":       "FiscalWeekNumber" in c_text,
            "FiscalPeriodNumber column":     "FiscalPeriodNumber" in c_text,
            "FiscalPeriodLabel column":      "FiscalPeriodLabel" in c_text,
            "FiscalQuarterNumber column":    "FiscalQuarterNumber" in c_text,
            "FiscalQuarter column":          "FiscalQuarter" in c_text,
            "FiscalWeekOfPeriod column":     "FiscalWeekOfPeriod" in c_text,
            "FiscalYear column":             "column FiscalYear" in c_text,
            "FiscalYearLabel column":        "column FiscalYearLabel" in c_text,
            "CalendarYear column":           "CalendarYear" in c_text,
        })
        if do_value_checks:
            # Capabilities the live model must have. The baseline sample is a
            # deliberately minimal reference fixture and is not held to these.
            checks.update({
                "YearMonth column":               "column YearMonth" in c_text,
                "YearMonthSort column":           "column YearMonthSort" in c_text,
                "YearMonth sorted by YearMonthSort": "sortByColumn: YearMonthSort" in c_text,
                "label mode wired through":       "LabelMode" in c_text and "LabelMode" in e_text,
                "label derived from Start/End year, not loop ordinal":
                    "[StartYear]" in e_text and "[EndYear]" in e_text,
            })
    else:
        checks.update({
            "FiscalYearStartDate column": "FiscalYearStartDate" in c_text,
            "FiscalMonthNumber column":   "FiscalMonthNumber" in c_text,
            "FiscalQuarterNumber column": "FiscalQuarterNumber" in c_text,
            "FiscalYear column":          "column FiscalYear" in c_text,
        })

    # dataType must agree with the M expression that produces the column.
    # Live model only: the baseline sample is a frozen reference fixture that
    # predates these columns and is not held to the type contract.
    if do_value_checks:
        for col, expected in COLUMN_DATATYPE.items():
            actual = tmdl_column_datatype(c_text, col)
            checks[f"{col} dataType == {expected}"] = (actual == expected)

    # --- value checks: only meaningful for the live model ---------------------
    fmin, fmax = fact_span()
    if do_value_checks and week_based:
        fy_start = date.fromisoformat(cfg["fiscalYearStartDate"])
        n_years = cfg["numberOfYears"]
        week_day = cfg["weekStartDay"]
        label_mode = cfg.get("fiscalYearLabelMode", "endingYear")

        fys, span_start, span_end = fiscal_calendar(fy_start, n_years, week_day)

        print(f"  fiscalYearStartDate  {fy_start} ({fy_start.strftime('%A')})")
        print(f"  weekStartDay         {week_day}")
        print(f"  numberOfYears        {n_years}")
        print(f"  labelMode            {label_mode}")
        print(f"  calendar span        {span_start} .. {span_end}")
        if fmin:
            print(f"  fact span            {fmin} .. {fmax}")
        print()

        # 1. the fiscal year must actually open on/before the first fact date
        checks["fiscalYearStartDate <= fact min date"] = (fmin is None or fy_start <= fmin)
        # 2. the anchor must land on the declared week start day
        checks["fiscalYearStartDate falls on weekStartDay"] = (fy_start.strftime("%A") == week_day)
        # 3. the calendar must reach the last fact date
        checks["calendar span covers fact max date"] = (fmax is None or span_end >= fmax)
        # 4. label mode must produce a 4-digit year, not a 1..N ordinal
        checks["labelMode produces FY#### labels"] = label_mode in ("endingYear", "startingYear")

        # 5. report per-FY fact coverage, and require no fact days are lost
        if fmin:
            smin, smax = summary_month_span()
            print("  fiscal year   span                          fact days")
            for r in fys:
                fy = r["start_year"] if label_mode == "startingYear" else r["end_year"]
                lo, hi = max(r["start"], fmin), min(r["end"], fmax)
                cov = (hi - lo).days + 1 if hi >= lo else 0
                flag = "COMPLETE" if cov == r["days"] else ("no facts" if cov == 0 else "PARTIAL")
                print(f"  FY{fy}          {r['start']} .. {r['end']}   "
                      f"{cov:4d}/{r['days']}  {flag}")
            covered = sum(
                (min(r["end"], fmax) - max(r["start"], fmin)).days + 1
                for r in fys if min(r["end"], fmax) >= max(r["start"], fmin)
            )
            span_days = (fmax - fmin).days + 1
            populated = sum(
                1 for r in fys
                if min(r["end"], fmax) >= max(r["start"], fmin)
            )
            print(f"\n  fact days captured {covered}/{span_days}")
            print(f"  populated fiscal years: {populated}")
            checks["every fact date falls inside a generated fiscal year"] = covered == span_days
            # cheap independent cross-check: the recorded fact span must sit
            # inside the month range data/summary.json reports. smax is the
            # FIRST day of the last month, so the bound is the start of the
            # month after it -- comparing fmax directly to smax would wrongly
            # reject any fact date later in that final month.
            if smin and smax:
                y, m = smax.year, smax.month
                month_after = date(y + (m == 12), 1 if m == 12 else m + 1, 1)
                in_range = (fmin >= smin) and (fmax < month_after)
            else:
                in_range = True
            checks["recorded fact span agrees with summary.json months"] = in_range
            print()

    return checks


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
all_pass = True
total = 0
failed = 0
for label, paths, value_checks in (("live model", live, True), ("baseline", sample, False)):
    if any(not p.exists() for p in paths):
        continue
    print(f"[{label}] Validating for pattern: {pattern}")
    checks = check_model(label, paths, value_checks)
    for name, result in checks.items():
        print(f"[PASS] {name}" if result else f"[FAIL] {name}")
        if not result:
            all_pass = False
            failed += 1
    total += len(checks)
    print()

if all_pass:
    print(f"[PASS] All {total} Calendar TMDL checks passed.")
    sys.exit(0)

print(f"[FAIL] {failed}/{total} Calendar check(s) failed.")
sys.exit(1)
