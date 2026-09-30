#!/usr/bin/env node
/**
 * scripts/relayout_bottom_row.js
 *
 * Fits the Executive Overview bottom row (y=510..705, 195 tall, 1240 wide)
 * with three panels, honouring the user's decisions:
 *   - the country TABLE stays at the left (x=20), per the rendered HTML
 *   - the channel chart (which already shows Channel + Total Sales, i.e. the
 *     prototype's "Channel Mix") moves right
 *   - Annual Growth Trajectory is added
 *
 * The existing `chan0000000000000001` clusteredBarChart already binds
 * DimSalesOrder.Channel against FactSales.Total Sales, so it IS the Channel Mix
 * panel — no duplicate visual is created.
 *
 *   country table  x=20   w=500
 *   channel mix    x=536  w=300
 *   FY trajectory  x=852  w=408
 *   20 + 500 + 8 + 300 + 8 + 408 = 1244 -> right edge 1264 <= 1280
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

const Y = 510;
const H = 195;

const LAYOUT = {
  table000000000000001: { x: 20, width: 500, z: 6000 },
  chan0000000000000001: { x: 536, width: 300, z: 7000 },
  fytrajectory000000001: { x: 852, width: 408, z: 8000 },
};

Object.entries(LAYOUT).forEach(([name, spec]) => {
  const file = path.join(VISUALS, name, "visual.json");
  if (!fs.existsSync(file)) {
    console.warn(`skip ${name} (not found)`);
    return;
  }
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(json.position, {
    x: spec.x,
    y: Y,
    width: spec.width,
    height: H,
    z: spec.z,
    tabOrder: spec.z,
  });
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(
    `${name}: x=${json.position.x} y=${json.position.y} w=${json.position.width} h=${json.position.height}`
  );
});
