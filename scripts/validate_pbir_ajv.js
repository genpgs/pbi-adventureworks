const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const SCHEMA_DIR = process.env.SCHEMA_DIR || path.join(__dirname, "..", ".cache", "pbir-schemas");
const REPORT = process.env.REPORT_DIR || path.join(__dirname, "..", "AdventureWorksSales.Report");

// The Microsoft PBIR schemas are draft-07, so use Ajv's draft-07 default
// rather than the 2020-12 build.
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);

// Load every schema under its own $id so the cross-schema $refs resolve.
//
// Microsoft's published schemas are internally inconsistent about the embedded
// variant: the $id reads "schema.embedded.json" (dot) while every $ref that
// points at it reads "schema-embedded.json" (hyphen). Register both spellings
// so relative refs resolve.
const load = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) load(p);
    else if (e.name.endsWith(".json")) {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      if (!raw.$id) continue;
      for (const key of new Set([raw.$id, raw.$id.replace("schema.embedded.json", "schema-embedded.json")])) {
        if (!ajv.getSchema(key)) ajv.addSchema(raw, key);
      }
    }
  }
};
load(SCHEMA_DIR);

const VC_ID =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PG_ID =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const validateVC = ajv.getSchema(VC_ID);
const validatePG = ajv.getSchema(PG_ID);
if (!validateVC) throw new Error("visualContainer schema not registered");

const fmt = (e) =>
  `${e.instancePath || "/"} ${e.message}${
    e.params && e.params.additionalProperty
      ? ` (${e.params.additionalProperty})`
      : ""
  }`;

let files = 0;
let errs = 0;
const PAGES = path.join(REPORT, "definition", "pages");
for (const page of fs.readdirSync(PAGES)) {
  const pdir = path.join(PAGES, page);
  if (!fs.statSync(pdir).isDirectory()) continue;

  const pgFile = path.join(pdir, "page.json");
  if (fs.existsSync(pgFile)) {
    files++;
    const ok = validatePG(JSON.parse(fs.readFileSync(pgFile, "utf8")));
    if (!ok) {
      errs++;
      console.log(`[FAIL] ${page}/page.json`);
      validatePG.errors.forEach((e) => console.log(`         ${fmt(e)}`));
    }
  }

  const vdir = path.join(pdir, "visuals");
  if (!fs.existsSync(vdir)) continue;
  for (const v of fs.readdirSync(vdir)) {
    const vf = path.join(vdir, v, "visual.json");
    if (!fs.existsSync(vf)) continue;
    files++;
    const ok = validateVC(JSON.parse(fs.readFileSync(vf, "utf8")));
    if (!ok) {
      errs++;
      console.log(`[FAIL] ${page}/visuals/${v}/visual.json`);
      validateVC.errors.forEach((e) => console.log(`         ${fmt(e)}`));
    }
  }
}

console.log(
  errs === 0
    ? `[PASS] ${files} file(s) validate against the real Microsoft schemas.`
    : `[FAIL] ${errs}/${files} file(s) failed schema validation.`
);
process.exit(errs === 0 ? 0 : 1);
