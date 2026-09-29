#!/usr/bin/env node
/**
 * scripts/build_kpi_cards.js
 *
 * Generates the five KPI cardVisual containers on the Executive Overview page,
 * matching the report-prototype.html KPI ribbon.
 *
 * Each card gets its own accent-bar colour and label, so they are deliberately
 * SEPARATE single-value cardVisuals rather than one multi-value card — see
 * references/authoring/card.md "When to Consolidate vs. Keep Separate"
 * (per-card accent bar colours are an explicit exception to consolidation).
 *
 * Height budget (card.md mandatory pre-check), with paddingUniform=8 and
 * VCO padding top/bottom=6, value=20pt, label=9pt (effective 12pt),
 * verticalSpacing=2, accentBar width=4, border width=1:
 *   1*2 + 6+6 + 0 + 8+8 + ceil(20*1.5) + 2 + ceil(12*1.5) + 4 = 78 <= 95  OK
 *
 * Usage: node scripts/build_kpi_cards.js
 */
const fs = require("fs");
const path = require("path");

const PAGE = path.join(
  __dirname,
  "..",
  "AdventureWorksSales.Report",
  "definition",
  "pages",
  "ReportSection_ExecutiveOverview",
  "visuals"
);

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

// x positions: 5 cards of 240 wide with 8px gutters, starting at x=20.
// 20 + 5*240 + 4*8 = 1252 <= 1280 canvas width.
const CARD_Y = 85;
const CARD_H = 95;
const CARD_W = 240;
const GUTTER = 8;
const START_X = 20;

const lit = (v) => ({ expr: { Literal: { Value: v } } });
const litColor = (hex) => ({ solid: { color: lit(`'${hex}'`) } });

/**
 * @param {object} spec
 * @param {string} spec.name   visual folder + visual name
 * @param {string} spec.measure model measure to project
 * @param {string} spec.label   label text override (prototype caption)
 * @param {string} spec.accent  accent bar hex
 * @param {string} spec.valueColor hex for the callout value
 * @param {string} spec.units   labelDisplayUnits enum value
 * @param {number} spec.precision decimal places
 */
function buildCard({ name, index, measure, label, accent, valueColor, units, precision, z }) {
  const x = START_X + index * (CARD_W + GUTTER);

  return {
    $schema: SCHEMA,
    name,
    position: {
      x,
      y: CARD_Y,
      z,
      height: CARD_H,
      width: CARD_W,
      tabOrder: z,
    },
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: {
            projections: [
              {
                field: {
                  Measure: {
                    Expression: { SourceRef: { Entity: "FactSales" } },
                    Property: measure,
                  },
                },
                queryRef: `FactSales.${measure}`,
                nativeQueryRef: measure,
              },
            ],
          },
        },
      },
      objects: {
        value: [
          {
            properties: {
              fontSize: lit("20D"),
              fontColor: litColor(valueColor),
              labelDisplayUnits: lit(units),
              labelPrecision: lit(`${precision}L`),
            },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: {
              show: lit("true"),
              text: lit(`'${label}'`),
              fontSize: lit("9D"),
              fontColor: litColor("#64748B"),
              position: lit("'aboveValue'"),
            },
            selector: { id: "default" },
          },
        ],
        accentBar: [
          {
            properties: {
              show: lit("true"),
              position: lit("'Top'"),
              width: lit("4D"),
              color: litColor(accent),
            },
            selector: { id: "default" },
          },
        ],
        outline: [
          { properties: { show: lit("false") }, selector: { id: "default" } },
        ],
        padding: [
          {
            properties: { paddingUniform: lit("8L") },
            selector: { id: "default" },
          },
        ],
      },
      visualContainerObjects: {
        background: [
          {
            properties: {
              show: lit("true"),
              color: litColor("#FFFFFF"),
              transparency: lit("0D"),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit("true"),
              color: litColor("#E2E8F0"),
              radius: lit("8D"),
              width: lit("1D"),
            },
          },
        ],
        padding: [
          {
            properties: {
              top: lit("6D"),
              bottom: lit("6D"),
              left: lit("0D"),
              right: lit("0D"),
            },
          },
        ],
        spacing: [
          {
            properties: {
              customizeSpacing: lit("true"),
              verticalSpacing: lit("2D"),
            },
          },
        ],
        title: [{ properties: { show: lit("false") } }],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };
}

const CARDS = [
  {
    name: "kpi-sales00000000001",
    index: 0,
    measure: "Total Sales",
    label: "TOTAL SALES",
    accent: "#2563EB",
    valueColor: "#0F172A",
    units: "1000000",
    precision: 2,
    z: 3000,
  },
  {
    name: "kpi-profit0000000001",
    index: 1,
    measure: "Total Profit",
    label: "TOTAL PROFIT",
    accent: "#10B981",
    valueColor: "#059669",
    units: "1000000",
    precision: 2,
    z: 3001,
  },
  {
    name: "kpi-cost000000000001",
    index: 2,
    measure: "Total Cost",
    label: "TOTAL COST",
    accent: "#F59E0B",
    valueColor: "#D97706",
    units: "1000000",
    precision: 2,
    z: 3002,
  },
  {
    name: "kpi-units00000000001",
    index: 3,
    measure: "Total Units Sold",
    label: "UNITS SOLD",
    accent: "#6366F1",
    valueColor: "#0F172A",
    units: "1000",
    precision: 1,
    z: 3003,
  },
  {
    name: "kpi-orders00000000001",
    index: 4,
    measure: "Total Orders",
    label: "TOTAL ORDERS",
    accent: "#A855F7",
    valueColor: "#0F172A",
    units: "0",
    precision: 0,
    z: 3004,
  },
];

CARDS.forEach((spec) => {
  const dir = path.join(PAGE, spec.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "visual.json");
  fs.writeFileSync(file, JSON.stringify(buildCard(spec), null, 2) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
});
