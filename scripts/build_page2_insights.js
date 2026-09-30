#!/usr/bin/env node
/**
 * scripts/build_page2_insights.js
 *
 * Adds the three insight cards from report-prototype.html to the Product
 * Profitability page.
 *
 * The prototype's insight panels are static prose. They are recreated as
 * textbox visuals on a card background, and the claims are written as guidance
 * pointing at the live visuals rather than as hard-coded figures, so they stay
 * true when the data refreshes.
 *
 * Layout: three cards of 400 wide, 8px gutters, starting at x=20.
 *   20 + 3*400 + 2*8 = 1236 -> right edge 1256 <= 1280
 *
 * The canvas is 1280x720 and the page also carries a title, the main product
 * table, a subcategory bar and a territory table, so the rows are re-flowed to
 * fit the insight row in:
 *   title 15-67 | main table 70-390 | insights 400-540 | charts 550-705
 * (relayout_page2.js owns the other three rows)
 */
const fs = require("fs");
const path = require("path");

const VISUALS = path.join(
  __dirname,
  "..",
  "AdventureWorksSales.Report",
  "definition",
  "pages",
  "ReportSection_ProductProfitability",
  "visuals"
);

const lit = (v) => ({ expr: { Literal: { Value: v } } });
const litColor = (hex) => ({ solid: { color: lit(`'${hex}'`) } });

const CARDS = [
  {
    name: "insight000000000001",
    x: 20,
    accent: "#F59E0B",
    kicker: "HIGHEST MARGIN CATEGORY",
    headline: "Clothing",
    body:
      "Clothing is a small share of total volume but carries the highest gross margin rate across all product lines. Filter the subcategory chart by Category to inspect it.",
  },
  {
    name: "insight000000000002",
    x: 428,
    accent: "#6366F1",
    kicker: "CORE REVENUE ENGINE",
    headline: "Mountain-200 Series",
    body:
      "The Mountain-200 frames across all sizes dominate the top of the product table with a consistent margin. Sort the main table by Total Sales to confirm the current ranking.",
  },
  {
    name: "insight000000000003",
    x: 836,
    accent: "#10B981",
    kicker: "GEOGRAPHIC DOMINANCE",
    headline: "North America",
    body:
      "The United States and Canada together drive roughly three quarters of enterprise revenue. Use the territory table to compare Group and Region performance.",
  },
];

const Y = 400;
const H = 140;
const W = 400;

for (const [index, card] of CARDS.entries()) {
  const visual = {
    $schema:
      "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json",
    name: card.name,
    position: { x: card.x, y: Y, z: 5000 + index, height: H, width: W, tabOrder: 5000 + index },
    visual: {
      visualType: "textbox",
      objects: {
        general: [
          {
            properties: {
              paragraphs: [
                {
                  textRuns: [
                    {
                      value: card.kicker,
                      textStyle: {
                        fontSize: "9pt",
                        color: card.accent,
                        fontWeight: "bold",
                        fontFamily: "Segoe UI Semibold",
                      },
                    },
                  ],
                },
                {
                  textRuns: [
                    {
                      value: card.headline,
                      textStyle: {
                        fontSize: "16pt",
                        color: "#0F172A",
                        fontWeight: "bold",
                        fontFamily: "Segoe UI",
                      },
                    },
                  ],
                },
                {
                  textRuns: [
                    {
                      value: card.body,
                      textStyle: { fontSize: "9pt", color: "#64748B", fontFamily: "Segoe UI" },
                    },
                  ],
                },
              ],
            },
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
              top: lit("12D"),
              bottom: lit("12D"),
              left: lit("12D"),
              right: lit("12D"),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit("true"),
              text: lit(`'${card.kicker}'`),
              fontSize: lit("9D"),
              fontColor: litColor(card.accent),
              alignment: lit("'left'"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };

  const dir = path.join(VISUALS, card.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2) + "\n");
  console.log(`wrote ${card.name}/visual.json (x=${card.x})`);
}
