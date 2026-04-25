/**
 * 字典数据质量检查
 * 用法: node scripts/check-dictionary-data.mjs
 * 或: npm run check:dictionary
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DICT_DIR = join(ROOT, "data", "dictionary");
const INDEX_PATH = join(DICT_DIR, "dictionary-index.json");
const DRAFT_CEDICT_PATH = join(DICT_DIR, "drafts", "words-cedict-draft-001.json");
const CEDICT_WORDS_FILE = "words-cedict-001.json";
const CEDICT_INDEX_FULL = "cedict/cedict-index.json";
const CEDICT_FULL_DIR = "cedict";
const CEDICT_SOURCE_TAG = "CC-CEDICT";
const CEDICT_FULL_LEVELS = new Set(["raw", "reviewed", "teaching", "courseReady"]);

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
const warnings = { components: [], forbidden: [], cedictReview: [] };
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

const cedictReviewOnce = new Set();
function warnCedictReview(msg) {
  if (cedictReviewOnce.has(msg)) return;
  cedictReviewOnce.add(msg);
  warnings.cedictReview.push(msg);
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

/**
 * 未审校 CC-CEDICT 批量条：仅要求 meaning.en 等
 */
function isCedictPendingWord(detail) {
  if (!detail || detail.type !== "word") return false;
  if (String(detail.source) !== "CC-CEDICT") return false;
  if (detail.needsReview !== true) return false;
  return true;
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

  if (isCedictPendingWord(detail)) {
    if (detail.traditional == null || String(detail.traditional).trim() === "") {
      failMissing(`word ${id} traditional required`);
    }
    if (!detail.meaning || String(detail.meaning.en).trim() === "") {
      failMissing(`word ${id} meaning.en required for CC-CEDICT pending`);
    }
    warnCedictReview(`Needs review: ${id} ${detail.word}`);
    if (detail.id !== indexRow.id) failMismatch(`word ${id}: detail.id !== index.id`);
    if (detail.word !== indexRow.word) failMismatch(`word ${id}: detail.word !== index.word`);
    if (detail.pinyin !== indexRow.pinyin) failMismatch(`word ${id}: pinyin mismatch index / detail`);
    return;
  }

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

/**
 * 校验 cedict 正式词库文件内每条（含未挂 index 的备查词条）
 */
function checkWordDetailStandalone(detail, fileLabel) {
  const id = detail.id;
  const fake = {
    id: detail.id,
    type: "word",
    word: detail.word,
    pinyin: detail.pinyin,
    file: fileLabel,
  };
  checkWordDetail(detail, fake);
}

/**
 * 已发布到 cedict 正式文件的 draft：与 index / cedict 一致
 * indexOmitted：同 query 已在别条 index 中，本 publishedId 仅存在于 words-cedict-001.json
 */
function checkPublishedCedictDraft(d, indexRows, cedictById) {
  if (d.status !== "published" || d.type !== "word") return;

  if (!d.publishedId || String(d.publishedId).trim() === "") {
    failMissing(`draft ${d.id} published: missing publishedId`);
  }
  if (!d.publishedFile || String(d.publishedFile).trim() === "") {
    failMissing(`draft ${d.id} published: missing publishedFile`);
  }
  if (d.needsReview !== false) {
    failMismatch(`draft ${d.id} published: needsReview must be false`);
  }
  if (d.publishedFile !== CEDICT_WORDS_FILE) {
    failMismatch(`draft ${d.id} published: publishedFile must be ${CEDICT_WORDS_FILE}`);
  }

  const det = cedictById.get(d.publishedId);
  if (!det) {
    failMissing(`draft ${d.id} published: publishedId ${d.publishedId} not found in ${CEDICT_WORDS_FILE}`);
    return;
  }
  if (det.word !== d.word) {
    failMismatch(`draft ${d.id} word vs cedict detail ${d.publishedId}`);
  }

  const idx = indexRows.find((r) => r.id === d.publishedId);
  if (idx) {
    if (idx.file !== d.publishedFile) {
      failMismatch(`draft ${d.id}: publishedFile vs index file for ${d.publishedId}`);
    }
    if (idx.type !== "word" || idx.query !== d.word) {
      failMismatch(`draft ${d.id} vs index ${d.publishedId}`);
    }
  } else {
    if (!d.indexOmitted) {
      failMissing(`draft ${d.id} published: publishedId ${d.publishedId} not in dictionary-index (set indexOmitted if duplicate query)`);
    }
    const dup = indexRows.some((r) => r.type === "word" && r.query === d.word);
    if (!dup) {
      failMissing(`draft ${d.id} indexOmitted but no index word row with query "${d.word}"`);
    }
  }
}

function wordToComponentChars(word) {
  return [...String(word || "")].filter((c) => isSingleCjk(c));
}

function isCedictFullRawPending(detail) {
  if (!detail || detail.type !== "word") return false;
  if (String(detail.source) !== CEDICT_SOURCE_TAG) return false;
  if (detail.qualityLevel === "raw" && detail.needsReview === true) return true;
  return false;
}

/**
 * cedict/ 下全量架构详情条校验（与主 words-cedict-001 分离）
 */
function checkCedictFullWordDetail(detail, indexRow) {
  const id = indexRow.id;
  const need = ["id", "type", "word", "pinyin", "source", "qualityLevel", "needsReview", "meaning", "example", "examplePinyin"];
  for (const f of need) {
    if (detail[f] === undefined) {
      failMissing(`cedict word ${id} missing field: ${f}`);
    }
  }
  if (detail.type !== "word") failMismatch(`cedict word ${id} detail.type expected word, got ${detail.type}`);
  if (String(detail.source) !== CEDICT_SOURCE_TAG) {
    failMismatch(`cedict word ${id} source must be ${CEDICT_SOURCE_TAG}`);
  }
  if (!CEDICT_FULL_LEVELS.has(detail.qualityLevel)) {
    failMismatch(`cedict word ${id} invalid qualityLevel: ${detail.qualityLevel}`);
  }

  if (isCedictFullRawPending(detail)) {
    if (detail.traditional == null || String(detail.traditional).trim() === "") {
      failMissing(`cedict word ${id} traditional required`);
    }
    if (!detail.meaning || String(detail.meaning.en).trim() === "") {
      failMissing(`cedict word ${id} meaning.en required (raw + needsReview)`);
    }
  } else {
    for (const L of MEANING_LANGS) {
      if (!detail.meaning || detail.meaning[L] == null || String(detail.meaning[L]).trim() === "") {
        failMissing(`cedict word ${id} meaning.${L} (non-raw or reviewed)`);
      }
    }
    for (const L of MEANING_LANGS) {
      if (!detail.example || detail.example[L] == null || String(detail.example[L]).trim() === "") {
        failMissing(`cedict word ${id} example.${L} (non-raw or reviewed)`);
      }
    }
    if (String(detail.examplePinyin).trim() === "") failMissing(`cedict word ${id} examplePinyin (non-raw or reviewed)`);
  }

  if (detail.id !== indexRow.id) failMismatch(`cedict ${id}: detail.id !== index.id`);
  if (detail.word !== indexRow.word) failMismatch(`cedict ${id}: detail.word !== index.word`);
  if (detail.pinyin !== indexRow.pinyin) failMismatch(`cedict ${id}: pinyin mismatch index / detail`);
}

/**
 * 校验 data/dictionary/cedict/ 全量架构（轻量 index + 详情分包 words-cedict-*.json）
 */
function checkCedictFullLayout(cedictIndexPath) {
  if (!existsSync(cedictIndexPath)) {
    failMissing(`cedict full index not found: data/dictionary/${CEDICT_INDEX_FULL}`);
    return;
  }
  let cedictIndex;
  try {
    cedictIndex = readJson(cedictIndexPath);
  } catch (e) {
    failMissing(`cedict full index read: ${e?.message || e}`);
    return;
  }
  if (!Array.isArray(cedictIndex) || cedictIndex.length === 0) {
    failMismatch("cedict/cedict-index.json must be a non-empty array");
  }

  for (const row of cedictIndex) {
    for (const f of [
      "id",
      "type",
      "query",
      "word",
      "traditional",
      "pinyin",
      "pinyinPlain",
      "file",
      "source",
      "qualityLevel",
      "needsReview",
    ]) {
      const v = row?.[f];
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "" && f !== "needsReview")) {
        if (f === "needsReview" && typeof row?.needsReview !== "boolean") {
          failMissing(`cedict index row ${row?.id || "?"}: needsReview must be boolean`);
        } else if (f !== "needsReview") {
          failMissing(`cedict index row ${row?.id || "?"}: missing or empty: ${f}`);
        }
      }
    }
    if (row.type !== "word") failMismatch(`cedict index ${row.id}: type must be word`);
    if (row.source !== CEDICT_SOURCE_TAG) failMismatch(`cedict index ${row.id}: source must be ${CEDICT_SOURCE_TAG}`);
    if (!CEDICT_FULL_LEVELS.has(row.qualityLevel)) {
      failMismatch(`cedict index ${row.id}: invalid qualityLevel ${row.qualityLevel}`);
    }
    if (typeof row.needsReview !== "boolean") {
      failMismatch(`cedict index ${row.id}: needsReview must be boolean`);
    }
  }

  for (const row of cedictIndex) {
    if (!row?.file) continue;
    const rel = row.file;
    const fullPath = join(DICT_DIR, rel);
    if (!existsSync(fullPath)) {
      failMissing(`cedict index ${row.id} file not found: data/dictionary/${rel}`);
      continue;
    }
    let list;
    try {
      list = readJson(fullPath);
    } catch (e) {
      failMissing(`cedict file ${rel}: ${e?.message || e}`);
      continue;
    }
    if (!Array.isArray(list)) {
      failMismatch(`cedict file ${rel} is not a JSON array`);
      continue;
    }
    const detail = findDetailById(list, row.id);
    if (!detail) {
      failMissing(`cedict: no detail id ${row.id} in ${rel}`);
      continue;
    }
    walkForbidden(detail, `cedictFull[${row.id}]`);
    checkCedictFullWordDetail(detail, row);
  }

  // cedict/words-cedict-*.json 中每条也必须合格（与 index 可多余）
  const cedictDir = join(DICT_DIR, CEDICT_FULL_DIR);
  if (existsSync(cedictDir)) {
    const names = readdirSync(cedictDir);
    for (const name of names) {
      if (!/^words-cedict-\d+\.json$/.test(name)) continue;
      const fileRel = `${CEDICT_FULL_DIR}/${name}`;
      const p = join(cedictDir, name);
      let list;
      try {
        list = readJson(p);
      } catch (e) {
        failMissing(`cedict file ${fileRel}: ${e?.message || e}`);
        continue;
      }
      if (!Array.isArray(list)) {
        failMismatch(`cedict file ${fileRel} is not a JSON array`);
        continue;
      }
      for (const ent of list) {
        if (!ent?.id) continue;
        walkForbidden(ent, `cedictFile[${ent.id}]`);
        if (!cedictIndex.some((r) => r && r.id === ent.id)) {
          failMissing(`cedict detail ${ent.id} in ${fileRel} not listed in cedict-index.json`);
        }
        const idxRow = cedictIndex.find((r) => r && r.id === ent.id);
        if (idxRow) checkCedictFullWordDetail(ent, idxRow);
      }
    }
  }
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

  // --- words-cedict-001.json 全量结构（含未在 index 中的备查条）-----------------
  const cedictPath = join(DICT_DIR, CEDICT_WORDS_FILE);
  let cedictList = null;
  let cedictById = new Map();
  if (existsSync(cedictPath)) {
    try {
      cedictList = readJson(cedictPath);
      if (!Array.isArray(cedictList)) {
        failMismatch(`${CEDICT_WORDS_FILE} is not a JSON array`);
      } else {
        cedictById = new Map(cedictList.filter((x) => x && x.id).map((x) => [x.id, x]));
        for (const ent of cedictList) {
          if (!ent || !ent.id) continue;
          walkForbidden(ent, `cedict[${ent.id}]`);
          checkWordDetailStandalone(ent, CEDICT_WORDS_FILE);
        }
      }
    } catch (e) {
      failMissing(`${CEDICT_WORDS_FILE} read error: ${e?.message || e}`);
    }
  }

  // --- CC-CEDICT draft：仅校验已发布行；draft 行不因空义报错 ------------------------
  if (existsSync(DRAFT_CEDICT_PATH)) {
    let draftList;
    try {
      draftList = readJson(DRAFT_CEDICT_PATH);
    } catch (e) {
      failMissing(`draft file parse: ${e?.message || e}`);
      draftList = null;
    }
    if (draftList && !Array.isArray(draftList)) {
      failMismatch("words-cedict-draft-001.json is not an array");
    } else if (Array.isArray(draftList)) {
      for (const d of draftList) {
        if (!d) continue;
        if (d.status === "published") {
          checkPublishedCedictDraft(d, index, cedictById);
        }
        walkForbidden(d, `cedict-draft[${d.id || "?"}]`);
      }
    }
  }

  // --- cedict/ 全量架构（轻量 index + words-cedict-*.json 详情分包）----------------
  checkCedictFullLayout(join(DICT_DIR, CEDICT_INDEX_FULL));

  const nIndex = index.length;
  const nChar = index.filter((r) => r.type === "char").length;
  const nWord = index.filter((r) => r.type === "word").length;
  const nFiles = detailFileNames.size;

  const wCount =
    warnings.components.length + warnings.forbidden.length + warnings.cedictReview.length;

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
    if (warnings.cedictReview.length) {
      console.log("\nWarnings (CC-CEDICT needs review):");
      for (const m of warnings.cedictReview) console.log(`- ${m}`);
    }
    if (warnings.components.length) {
      console.log("\nWarnings (word components without char index):");
      for (const m of warnings.components) console.log(`- ${m}`);
    }
  }

  if (Array.isArray(cedictList)) {
    const nCedictPending = cedictList.filter(
      (e) => e && String(e.source) === "CC-CEDICT" && e.needsReview === true
    ).length;
    if (nCedictPending > 0) {
      console.log("");
      console.log(`CC-CEDICT needsReview entries: ${nCedictPending}`);
      console.log("Run npm run build:cedict-review to generate review queue.");
    }
  }

  process.exit(0);
}

main();
