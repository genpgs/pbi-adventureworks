#!/usr/bin/env node
/**
 * scripts/relayout_page1.js
 *
 * Repositions and restyles the Executive Overview page so its geometry matches
 * the layout in report-prototype.html.
 *
 * Geometry decisions (user-confirmed):
 *  - The prototype's rendered HTML governs, not its spec drawer. The drawer put
 *    the KPI ribbon at y=15, but the HTML renders a header bar above it, so the
 *    ribbon sits at y=85 and the charts start at y=195.
 *  - Bottom-left is the country TABLE at x=20; the channel chart moves right.
 *
 * Canvas: 1280 x 720. Rows: header 15-70, KPI 85-180, charts 195-495,
 * bottom 510-705.
 *
 * Measure colours follow the cross-visual consistency rule in
 * references/authoring/color-strategy.md: Total Sales is #2563EB and
 * Total Profit is #10B981 on EVERY visual, via Literal hex + metadata
 * selectors (ThemeDataColor is unreliable with metadata selectors).
 */
const fs = require("fs");
const path = require("path");

const VISUALS = path.join(
  __dirname,
  "..",
  "AdventureWorksSales.Report",
  "definition",
  "pages",
  "ReportSection_ExecutiveOverview",
  "visuals"
);

const lit = (v) => ({ expr: { Literal: { Value: v } } });
const litColor = (hex) => ({ solid: { color: lit(`'${hex}'`) } });

const SALES = "#2563EB";
const PROFIT = "#10B981";

/** Read, mutate, write — never string-replace JSON (see authoring.md pitfalls). */
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

// ── Header ────────────────────────────────────────────────────────────────────
patch("title000000000000001", (j) => {
  setPos(j, { x: 20, y: 15, width: 880, height: 55, z: 1000 });
  j.visual.objects.general[0].properties.paragraphs = [
    {
      textRuns: [
        {
          value: "AdventureWorks Sales Analytics",
          textStyle: {
            fontWeight: "bold",
            fontSize: "20pt",
            color: "#0F172A",
            fontFamily: "Segoe UI Semibold",
          },
        },
      ],
    },
    {
      textRuns: [
        {
          value:
            "Data Source: AdventureWorks Sales  ·  4-4-5 Fiscal Calendar Pattern  ·  PBIP / PBIR",
          textStyle: { fontSize: "9pt", color: "#64748B", fontFamily: "Segoe UI" },
        },
      ],
    },
  ];
  // Title is drawn on the page canvas in the prototype, not inside a card.
  delete j.visual.visualContainerObjects;
});

patch("slicer00000000000001", (j) => {
  setPos(j, { x: 920, y: 15, width: 340, height: 55, z: 2000 });
  j.visual.objects.general = [{ properties: { orientation: lit("0") } }];
});

// ── Charts row ────────────────────────────────────────────────────────────────
patch("trend000000000000001", (j) => {
  setPos(j, { x: 20, y: 195, width: 780, height: 300, z: 4000 });
  j.visual.objects = {
    // Per-series colours keyed by metadata identity, per color-strategy.md.
    dataPoint: [
      {
        properties: { fill: litColor(SALES) },
        selector: { metadata: "FactSales.Total Sales" },
      },
      {
        properties: { fill: litColor(PROFIT) },
        selector: { metadata: "FactSales.Total Profit" },
      },
    ],
    lineStyles: [
      {
        properties: {
          strokeWidth: lit("2D"),
          showMarker: lit("false"),
          lineStyle: lit("'solid'"),
        },
      },
    ],
  };
  j.visual.visualContainerObjects = {
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
          text: lit("'Revenue & Profit Monthly Trajectory'"),
          fontSize: lit("12D"),
          fontColor: litColor("#1E293B"),
          alignment: lit("'left'"),
        },
      },
    ],
    visualHeader: [{ properties: { show: lit("false") } }],
  };
});

patch("catbar00000000000001", (j) => {
  setPos(j, { x: 820, y: 195, width: 440, height: 300, z: 5000 });
  j.visual.objects = {
    // Single measure on the Y axis, no Series role -> defaultColor, not fill.
    dataPoint: [{ properties: { defaultColor: litColor(SALES) } }],
  };
  j.visual.visualContainerObjects = {
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
          text: lit("'Category Revenue Share'"),
          fontSize: lit("12D"),
          fontColor: litColor("#1E293B"),
          alignment: lit("'left'"),
        },
      },
    ],
    visualHeader: [{ properties: { show: lit("false") } }],
  };
});

// ── Bottom row: country table at x=20, channel chart moves right ──────────────
patch("table000000000000001", (j) => {
  setPos(j, { x: 20, y: 510, width: 620, height: 195, z: 6000 });
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
      { properties: { fontSize: lit("9D"), backColorPrimary: litColor("#FFFFFF"), backColorSecondary: litColor("#F8FAFC") } },
    ],
  };
  j.visual.visualContainerObjects = {
    stylePreset: [{ properties: { name: lit("'None'") } }],
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
          text: lit("'Geographic Revenue by Country'"),
          fontSize: lit("12D"),
          fontColor: litColor("#1E293B"),
          alignment: lit("'left'"),
        },
      },
    ],
    visualHeader: [{ properties: { show: lit("false") } }],
  };
});

patch("chan0000000000000001", (j) => {
  setPos(j, { x: 660, y: 510, width: 600, height: 195, z: 7000 });
  j.visual.objects = {
    dataPoint: [{ properties: { defaultColor: litColor(SALES) } }],
  };
  j.visual.visualContainerObjects = {
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
          text: lit("'Channel Mix'"),
          fontSize: lit("12D"),
          fontColor: litColor("#1E293B"),
          alignment: lit("'left'"),
          titleWrap: lit("true"),
        },
      },
    ],
    visualHeader: [{ properties: { show: lit("false") } }],
  };
});

console.log("page 1 relayout complete");
