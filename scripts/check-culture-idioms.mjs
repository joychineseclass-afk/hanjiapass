/**
 * 校验 data/culture/idioms/ 下 index 与 detail 的字段、一致性与禁则字段
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IDIOMS_DIR = path.join(ROOT, "data", "culture", "idioms");
const INDEX_FILE = "idioms-index.json";
const EXPANSION_CANDIDATES_FILE = "idioms-expansion-candidates-050.json";

const EXPANSION_STATUS = new Set(["candidate", "approved", "drafted", "published"]);

const INDEX_REQUIRED = ["id", "idiom", "pinyin", "file", "theme", "difficulty"];
const DETAIL_REQUIRED = [
  "id",
  "idiom",
  "pinyin",
  "chineseExplanation",
  "chineseExplanationPinyin",
  "meaning",
  "example",
  "examplePinyin",
];
const MEANING_LANGS = ["cn", "kr", "en", "jp"];
const EXAMPLE_LANGS = ["cn", "kr", "en", "jp"];
const FORBIDDEN_TOP = ["quiz", "exercise", "score", "progress", "wrongQuestions"];

const missing = [];
const mismatch = [];
const warnings = [];
/** @type {string[]} */
const expansionErrors = [];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function addMissing(id, field) {
  missing.push({ id, field });
}

function addMismatch(msg) {
  mismatch.push(msg);
}

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * @param {object[]} index
 * @param {string} expPath
 * @returns {number} candidate 条目数
 */
function checkExpansionCandidates(index, expPath) {
  if (!fileExists(expPath)) {
    warnings.push(`Expansion file not found: ${EXPANSION_CANDIDATES_FILE} (optional check skipped)`);
    return 0;
  }
  let data;
  try {
    data = readJson(expPath);
  } catch (e) {
    expansionErrors.push(`Expansion file invalid JSON: ${e?.message || e}`);
    return 0;
  }
  if (!Array.isArray(data)) {
    expansionErrors.push("Expansion file must be a JSON array");
    return 0;
  }

  const formalIdioms = new Set(
    (index || [])
      .map((r) => (r && isNonEmptyString(r.idiom) ? String(r.idiom).trim() : ""))
      .filter(Boolean)
  );

  const seen = new Set();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const label = `expansion[${i}]`;
    if (row == null || typeof row !== "object") {
      expansionErrors.push(`${label}: not an object`);
      continue;
    }
    if (!isNonEmptyString(row.idiom)) {
      expansionErrors.push(`${label}: idiom must be a non-empty string`);
    } else {
      const idm = String(row.idiom).trim();
      if (seen.has(idm)) {
        expansionErrors.push(`duplicate idiom in expansion file: ${idm}`);
      }
      seen.add(idm);
      if (formalIdioms.has(idm)) {
        warnings.push(`Candidate idiom is already in formal index: ${idm}`);
      }
    }
    if (!isNonEmptyString(row.pinyin)) {
      expansionErrors.push(`${label}: pinyin must be a non-empty string`);
    }
    if (!Array.isArray(row.theme)) {
      expansionErrors.push(`${label}: theme must be an array`);
    } else {
      if (row.theme.length < 2 || row.theme.length > 4) {
        warnings.push(`Theme count for ${row.idiom || label} is ${row.theme.length}; suggest 2–4 tags`);
      }
    }
    if (typeof row.difficulty !== "number" || !Number.isFinite(row.difficulty)) {
      expansionErrors.push(`${label}: difficulty must be a number`);
    } else if (row.difficulty < 1 || row.difficulty > 5) {
      expansionErrors.push(`${label}: difficulty must be between 1 and 5`);
    }
    if (!isNonEmptyString(row.status) || !EXPANSION_STATUS.has(String(row.status).trim())) {
      expansionErrors.push(
        `${label}: status must be one of: ${[...EXPANSION_STATUS].join(", ")}`
      );
    }
  }

  return data.length;
}

function checkForbidden(obj, id) {
  if (!obj || typeof obj !== "object") return;
  for (const k of FORBIDDEN_TOP) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      warnings.push(`Detail ${id}: contains forbidden field "${k}"`);
    }
  }
}

function main() {
  const indexPath = path.join(IDIOMS_DIR, INDEX_FILE);
  if (!fileExists(indexPath)) {
    console.error("❌ Culture idioms check failed.\n");
    console.error(`Missing: ${INDEX_FILE}\n`);
    process.exit(1);
  }

  const index = readJson(indexPath);
  if (!Array.isArray(index)) {
    console.error("❌ Culture idioms check failed.\n");
    console.error("Index is not an array.\n");
    process.exit(1);
  }

  const seenId = new Set();
  const seenIdiom = new Set();

  for (const row of index) {
    for (const f of INDEX_REQUIRED) {
      if (row == null || !Object.prototype.hasOwnProperty.call(row, f) || row[f] === null || row[f] === undefined) {
        addMissing(String(row?.id ?? "?"), f);
        continue;
      }
    }
    if (!row) continue;
    if (!Array.isArray(row.theme)) {
      addMismatch(`index ${row.id}: theme is not an array`);
    }
    if (typeof row.difficulty !== "number" || !Number.isFinite(row.difficulty)) {
      addMismatch(`index ${row.id}: difficulty is not a number`);
    }
    if (isNonEmptyString(row.id)) {
      if (seenId.has(row.id)) {
        addMismatch(`duplicate id in index: ${row.id}`);
      }
      seenId.add(row.id);
    }
    if (isNonEmptyString(row.idiom)) {
      if (seenIdiom.has(row.idiom)) {
        addMismatch(`duplicate idiom in index: ${row.idiom}`);
      }
      seenIdiom.add(row.idiom);
    }
    const rel = String(row.file || "");
    if (rel) {
      const full = path.join(IDIOMS_DIR, path.basename(rel));
      if (!fileExists(full)) {
        addMismatch(`index ${row.id}: file not found: ${row.file}`);
      }
    }
  }

  const filesToLoad = [...new Set(index.map((r) => r && r.file).filter(Boolean))];
  const detailFileItems = new Map();
  for (const fn of filesToLoad) {
    const safe = path.basename(String(fn));
    const full = path.join(IDIOMS_DIR, safe);
    if (!fileExists(full)) continue;
    const arr = readJson(full);
    if (!Array.isArray(arr)) {
      addMismatch(`detail file ${fn}: not an array`);
      continue;
    }
    const byId = new Map();
    const idsInFile = new Set();
    for (const item of arr) {
      if (item == null) continue;
      const id = item.id;
      if (id != null) {
        if (idsInFile.has(id)) {
          addMismatch(`detail ${fn}: duplicate id ${id}`);
        }
        idsInFile.add(id);
        byId.set(String(id), item);
      }
      checkForbidden(item, id);
    }
    detailFileItems.set(safe, { arr, byId, raw: arr });
  }

  for (const row of index) {
    if (!row) continue;
    const rel = String(row.file || "");
    if (!rel) continue;
    const safe = path.basename(rel);
    const pack = detailFileItems.get(safe);
    if (!pack) {
      addMissing(row.id, `detail in ${row.file}`);
      continue;
    }
    const item = pack.byId.get(String(row.id));
    if (!item) {
      addMissing(row.id, `entry in file ${row.file}`);
      continue;
    }
    if (isNonEmptyString(item.idiom) && isNonEmptyString(row.idiom) && item.idiom !== row.idiom) {
      addMismatch(`- ${row.id} idiom mismatch (index vs detail)`);
    }
    if (isNonEmptyString(item.pinyin) && isNonEmptyString(row.pinyin) && String(item.pinyin).trim() !== String(row.pinyin).trim()) {
      addMismatch(`- ${row.id} pinyin mismatch`);
    }

    for (const f of DETAIL_REQUIRED) {
      if (!Object.prototype.hasOwnProperty.call(item, f) || item[f] === null || item[f] === undefined) {
        addMissing(row.id, f);
      }
    }
    const meaning = item.meaning;
    if (meaning && typeof meaning === "object") {
      for (const L of MEANING_LANGS) {
        if (!isNonEmptyString(meaning[L])) {
          addMissing(row.id, `meaning.${L}`);
        }
      }
    } else {
      addMissing(row.id, "meaning (object)");
    }
    const example = item.example;
    if (example && typeof example === "object") {
      for (const L of EXAMPLE_LANGS) {
        if (!isNonEmptyString(example[L])) {
          addMissing(row.id, `example.${L}`);
        }
      }
    } else {
      addMissing(row.id, "example (object)");
    }

    for (const f of DETAIL_REQUIRED) {
      if (f === "meaning" || f === "example") continue;
      const v = item[f];
      if (typeof v === "string" && v.trim() === "") {
        addMissing(row.id, f + " (empty string)");
      }
    }
  }

  let totalDetailEntries = 0;
  for (const { arr } of detailFileItems.values()) {
    totalDetailEntries += arr.length;
  }

  if (missing.length || mismatch.length) {
    console.error("❌ Culture idioms check failed.\n");
    if (missing.length) {
      console.error("Missing field:");
      for (const m of missing) {
        const id = m.id || "?";
        console.error(`- ${id} ${m.field}`);
      }
    }
    if (mismatch.length) {
      console.error("\nIndex/detail mismatch:");
      for (const line of mismatch) {
        console.error(`- ${line}`);
      }
    }
    if (warnings.length) {
      console.error("\nWarnings:");
      for (const w of warnings) console.error(`- ${w}`);
    }
    process.exit(1);
  }

  const expansionPath = path.join(IDIOMS_DIR, EXPANSION_CANDIDATES_FILE);
  const candidateEntries = checkExpansionCandidates(index, expansionPath);

  if (expansionErrors.length) {
    console.error("❌ Culture idioms check failed.\n");
    console.error("Expansion / candidate list errors:");
    for (const e of expansionErrors) {
      console.error(`- ${e}`);
    }
    if (warnings.length) {
      console.error("\nWarnings:");
      for (const w of warnings) console.error(`- ${w}`);
    }
    process.exit(1);
  }

  for (const w of warnings) {
    console.warn(w);
  }

  console.log("✅ Culture idioms check passed.");
  console.log(`Index entries: ${index.length}`);
  console.log(`Detail files: ${filesToLoad.length}`);
  console.log(`Detail entries: ${totalDetailEntries}`);
  console.log(`Candidate entries: ${candidateEntries}`);
  console.log(`Warnings: ${warnings.length}`);
}

try {
  main();
} catch (e) {
  console.error("❌ Culture idioms check failed.\n", e);
  process.exit(1);
}
