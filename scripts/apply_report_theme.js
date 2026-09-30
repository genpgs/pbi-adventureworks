#!/usr/bin/env node
/**
 * scripts/apply_report_theme.js
 *
 * Idempotent pipeline that brings the PBIR report in line with
 * report-prototype.html. Safe to re-run: every step is a read-modify-write
 * from the current file state, not a patch against a known baseline.
 *
 *   1. prototype_parity.js — the whole report: page backgrounds, both pages,
 *                            the KPI ribbon, all charts, both tables, the
 *                            Fiscal Year slicers and the insight cards.
 *
 * This supersedes the earlier per-area scripts below. They are still on disk
 * and individually runnable, but are no longer in the pipeline because they
 * encode the pre-prototype-parity grid (KPI H95, a Clustered bar for Channel
 * Mix, a column chart for the FY trajectory, and the Subcategory bar):
 *   build_kpi_cards.js, relayout_page1.js, relayout_bottom_row.js,
 *   relayout_page2.js, build_page2_insights.js
 *
 * Usage: node scripts/apply_report_theme.js
 */
const { execFileSync } = require("child_process");
const path = require("path");

const STEPS = [
  "prototype_parity.js",
];

for (const step of STEPS) {
  console.log(`\n=== ${step} ===`);
  execFileSync(process.execPath, [path.join(__dirname, step)], {
    stdio: "inherit",
  });
}

console.log("\nTheme pipeline complete. Validate with:");
console.log("  powerbi-report-author validate AdventureWorksSales.Report");
console.log("  python3 scripts/validate_report.py AdventureWorksSales.Report");
