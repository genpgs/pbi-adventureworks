#!/usr/bin/env node
/**
 * scripts/apply_report_theme.js
 *
 * Idempotent pipeline that brings the PBIR report in line with
 * report-prototype.html. Safe to re-run: every step is a read-modify-write
 * from the current file state, not a patch against a known baseline.
 *
 *   1. build_kpi_cards.js      — 5 accent-coloured KPI cards
 *   2. relayout_page1.js       — header, charts row, VCO chrome, measure colours
 *   3. relayout_bottom_row.js  — country table / channel / FY trajectory row
 *   4. relayout_page2.js       — product table, territory table, subcategory bar
 *   5. build_page2_insights.js — the three prototype insight cards
 *
 * Always run build_kpi_cards.js and build_page2_insights.js BEFORE the
 * relayout steps, and relayout_page1.js BEFORE relayout_bottom_row.js (the
 * bottom row positions the channel chart that page 1 restyles).
 *
 * Usage: node scripts/apply_report_theme.js
 */
const { execFileSync } = require("child_process");
const path = require("path");

const STEPS = [
  "build_kpi_cards.js",
  "relayout_page1.js",
  "relayout_bottom_row.js",
  "relayout_page2.js",
  "build_page2_insights.js",
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
