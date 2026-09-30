#!/usr/bin/env node
/**
 * scripts/prototype_parity.js
 *
 * Brings AdventureWorksSales.Report in line with report-prototype.html. This
 * supersedes build_kpi_cards.js / relayout_page1.js / relayout_bottom_row.js /
 * relayout_page2.js / build_page2_insights.js, which are left on disk but no
 * longer in the pipeline (they are still runnable individually).
 *
 * Idempotent: every visual is rebuilt from this spec, not patched. Safe to
 * re-run. Run it, then validate.
 *
 *   node scripts/prototype_parity.js
 *   powerbi-report-author validate AdventureWorksSales.Report
 *   python scripts/validate_report.py AdventureWorksSales.Report
 *
 * ---------------------------------------------------------------------------
 * WHY THE GRID CHANGED
 * ---------------------------------------------------------------------------
 * The prototype KPI card carries a progress bar, which cardVisual cannot
 * render. Closing the gap with a YoY chip + a secondary sub-caption adds two
 * more rows of text, so the cards no longer fit the old H=95 (budget was
 * 78/95). New budget with three Data projections:
 *
 *   1*2 borders + 6+6 VCO pad + 8+8 callout pad
 *   + ceil(20*1.5) value + 2 spacing
 *   + ceil(9*1.5)  label
 *   + ceil(8*1.5)  YoY chip + 2 spacing
 *   + ceil(8*1.5)  sub-caption
 *   + 4 accentBar = 112
 *
 * H112 does not fit under the old chart row (cards 85..177, charts 195..495),
 * and a Dropdown slicer has a 76px floor (header 28 + selector 32 + padding
 * 8/8 - see slicers.md "Sizing"). The header band therefore grows to 76 and
 * the rows are re-flowed:
 *
 *   header   15..91    title + Fiscal Year dropdown
 *   KPI      98..210   5 cards, W240, gutter 8
 *   charts  220..500   trend 20/780, category 820/440
 *   bottom  510..705   country 20/600, channel 636/300, fiscal 952/308
 *
 * 20 + 5*240 + 4*8 = 1260 <= 1280 and 952 + 308 = 1260 <= 1280, so the right
 * margin stays at 20px on every row.
 * ---------------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const REPORT = path.join(__dirname, "..", "AdventureWorksSales.Report");
const DEF = path.join(REPORT, "definition");
const PAGES = path.join(DEF, "pages");

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

// --- design tokens (match AdventureWorksClean-a7c3e91b.json) ---------------
const SALES = "#2563EB";
const PROFIT = "#10B981";
const COST = "#F59E0B";
const INDIGO = "#6366F1";
const PURPLE = "#A855F7";
const TEAL = "#14B8A6";
const INK = "#0F172A";
const TEXT = "#1E293B";
const MUTED = "#64748B";
const HAIRLINE = "#E2E8F0";
const CARD_BG = "#FFFFFF";

// --- grid -------------------------------------------------------------------
const HEADER_Y = 15;
const HEADER_H = 76;
const KPI_Y = 98;
const KPI_H = 112;
const KPI_W = 240;
const GUTTER = 8;
const START_X = 20;

const CHARTS_Y = 220;
const CHARTS_H = 280;
const BOTTOM_Y = 510;
const BOTTOM_H = 195;

// --- helpers ----------------------------------------------------------------
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const litColor = (hex) => ({ solid: { color: lit(`'${hex}'`) } });
const measure = (entity, prop) => ({
  field: {
    Measure: { Expression: { SourceRef: { Entity: entity } }, Property: prop },
  },
  queryRef: `${entity}.${prop}`,
  nativeQueryRef: prop,
});
const column = (entity, prop) => ({
  field: {
    Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop },
  },
  queryRef: `${entity}.${prop}`,
  nativeQueryRef: prop,
  active: true,
});
const wildcardSelector = (queryRef) => ({
  data: [{ dataViewWildcard: { matchingOption: 0 } }],
  metadata: queryRef,
});

/** Card chrome shared by every visual container in the report. */
function chrome({ title, subTitle, pad = 8 }) {
  const c = {
    background: [
      { properties: { show: lit("true"), color: litColor(CARD_BG), transparency: lit("0D") } },
    ],
    border: [
      {
        properties: {
          show: lit("true"),
          color: litColor(HAIRLINE),
          radius: lit("8D"),
          width: lit("1D"),
        },
      },
    ],
    padding: [
      {
        properties: {
          top: lit(`${pad}D`),
          bottom: lit(`${pad}D`),
          left: lit(`${pad}D`),
          right: lit(`${pad}D`),
        },
      },
    ],
    visualHeader: [{ properties: { show: lit("false") } }],
  };
  if (title !== undefined) {
    c.title = [
      {
        properties: {
          show: lit("true"),
          text: lit(`'${title}'`),
          fontSize: lit("12D"),
          fontColor: litColor(TEXT),
          alignment: lit("'left'"),
          titleWrap: lit("true"),
        },
      },
    ];
  }
  if (subTitle !== undefined) {
    c.subTitle = [
      {
        properties: {
          show: lit("true"),
          text: lit(`'${subTitle}'`),
          fontSize: lit("9D"),
          fontColor: litColor(MUTED),
          alignment: lit("'left'"),
          titleWrap: lit("true"),
        },
      },
    ];
  }
  return c;
}

function writeVisual(page, name, visual) {
  // PBIR keeps visual-level filters at the CONTAINER root, under
  // `filterConfig.filters` - not inside `visual`, which allows only
  // visualType / query / objects / visualContainerObjects / expansionStates /
  // syncGroup / drillFilterOtherVisuals / autoSelectVisualType. The builders
  // express them as `visual.filters` for readability; normalise on write.
  if (visual.visual && Array.isArray(visual.visual.filters)) {
    visual.filterConfig = { filters: visual.visual.filters };
    delete visual.visual.filters;
  }
  const dir = path.join(PAGES, page, "visuals", name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "visual.json");
  fs.writeFileSync(file, JSON.stringify(visual, null, 2) + "\n");
  console.log(`  wrote ${page}/visuals/${name}`);
}

function writePage(page, body) {
  const file = path.join(PAGES, page, "page.json");
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + "\n");
  console.log(`  wrote ${page}/page.json`);
}

function removeVisual(page, name) {
  const dir = path.join(PAGES, page, "visuals", name);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
    console.log(`  removed ${page}/visuals/${name}`);
  }
}

// ===========================================================================
// Page 1 - Executive Overview
// ===========================================================================
const P1 = "ReportSection_ExecutiveOverview";

/**
 * Five accent-barred KPI cards, each with a YoY growth chip and a secondary
 * sub-caption, so the card carries label / chip / value / sub-caption like the
 * prototype. The prototype's progress bar has no cardVisual equivalent and is
 * deliberately dropped (the accent bar carries the colour identity instead).
 */
const KPI_CARDS = [
  {
    name: "kpi-sales00000000001",
    index: 0,
    measure: "Total Sales",
    label: "TOTAL SALES",
    accent: SALES,
    valueColor: INK,
    units: "1000000",
    precision: 2,
    growth: "Sales YoY Growth %",
    sub: "Average Order Value",
    z: 3000,
  },
  {
    name: "kpi-profit0000000001",
    index: 1,
    measure: "Total Profit",
    label: "TOTAL PROFIT",
    accent: PROFIT,
    valueColor: "#059669",
    units: "1000000",
    precision: 2,
    growth: "Profit YoY Growth %",
    sub: "Profit Margin %",
    z: 3001,
  },
  {
    name: "kpi-cost000000000001",
    index: 2,
    measure: "Total Cost",
    label: "TOTAL COST",
    accent: COST,
    valueColor: "#D97706",
    units: "1000000",
    precision: 2,
    // prototype shows a static "COGS" chip here; there is no YoY for cost, so
    // the card carries the sub-caption only rather than a duplicated measure.
    growth: null,
    sub: "Cost % of Sales",
    z: 3002,
  },
  {
    name: "kpi-units00000000001",
    index: 3,
    measure: "Total Units Sold",
    label: "UNITS SOLD",
    accent: INDIGO,
    valueColor: INK,
    units: "1000",
    precision: 1,
    growth: "Units YoY Growth %",
    sub: "Avg Units per Order",
    z: 3003,
  },
  {
    name: "kpi-orders00000000001",
    index: 4,
    measure: "Total Orders",
    label: "TOTAL ORDERS",
    accent: PURPLE,
    valueColor: INK,
    units: "0",
    precision: 0,
    growth: "Orders YoY Growth %",
    sub: "Average Order Value",
    z: 3004,
  },
];

function buildKpiCard(spec) {
  const x = START_X + spec.index * (KPI_W + GUTTER);
  const projections = [measure("FactSales", spec.measure)];
  if (spec.growth) projections.push(measure("FactSales", spec.growth));
  projections.push(measure("FactSales", spec.sub));

  const value = [
    {
      properties: {
        fontSize: lit("20D"),
        fontColor: litColor(spec.valueColor),
        labelDisplayUnits: lit(spec.units),
        labelPrecision: lit(`${spec.precision}L`),
      },
      selector: { metadata: `FactSales.${spec.measure}` },
    },
  ];
  if (spec.growth) {
    value.push({
      properties: {
        fontSize: lit("8D"),
        fontColor: litColor(PROFIT),
        labelDisplayUnits: lit("0"),
        labelPrecision: lit("1L"),
      },
      selector: { metadata: `FactSales.${spec.growth}` },
    });
  }
  value.push({
    properties: { fontSize: lit("8D"), fontColor: litColor(MUTED) },
    selector: { metadata: `FactSales.${spec.sub}` },
  });

  return {
    $schema: SCHEMA,
    name: spec.name,
    position: {
      x,
      y: KPI_Y,
      z: spec.z,
      height: KPI_H,
      width: KPI_W,
      tabOrder: spec.z,
    },
    visual: {
      visualType: "cardVisual",
      query: { queryState: { Data: { projections } } },
      objects: {
        value,
        label: [
          {
            properties: {
              show: lit("true"),
              text: lit(`'${spec.label}'`),
              fontSize: lit("9D"),
              fontColor: litColor(MUTED),
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
              color: litColor(spec.accent),
            },
            selector: { id: "default" },
          },
        ],
        outline: [{ properties: { show: lit("false") }, selector: { id: "default" } }],
        padding: [
          { properties: { paddingUniform: lit("8L") }, selector: { id: "default" } },
        ],
      },
      visualContainerObjects: {
        background: [
          { properties: { show: lit("true"), color: litColor(CARD_BG), transparency: lit("0D") } },
        ],
        border: [
          {
            properties: {
              show: lit("true"),
              color: litColor(HAIRLINE),
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
            properties: { customizeSpacing: lit("true"), verticalSpacing: lit("2D") },
          },
        ],
        title: [{ properties: { show: lit("false") } }],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };
}

function buildTitleTextbox() {
  return {
    $schema: SCHEMA,
    name: "title000000000000001",
    position: {
      x: START_X,
      y: HEADER_Y,
      z: 1000,
      height: HEADER_H,
      width: 880,
      tabOrder: 1000,
    },
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
                      value: "AdventureWorks Sales Analytics",
                      textStyle: {
                        fontWeight: "bold",
                        fontSize: "20pt",
                        color: INK,
                        fontFamily: "Segoe UI Semibold",
                      },
                    },
                  ],
                },
                {
                  textRuns: [
                    {
                      value:
                        "Data Source: AdventureWorks Sales.xlsx  |  4-4-5 Fiscal Calendar Pattern  |  PBIP / PBIR",
                      textStyle: { fontSize: "9pt", color: MUTED, fontFamily: "Segoe UI" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit("false") } }],
        border: [{ properties: { show: lit("false") } }],
        padding: [
          { properties: { top: lit("0D"), bottom: lit("0D"), left: lit("0D"), right: lit("0D") } },
        ],
        title: [{ properties: { show: lit("false") } }],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };
}

function buildSlicer(name, z) {
  return {
    $schema: SCHEMA,
    name,
    position: {
      x: 920,
      y: HEADER_Y,
      z,
      height: HEADER_H,
      width: 340,
      tabOrder: z,
    },
    visual: {
      visualType: "slicer",
      query: {
        queryState: { Values: { projections: [column("Calendar", "FiscalYearLabel")] } },
      },
      objects: {
        // Dropdown lives on data.mode; general.orientation is a 0/1 enum and
        // does not take a style name. textSize, not fontSize, is the property
        // name on header/items. selectAllCheckboxEnabled is on `selection`.
        data: [{ properties: { mode: lit("'Dropdown'") }, selector: { id: "default" } }],
        selection: [
          { properties: { selectAllCheckboxEnabled: lit("true") }, selector: { id: "default" } },
        ],
        header: [
          {
            properties: {
              show: lit("true"),
              text: lit("'Fiscal Year'"),
              textSize: lit("9D"),
              fontColor: litColor(MUTED),
            },
            selector: { id: "default" },
          },
        ],
        items: [
          {
            properties: { textSize: lit("9D"), fontColor: litColor(TEXT) },
            selector: { id: "default" },
          },
        ],
      },
      visualContainerObjects: {
        background: [
          { properties: { show: lit("true"), color: litColor(CARD_BG), transparency: lit("0D") } },
        ],
        border: [
          {
            properties: {
              show: lit("true"),
              color: litColor(HAIRLINE),
              radius: lit("8D"),
              width: lit("1D"),
            },
          },
        ],
        padding: [
          {
            properties: {
              top: lit("4D"),
              bottom: lit("4D"),
              left: lit("8D"),
              right: lit("8D"),
            },
          },
        ],
        title: [{ properties: { show: lit("false") } }],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };
}

function buildTrend() {
  return {
    $schema: SCHEMA,
    name: "trend000000000000001",
    position: {
      x: START_X,
      y: CHARTS_Y,
      z: 4000,
      height: CHARTS_H,
      width: 780,
      tabOrder: 4000,
    },
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          // YearMonth, not CalendarMonth: CalendarMonth has 12 distinct values
          // and would collapse the 36-month trajectory into 12 aggregated
          // points. YearMonthSort keeps the months in chronological order.
          Category: { projections: [column("Calendar", "YearMonth")] },
          Y: {
            projections: [
              measure("FactSales", "Total Sales"),
              measure("FactSales", "Total Profit"),
            ],
          },
        },
      },
      objects: {
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
              showMarker: lit("true"),
              lineStyle: lit("'solid'"),
            },
            selector: { metadata: "FactSales.Total Sales" },
          },
          {
            properties: {
              strokeWidth: lit("2D"),
              showMarker: lit("false"),
              lineStyle: lit("'solid'"),
            },
            selector: { metadata: "FactSales.Total Profit" },
          },
        ],
        labels: [{ properties: { show: lit("false") }, selector: { id: "default" } }],
        legend: [
          {
            properties: {
              show: lit("true"),
              position: lit("'Top'"),
              showTitle: lit("false"),
              labelColor: litColor(MUTED),
            },
            selector: { id: "default" },
          },
        ],
        categoryAxis: [
          {
            properties: {
              labelColor: litColor(MUTED),
              show: lit("true"),
            },
            selector: { id: "default" },
          },
        ],
        valueAxis: [
          {
            properties: {
              show: lit("true"),
              labelColor: litColor(MUTED),
              labelDisplayUnits: lit("1000000"),
              labelPrecision: lit("0L"),
              gridlineShow: lit("true"),
              gridlineColor: litColor(HAIRLINE),
            },
            selector: { id: "default" },
          },
        ],
      },
      visualContainerObjects: chrome({
        title: "REVENUE & PROFIT MONTHLY TRAJECTORY",
        subTitle: "Monthly Sales Revenue (blue) vs Gross Profit (green) in USD",
      }),
    },
  };
}

function buildCategoryBar() {
  // Power BI assigns palette colour by series, not category, so a single-measure
  // bar chart renders every bar the same hue. Static per-category colours need
  // a metadata selector on the category column.
  const CATEGORY_COLORS = {
    Bikes: SALES,
    Components: INDIGO,
    Clothing: COST,
    Accessories: TEAL,
  };
  return {
    $schema: SCHEMA,
    name: "catbar00000000000001",
    position: {
      x: 820,
      y: CHARTS_Y,
      z: 5000,
      height: CHARTS_H,
      width: 440,
      tabOrder: 5000,
    },
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column("DimProduct", "Category")] },
          Y: { projections: [measure("FactSales", "Total Sales")] },
        },
      },
      objects: {
        dataPoint: Object.entries(CATEGORY_COLORS).map(([cat, hex]) => ({
          properties: { fill: litColor(hex) },
          selector: { metadata: `DimProduct.${cat}` },
        })),
        labels: [
          {
            properties: {
              show: lit("true"),
              fontSize: lit("9D"),
              color: litColor(TEXT),
              labelDisplayUnits: lit("1000000"),
              labelPrecision: lit("2L"),
            },
            selector: { id: "default" },
          },
        ],
        legend: [{ properties: { show: lit("false") }, selector: { id: "default" } }],
        categoryAxis: [
          { properties: { labelColor: litColor(TEXT), show: lit("true") }, selector: { id: "default" } },
        ],
        valueAxis: [
          {
            properties: { show: lit("false"), gridlineShow: lit("false") },
            selector: { id: "default" },
          },
        ],
      },
      visualContainerObjects: chrome({
        title: "CATEGORY REVENUE SHARE",
        subTitle: "Sales amount and margin % by category",
      }),
    },
  };
}

function buildCountryTable() {
  const cols = [
    column("DimSalesTerritory", "Country"),
    measure("FactSales", "Total Sales"),
    measure("FactSales", "Sales Share %"),
    measure("FactSales", "Total Profit"),
    measure("FactSales", "Profit Margin %"),
  ];
  return {
    $schema: SCHEMA,
    name: "table000000000000001",
    position: {
      x: START_X,
      y: BOTTOM_Y,
      z: 6000,
      height: BOTTOM_H,
      width: 600,
      tabOrder: 6000,
    },
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: {
            projections: cols,
          },
        },
        // sortDefinition is a SIBLING of queryState under query, not a member
        // of the role state. visualConfiguration.Query allows only
        // sortDefinition / options / queryState / isDrillDisabled, and
        // ProjectionState allows only showAll / projections / fieldParameters.
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "FactSales" } },
                  Property: "Total Sales",
                },
              },
              direction: "Descending",
            },
          ],
          isDefaultSort: true,
        },
      },
      objects: {
        general: [{ properties: {} }],
        columnHeaders: [
          {
            properties: {
              backColor: litColor("#F8FAFC"),
              fontColor: litColor(MUTED),
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
              backColorPrimary: litColor(CARD_BG),
              backColorSecondary: litColor("#F8FAFC"),
            },
          },
          {
            properties: { fontColor: litColor(PROFIT) },
            selector: wildcardSelector("FactSales.Total Profit"),
          },
        ],
        columnFormatting: [
          {
            properties: { alignment: lit("'Right'") },
            selector: { metadata: "FactSales.Profit Margin %" },
          },
          {
            properties: {
              dataBars: {
                positiveColor: litColor(SALES),
                negativeColor: litColor("#EF4444"),
                axisColor: litColor(MUTED),
                reverseDirection: lit("false"),
                hideText: lit("false"),
              },
            },
            // metadata-only selector: a dataViewWildcard here makes the bars
            // disappear.
            selector: { metadata: "FactSales.Total Sales" },
          },
        ],
      },
      visualContainerObjects: {
        ...chrome({
          title: "GEOGRAPHIC REVENUE BY COUNTRY",
          subTitle: "6 Territories",
        }),
        stylePreset: [{ properties: { name: lit("'None'") } }],
      },
    },
  };
}

function buildChannelMix() {
  return {
    $schema: SCHEMA,
    name: "chan0000000000000001",
    position: {
      x: 636,
      y: BOTTOM_Y,
      z: 7000,
      height: BOTTOM_H,
      width: 300,
      tabOrder: 7000,
    },
    visual: {
      // The prototype draws Channel Mix as a 100% proportion bar, not a
      // two-bar comparison.
      visualType: "hundredPercentStackedBarChart",
      query: {
        queryState: {
          Category: { projections: [column("DimSalesOrder", "Channel")] },
          Y: { projections: [measure("FactSales", "Total Sales")] },
        },
      },
      objects: {
        dataPoint: [
          {
            properties: { fill: litColor(SALES) },
            selector: { metadata: "DimSalesOrder.Reseller" },
          },
          {
            properties: { fill: litColor(PROFIT) },
            selector: { metadata: "DimSalesOrder.Internet" },
          },
        ],
        labels: [
          {
            properties: {
              show: lit("true"),
              fontSize: lit("9D"),
              color: litColor("#FFFFFF"),
              labelDisplayUnits: lit("1000000"),
              labelPrecision: lit("2L"),
            },
            selector: { id: "default" },
          },
        ],
        legend: [
          {
            properties: { show: lit("true"), position: lit("'Bottom'"), showTitle: lit("false") },
            selector: { id: "default" },
          },
        ],
        categoryAxis: [
          { properties: { show: lit("true"), labelColor: litColor(TEXT) }, selector: { id: "default" } },
        ],
        valueAxis: [
          { properties: { show: lit("false"), gridlineShow: lit("false") }, selector: { id: "default" } },
        ],
      },
      visualContainerObjects: chrome({
        title: "CHANNEL MIX",
        subTitle: "Reseller vs Internet share of revenue",
      }),
    },
  };
}

function buildFiscalTable() {
  const cols = [
    column("Calendar", "FiscalYearLabel"),
    measure("FactSales", "Total Sales"),
    measure("FactSales", "Sales YoY Growth %"),
    measure("FactSales", "Total Profit"),
    measure("FactSales", "Profit Margin %"),
    measure("FactSales", "Total Units Sold"),
    measure("FactSales", "Total Orders"),
  ];
  return {
    $schema: SCHEMA,
    name: "fytrajectory000000001",
    position: {
      x: 952,
      y: BOTTOM_Y,
      z: 8000,
      height: BOTTOM_H,
      width: 308,
      tabOrder: 8000,
    },
    visual: {
      // Prototype's Annual Growth Trajectory carries revenue, units, orders,
      // YoY, margin and profit per FY. A column chart can show one or two of
      // those, so this is a table.
      visualType: "tableEx",
      query: {
        queryState: {
          Values: {
            projections: cols,
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "Calendar" } },
                  Property: "FiscalYear",
                },
              },
              direction: "Ascending",
            },
          ],
          isDefaultSort: true,
        },
      },
      objects: {
        general: [{ properties: {} }],
        columnHeaders: [
          {
            properties: {
              backColor: litColor("#F8FAFC"),
              fontColor: litColor(MUTED),
              bold: lit("true"),
              fontSize: lit("8D"),
              columnAdjustment: lit("'growToFit'"),
              autoSizeColumnWidth: lit("true"),
            },
          },
        ],
        values: [
          {
            properties: {
              fontSize: lit("8D"),
              backColorPrimary: litColor(CARD_BG),
              backColorSecondary: litColor("#F8FAFC"),
            },
          },
          {
            properties: { fontColor: litColor(PROFIT) },
            selector: wildcardSelector("FactSales.Total Profit"),
          },
          {
            properties: { fontColor: litColor(COST) },
            selector: wildcardSelector("FactSales.Profit Margin %"),
          },
          {
            properties: { fontColor: litColor(PROFIT) },
            selector: wildcardSelector("FactSales.Sales YoY Growth %"),
          },
        ],
        columnFormatting: [
          {
            properties: {
              dataBars: {
                positiveColor: litColor(SALES),
                negativeColor: litColor("#EF4444"),
                axisColor: litColor(MUTED),
                reverseDirection: lit("false"),
                hideText: lit("false"),
              },
            },
            selector: { metadata: "FactSales.Total Sales" },
          },
        ],
      },
      visualContainerObjects: {
        ...chrome({
          title: "ANNUAL GROWTH TRAJECTORY",
          subTitle: "4-4-5 fiscal calendar",
        }),
        stylePreset: [{ properties: { name: lit("'None'") } }],
      },
    },
  };
}

// ===========================================================================
// Page 2 - Product & Territory Profitability
// ===========================================================================
const P2 = "ReportSection_ProductProfitability";

// Page 2 has its own row rhythm - it has no KPI ribbon, so it can give the
// product table more height and still leave room for the insight cards.
//   header   15..91     title + Fiscal Year dropdown
//   products 98..398    H300
//   insights 408..490   H82
//   territory 500..705  H205
const P2_PRODUCT_Y = 98;
const P2_PRODUCT_H = 300;
const P2_INSIGHT_Y = 408;
const P2_INSIGHT_H = 82;
const P2_BOTTOM_Y = 500;
const P2_BOTTOM_H = 205;

function buildPage2Title() {
  return {
    $schema: SCHEMA,
    name: "title000000000000002",
    position: {
      x: START_X,
      y: HEADER_Y,
      z: 1000,
      height: HEADER_H,
      width: 880,
      tabOrder: 1000,
    },
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
                      value: "Product & Territory Profitability",
                      textStyle: {
                        fontWeight: "bold",
                        fontSize: "20pt",
                        color: INK,
                        fontFamily: "Segoe UI Semibold",
                      },
                    },
                  ],
                },
                {
                  textRuns: [
                    {
                      value:
                        "Top products, territory performance and margin contribution  |  4-4-5 Fiscal Calendar",
                      textStyle: { fontSize: "9pt", color: MUTED, fontFamily: "Segoe UI" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit("false") } }],
        border: [{ properties: { show: lit("false") } }],
        padding: [
          { properties: { top: lit("0D"), bottom: lit("0D"), left: lit("0D"), right: lit("0D") } },
        ],
        title: [{ properties: { show: lit("false") } }],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };
}

function buildProductTable() {
  const cols = [
    measure("FactSales", "Product Revenue Rank"),
    column("DimProduct", "Product"),
    column("DimProduct", "Category"),
    measure("FactSales", "Total Units Sold"),
    measure("FactSales", "Total Sales"),
    measure("FactSales", "Total Profit"),
    measure("FactSales", "Profit Margin %"),
  ];
  return {
    $schema: SCHEMA,
    name: "table000000000000002",
    position: {
      x: START_X,
      y: P2_PRODUCT_Y,
      z: 2000,
      height: P2_PRODUCT_H,
      width: 1240,
      tabOrder: 2000,
    },
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: {
            projections: cols,
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "FactSales" } },
                  Property: "Total Sales",
                },
              },
              direction: "Descending",
            },
          ],
          isDefaultSort: true,
        },
      },
      // Without this the visual renders every product in the catalogue, not
      // the top 10 its title promises. writeVisual() relocates this to the
      // container root as filterConfig.filters.
      filters: [
        {
          name: "FilterTopNProductRevenue",
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "DimProduct" } },
              Property: "Product",
            },
          },
          type: "TopN",
          filter: {
            Version: 2,
            From: [
              {
                Name: "subquery",
                Expression: {
                  Subquery: {
                    Query: {
                      Version: 2,
                      From: [
                        {
                          Name: "d",
                          Entity: "DimProduct",
                          Type: 0,
                        },
                      ],
                      Select: [
                        {
                          Column: {
                            Expression: { SourceRef: { Entity: "DimProduct" } },
                            Property: "Product",
                          },
                          Name: "field",
                        },
                      ],
                      // OrderBy must wrap a Column in an Aggregation, not a
                      // Measure reference, or Desktop errors.
                      OrderBy: [
                        {
                          Direction: 2,
                          Expression: {
                            Aggregation: {
                              Function: 0,
                              Expression: {
                                Column: {
                                  Expression: { SourceRef: { Entity: "FactSales" } },
                                  Property: "Sales Amount",
                                },
                              },
                            },
                          },
                        },
                      ],
                      Top: 10,
                    },
                  },
                },
                Type: 2,
              },
              { Name: "d", Entity: "DimProduct", Type: 0 },
            ],
            Where: [
              {
                Condition: {
                  In: {
                    // Inside Where, the expression must reference the From
                    // alias ("d"), not the entity name. Using Entity here is
                    // flagged as PBIR_FILTER_ENTITY_IN_WHERE.
                    Expressions: [
                      {
                        Column: {
                          Expression: { SourceRef: { Source: "d" } },
                          Property: "Product",
                        },
                      },
                    ],
                    Table: { SourceRef: { Source: "subquery" } },
                  },
                },
              },
            ],
          },
          howCreated: "User",
        },
      ],
      objects: {
        general: [{ properties: {} }],
        columnHeaders: [
          {
            properties: {
              backColor: litColor("#F8FAFC"),
              fontColor: litColor(MUTED),
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
              backColorPrimary: litColor(CARD_BG),
              backColorSecondary: litColor("#F8FAFC"),
            },
          },
          {
            properties: { fontColor: litColor(SALES), bold: lit("true") },
            selector: wildcardSelector("FactSales.Product Revenue Rank"),
          },
          {
            properties: { fontColor: litColor(PROFIT) },
            selector: wildcardSelector("FactSales.Total Profit"),
          },
        ],
        columnFormatting: [
          {
            properties: {
              dataBars: {
                positiveColor: litColor(SALES),
                negativeColor: litColor("#EF4444"),
                axisColor: litColor(MUTED),
                reverseDirection: lit("false"),
                hideText: lit("false"),
              },
            },
            selector: { metadata: "FactSales.Total Sales" },
          },
        ],
      },
      visualContainerObjects: {
        ...chrome({
          title: "TOP 10 PRODUCTS BY TOTAL REVENUE",
          subTitle:
            "Detailed sales, units sold, gross profit and margin contribution",
        }),
        stylePreset: [{ properties: { name: lit("'None'") } }],
      },
    },
  };
}

function buildTerritoryTable() {
  const cols = [
    column("DimSalesTerritory", "Group"),
    column("DimSalesTerritory", "Region"),
    measure("FactSales", "Total Sales"),
    measure("FactSales", "Total Profit"),
    measure("FactSales", "Profit Margin %"),
  ];
  return {
    $schema: SCHEMA,
    name: "table000000000000003",
    position: {
      x: START_X,
      y: P2_BOTTOM_Y,
      z: 4000,
      height: P2_BOTTOM_H,
      width: 1240,
      tabOrder: 4000,
    },
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: {
            projections: cols,
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "FactSales" } },
                  Property: "Total Sales",
                },
              },
              direction: "Descending",
            },
          ],
          isDefaultSort: true,
        },
      },
      objects: {
        general: [{ properties: {} }],
        columnHeaders: [
          {
            properties: {
              backColor: litColor("#F8FAFC"),
              fontColor: litColor(MUTED),
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
              backColorPrimary: litColor(CARD_BG),
              backColorSecondary: litColor("#F8FAFC"),
            },
          },
          {
            properties: { fontColor: litColor(PROFIT) },
            selector: wildcardSelector("FactSales.Total Profit"),
          },
        ],
        columnFormatting: [
          {
            properties: {
              dataBars: {
                positiveColor: litColor(SALES),
                negativeColor: litColor("#EF4444"),
                axisColor: litColor(MUTED),
                reverseDirection: lit("false"),
                hideText: lit("false"),
              },
            },
            selector: { metadata: "FactSales.Total Sales" },
          },
        ],
      },
      visualContainerObjects: {
        ...chrome({
          title: "TERRITORY PERFORMANCE BY GROUP & REGION",
          subTitle: "Sales, profit and margin by sales territory",
        }),
        stylePreset: [{ properties: { name: lit("'None'") } }],
      },
    },
  };
}

const INSIGHTS = [
  {
    name: "insight000000000001",
    x: 20,
    kicker: "HIGHEST MARGIN CATEGORY",
    kickerColor: COST,
    headline: "Clothing",
    body:
      "Clothing is a small share of total volume but carries the highest gross margin rate across all product lines.",
    z: 5000,
  },
  {
    name: "insight000000000002",
    x: 446,
    kicker: "CORE REVENUE ENGINE",
    kickerColor: INDIGO,
    headline: "Mountain-200 Series",
    body:
      "The Mountain-200 frames across all sizes dominate the top of the product table with a consistent margin.",
    z: 5001,
  },
  {
    name: "insight000000000003",
    x: 872,
    kicker: "GEOGRAPHIC DOMINANCE",
    kickerColor: PROFIT,
    headline: "North America",
    body:
      "The United States and Canada together drive roughly three quarters of enterprise revenue.",
    z: 5002,
  },
];

function buildInsight(spec) {
  return {
    $schema: SCHEMA,
    name: spec.name,
    position: {
      x: spec.x,
      y: P2_INSIGHT_Y,
      z: spec.z,
      height: P2_INSIGHT_H,
      width: 388,
      tabOrder: spec.z,
    },
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
                      value: spec.kicker,
                      textStyle: {
                        fontSize: "8pt",
                        color: spec.kickerColor,
                        fontWeight: "bold",
                        fontFamily: "Segoe UI Semibold",
                      },
                    },
                  ],
                },
                {
                  textRuns: [
                    {
                      value: spec.headline,
                      textStyle: {
                        fontSize: "14pt",
                        color: INK,
                        fontWeight: "bold",
                        fontFamily: "Segoe UI",
                      },
                    },
                  ],
                },
                {
                  textRuns: [
                    {
                      value: spec.body,
                      textStyle: { fontSize: "8pt", color: MUTED, fontFamily: "Segoe UI" },
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
          { properties: { show: lit("true"), color: litColor(CARD_BG), transparency: lit("0D") } },
        ],
        border: [
          {
            properties: {
              show: lit("true"),
              color: litColor(HAIRLINE),
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
              left: lit("10D"),
              right: lit("10D"),
            },
          },
        ],
        title: [{ properties: { show: lit("false") } }],
        visualHeader: [{ properties: { show: lit("false") } }],
      },
    },
  };
}

// ===========================================================================
// Run
// ===========================================================================
const pageBackground = () => ({
  background: [
    {
      properties: {
        // Page background has no `show` property - the schema rejects it.
        color: litColor("#F8FAFC"),
        transparency: lit("0D"),
      },
    },
  ],
});

console.log("Page 1 - Executive Overview");
KPI_CARDS.forEach((spec) => writeVisual(P1, spec.name, buildKpiCard(spec)));
writeVisual(P1, "title000000000000001", buildTitleTextbox());
writeVisual(P1, "slicer00000000000001", buildSlicer("slicer00000000000001", 2000));
writeVisual(P1, "trend000000000000001", buildTrend());
writeVisual(P1, "catbar00000000000001", buildCategoryBar());
writeVisual(P1, "table000000000000001", buildCountryTable());
writeVisual(P1, "chan0000000000000001", buildChannelMix());
writeVisual(P1, "fytrajectory000000001", buildFiscalTable());
writePage(P1, {
  $schema:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json",
  name: P1,
  displayName: "Executive Overview",
  displayOption: "FitToPage",
  height: 720,
  width: 1280,
  objects: pageBackground(),
});

console.log("Page 2 - Product Profitability");
writePage(P2, {
  $schema:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json",
  name: P2,
  displayName: "Product Profitability",
  displayOption: "FitToPage",
  height: 720,
  width: 1280,
  objects: pageBackground(),
});
writeVisual(P2, "title000000000000002", buildPage2Title());
writeVisual(P2, "slicer00000000000002", buildSlicer("slicer00000000000002", 2000));
writeVisual(P2, "table000000000000002", buildProductTable());
INSIGHTS.forEach((spec) => writeVisual(P2, spec.name, buildInsight(spec)));
writeVisual(P2, "table000000000000003", buildTerritoryTable());
// Dropped: the Subcategory bar chart has no counterpart in the prototype and
// the freed width went to the territory table.
removeVisual(P2, "subcat00000000000001");

console.log("\nDone. Validate with:");
console.log("  powerbi-report-author validate AdventureWorksSales.Report");
console.log("  python scripts/validate_report.py AdventureWorksSales.Report");
