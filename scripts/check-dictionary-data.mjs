/**
 * 字典数据质量检查
 * 用法: node scripts/check-dictionary-data.mjs
 * 或: npm run check:dictionary
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DICT_DIR = join(ROOT, "data", "dictionary");
const INDEX_PATH = join(DICT_DIR, "dictionary-index.json");

const CJK = /^[\u4e00-\u9fff]$/;
const FORBIDDEN_KEYS = new Set(["quiz", "exercise", "score", "progress", "wrongQuestions"]);
const MEANING_LANGS = ["cn", "kr", "en", "jp"];

function isSingleCjk(s) {
  return CJK.test(String(s || "").trim());
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const errors = { missing: [], mismatch: [] };
const warnings = { components: [], forbidden: [] };
let hasFatal = false;

function failMissing(msg) {
  hasFatal = true;
  errors.missing.push(msg);
}

function failMismatch(msg) {
  hasFatal = true;
  errors.mismatch.push(msg);
}

function warnComponent(msg) {
  warnings.components.push(msg);
}

function walkForbidden(value, pathStr, isRoot = false) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkForbidden(v, `${pathStr}[${i}]`));
    return;
  }
  if (typeof value === "object") {
    for (const k of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(k)) {
        warnings.forbidden.push(`${pathStr || "root"}.${k}`);
      }
      walkForbidden(value[k], pathStr ? `${pathStr}.${k}` : k);
    }
  }
}

/**
 * 按 index 分 file 读入 detail
 */
function loadDetailsByFile(index) {
  const byFile = new Map();
  for (const row of index) {
    if (!row?.file) continue;
    if (!byFile.has(row.file)) {
      byFile.set(row.file, []);
    }
    byFile.get(row.file).push(row);
  }
  const cache = new Map();
  for (const [file, _] of byFile) {
    const p = join(DICT_DIR, file);
    if (!existsSync(p)) {
      failMissing(`detail file not found: data/dictionary/${file}`);
      cache.set(file, null);
    } else {
      try {
        const data = readJson(p);
        if (!Array.isArray(data)) {
          failMismatch(`data/dictionary/${file} is not a JSON array`);
          cache.set(file, null);
        } else {
          cache.set(file, data);
        }
      } catch (e) {
        failMissing(`data/dictionary/${file} parse error: ${e?.message || e}`);
        cache.set(file, null);
      }
    }
  }
  return { byFile, cache };
}

function findDetailById(detailList, id) {
  if (!detailList) return null;
  return detailList.find((x) => x && x.id === id) || null;
}

function checkCharDetail(detail, indexRow) {
  const id = indexRow.id;
  const need = [
    "id",
    "type",
    "char",
    "pinyin",
    "meaning",
    "teachingNote",
    "commonWords",
  ];
  for (const f of need) {
    if (detail[f] === undefined) {
      failMissing(`char ${id} missing field: ${f}`);
    }
  }
  if (detail.type !== "char") failMismatch(`char ${id} detail.type expected char, got ${detail.type}`);

  for (const L of MEANING_LANGS) {
    if (!detail.meaning || detail.meaning[L] == null || String(detail.meaning[L]).trim() === "") {
      failMissing(`char ${id} meaning.${L}`);
    }
  }
  for (const L of MEANING_LANGS) {
    if (!detail.teachingNote || detail.teachingNote[L] == null || String(detail.teachingNote[L]).trim() === "") {
      failMissing(`char ${id} teachingNote.${L}`);
    }
  }
  if (!Array.isArray(detail.commonWords)) {
    failMissing(`char ${id} commonWords must be array`);
  } else {
    for (let i = 0; i < detail.commonWords.length; i++) {
      const w = detail.commonWords[i];
      if (!w || typeof w !== "object") {
        failMissing(`char ${id} commonWords[${i}] invalid`);
        continue;
      }
      for (const k of ["word", "pinyin"]) {
        if (w[k] == null || String(w[k]).trim() === "") {
          failMissing(`char ${id} commonWords[${i}].${k}`);
        }
      }
      if (!w.meaning || typeof w.meaning !== "object") {
        failMissing(`char ${id} commonWords[${i}].meaning`);
      } else {
        for (const L of MEANING_LANGS) {
          if (w.meaning[L] == null || String(w.meaning[L]).trim() === "") {
            failMissing(`char ${id} commonWords[${i}].meaning.${L}`);
          }
        }
      }
    }
  }
  if (detail.id !== indexRow.id) failMismatch(`char ${id}: detail.id !== index.id`);
  if (detail.char !== indexRow.char) failMismatch(`char ${id}: detail.char !== index.char`);
  if (detail.pinyin !== indexRow.pinyin) failMismatch(`char ${id}: pinyin mismatch index / detail`);
}

function checkWordDetail(detail, indexRow) {
  const id = indexRow.id;
  const need = ["id", "type", "word", "pinyin", "meaning", "example", "examplePinyin"];
  for (const f of need) {
    if (detail[f] === undefined) {
      failMissing(`word ${id} missing field: ${f}`);
    }
  }
  if (detail.type !== "word") failMismatch(`word ${id} detail.type expected word, got ${detail.type}`);
  for (const L of MEANING_LANGS) {
    if (!detail.meaning || detail.meaning[L] == null || String(detail.meaning[L]).trim() === "") {
      failMissing(`word ${id} meaning.${L}`);
    }
  }
  for (const L of MEANING_LANGS) {
    if (!detail.example || detail.example[L] == null || String(detail.example[L]).trim() === "") {
      failMissing(`word ${id} example.${L}`);
    }
  }
  if (String(detail.examplePinyin).trim() === "") failMissing(`word ${id} examplePinyin empty`);

  if (detail.id !== indexRow.id) failMismatch(`word ${id}: detail.id !== index.id`);
  if (detail.word !== indexRow.word) failMismatch(`word ${id}: detail.word !== index.word`);
  if (detail.pinyin !== indexRow.pinyin) failMismatch(`word ${id}: pinyin mismatch index / detail`);
}

function wordToComponentChars(word) {
  return [...String(word || "")].filter((c) => isSingleCjk(c));
}

function main() {
  if (!existsSync(INDEX_PATH)) {
    console.error("❌ Dictionary data check failed.\n\nIndex file not found: data/dictionary/dictionary-index.json");
    process.exit(1);
  }

  let index;
  try {
    index = readJson(INDEX_PATH);
  } catch (e) {
    console.error("❌ Dictionary data check failed.\n\n", e);
    process.exit(1);
  }
  if (!Array.isArray(index) || !index.length) {
    console.error("❌ Dictionary data check failed.\n\nIndex is empty or not an array.");
    process.exit(1);
  }

  const idSet = new Set();
  const typeQuery = new Set();
  const charIndexByChar = new Map();

  for (const row of index) {
    for (const f of ["id", "type", "query", "pinyin", "file"]) {
      const v = row[f];
      if (v === undefined || v === null || String(v).trim() === "") {
        failMissing(`index row missing or empty: ${f} (id=${row.id || "?"})`);
      }
    }
    if (row.id) {
      if (idSet.has(row.id)) failMismatch(`duplicate id in index: ${row.id}`);
      idSet.add(row.id);
    }
    const tq = `${row.type}\t${row.query}`;
    if (typeQuery.has(tq)) failMismatch(`duplicate (type, query) in index: type=${row.type} query=${row.query}`);
    typeQuery.add(tq);

    if (row.type === "char") {
      if (!row.char) failMissing(`index ${row.id} type char: missing char`);
      if (row.query !== row.char) failMismatch(`index ${row.id}: char query must equal char`);
      if (!isSingleCjk(row.char)) failMismatch(`index ${row.id}: char must be single CJK`);
      charIndexByChar.set(row.char, row);
    } else if (row.type === "word") {
      if (!row.word) failMissing(`index ${row.id} type word: missing word`);
      if (row.query !== row.word) failMismatch(`index ${row.id}: word query must equal word`);
    } else {
      failMismatch(`index ${row.id}: unknown type ${row.type}`);
    }
  }

  const { byFile, cache } = loadDetailsByFile(index);
  const detailFileNames = new Set([...byFile.keys()].filter(Boolean));

  for (const row of index) {
    if (!row.file) continue;
    const list = cache.get(row.file);
    if (!list) continue;
    const detail = findDetailById(list, row.id);
    if (!detail) {
      failMissing(`no detail with id ${row.id} in ${row.file}`);
      continue;
    }
    walkForbidden(detail, `detail[${row.id}]`);

    if (row.type === "char") {
      checkCharDetail(detail, row);
    } else if (row.type === "word") {
      checkWordDetail(detail, row);
    }
  }

  for (const row of index) {
    if (row.type !== "word") continue;
    const list = cache.get(row.file);
    const detail = list ? findDetailById(list, row.id) : null;
    if (!detail) continue;
    const comps = [...new Set(wordToComponentChars(detail.word))];
    for (const ch of comps) {
      if (!charIndexByChar.has(ch)) {
        warnComponent(`Missing char index for component: ${row.id} ${detail.word} → ${ch}`);
      }
    }
  }

  const nIndex = index.length;
  const nChar = index.filter((r) => r.type === "char").length;
  const nWord = index.filter((r) => r.type === "word").length;
  const nFiles = detailFileNames.size;

  const wCount = warnings.components.length + warnings.forbidden.length;

  if (hasFatal) {
    console.error("❌ Dictionary data check failed.\n");
    if (errors.missing.length) {
      console.error("Missing field / missing detail:");
      for (const m of errors.missing) console.error(`- ${m}`);
      console.error("");
    }
    if (errors.mismatch.length) {
      console.error("Mismatch / duplicate:");
      for (const m of errors.mismatch) console.error(`- ${m}`);
    }
    process.exit(1);
  }

  if (wCount) {
    console.log("✅ Dictionary data check passed with warnings.");
  } else {
    console.log("✅ Dictionary data check passed.");
  }
  console.log(`Index entries: ${nIndex}`);
  console.log(`Char entries: ${nChar}`);
  console.log(`Word entries: ${nWord}`);
  console.log(`Detail files: ${nFiles}`);
  console.log(`Warnings: ${wCount}`);

  if (wCount) {
    if (warnings.forbidden.length) {
      console.log("\nWarnings (forbidden key names found):");
      for (const p of warnings.forbidden) console.log(`- ${p}`);
    }
    if (warnings.components.length) {
      console.log("\nWarnings (word components without char index):");
      for (const m of warnings.components) console.log(`- ${m}`);
    }
  }

  process.exit(0);
}

main();
