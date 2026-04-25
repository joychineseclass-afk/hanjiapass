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

  if (warnings.length) {
    for (const w of warnings) console.warn(w);
  }

  console.log("✅ Culture idioms check passed.");
  console.log(`Index entries: ${index.length}`);
  console.log(`Detail files: ${filesToLoad.length}`);
  console.log(`Detail entries: ${totalDetailEntries}`);
}

try {
  main();
} catch (e) {
  console.error("❌ Culture idioms check failed.\n", e);
  process.exit(1);
}
