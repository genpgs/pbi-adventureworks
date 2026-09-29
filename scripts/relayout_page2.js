#!/usr/bin/env node
/**
 * scripts/relayout_page2.js
 *
 * Brings the Product Profitability page in line with report-prototype.html.
 *
 * Prototype page 2 is: a full-width "Top 10 Products by Total Revenue" table
 * across the top, then a row of three insight cards underneath.
 *
 * This script repositions the two existing tables and the subcategory bar, and
 * restyles them onto the shared theme. The prototype's three "insight" panels
 * are static prose; the equivalent here is a caption textbox, added separately
 * by build_page2_insight.js.
 *
 * Canvas 1280x720. Rows: title 15-67, main table 70-390, insight cards
 * 400-540 (added by build_page2_insights.js), lower charts 550-705.
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
const SALES = "#2563EB";
const PROFIT = "#10B981";

function patch(name, mutator) {
  const file = path.join(VISUALS, name, "visual.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  mutator(json);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`patched ${name}`);
}

const setPos = (json, { x, y, width, height, z }) => {
  Object.assign(json.position, { x, y, width, height, z, tabOrder: z });
};

const card = (title) => ({
  background: [{ properties: { show: lit("true"), color: litColor("#FFFFFF"), transparency: lit("0D") } }],
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
        top: lit("8D"),
        bottom: lit("8D"),
        left: lit("8D"),
        right: lit("8D"),
      },
    },
  ],
  title: [
    {
      properties: {
        show: lit("true"),
        text: lit(`'${title}'`),
        fontSize: lit("12D"),
        fontColor: litColor("#1E293B"),
        alignment: lit("'left'"),
        titleWrap: lit("true"),
      },
    },
  ],
  visualHeader: [{ properties: { show: lit("false") } }],
});

patch("title000000000000002", (j) => {
  // 52px: the validator's floor for 20pt text with 8px padding is 48.
  setPos(j, { x: 20, y: 15, width: 1240, height: 52, z: 1000 });
  j.visual.objects.general[0].properties.paragraphs = [
    {
      textRuns: [
        {
          value: "AdventureWorks — Product & Customer Profitability Analysis",
          textStyle: {
            fontWeight: "bold",
            fontSize: "20pt",
            color: "#0F172A",
            fontFamily: "Segoe UI Semibold",
          },
        },
      ],
    },
  ];
  delete j.visual.visualContainerObjects;
});

// Main product table: full width, matches the prototype's Top-10 table.
patch("table000000000000002", (j) => {
  setPos(j, { x: 20, y: 70, width: 1240, height: 320, z: 2000 });
  j.visual.objects = {
    general: [{ properties: {} }],
    columnHeaders: [
      {
        properties: {
          backColor: litColor("#F8FAFC"),
          fontColor: litColor("#64748B"),
          bold: lit("true"),
          fontSize: lit("9D"),
          columnAdjustment: lit("'growToFit'"),
          autoSizeColumnWidth: lit("true"),
        },
      },
    ],
    values: [
      {
        properties: {
          fontSize: lit("9D"),
          backColorPrimary: litColor("#FFFFFF"),
          backColorSecondary: litColor("#F8FAFC"),
        },
      },
    ],
  };
  j.visual.visualContainerObjects = {
    stylePreset: [{ properties: { name: lit("'None'") } }],
    ...card("Top 10 Products by Total Revenue"),
  };
});

// Territory table keeps the left half of the lower row.
patch("table000000000000003", (j) => {
  setPos(j, { x: 20, y: 550, width: 600, height: 155, z: 4000 });
  j.visual.objects = {
    general: [{ properties: {} }],
    columnHeaders: [
      {
        properties: {
          backColor: litColor("#F8FAFC"),
          fontColor: litColor("#64748B"),
          bold: lit("true"),
          fontSize: lit("9D"),
          columnAdjustment: lit("'growToFit'"),
          autoSizeColumnWidth: lit("true"),
        },
      },
    ],
    values: [
      {
        properties: {
          fontSize: lit("9D"),
          backColorPrimary: litColor("#FFFFFF"),
          backColorSecondary: litColor("#F8FAFC"),
        },
      },
    ],
  };
  j.visual.visualContainerObjects = {
    stylePreset: [{ properties: { name: lit("'None'") } }],
    ...card("Revenue by Territory Group & Region"),
  };
});

// Subcategory bar takes the right half.
patch("subcat00000000000001", (j) => {
  setPos(j, { x: 640, y: 550, width: 620, height: 155, z: 3000 });
  j.visual.objects = {
    dataPoint: [{ properties: { defaultColor: litColor(SALES) } }],
  };
  j.visual.visualContainerObjects = {
    ...card("Revenue by Subcategory"),
  };
});

console.log("page 2 relayout complete");
