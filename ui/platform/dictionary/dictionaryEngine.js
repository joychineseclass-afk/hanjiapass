// ui/platform/dictionary/dictionaryEngine.js
// Dictionary Engine：索引 + 详情分文件，与笔顺数据独立
// 数据根路径：浏览器内与 dataPaths 一致（origin + __APP_BASE__），无 DOM 时再回退 import.meta

/** 资源缓存版本，修改 dictionary JSON 时递增以绕开 HTTP 强缓存 */
const DICT_DATA_VERSION = "20260427-full-1";

function getDataRoot() {
  const base = String(typeof window !== "undefined" && window.__APP_BASE__ ? window.__APP_BASE__ : "")
    .trim()
    .replace(/\/+$/, "");
  return base ? `${base}/` : "/";
}

/**
 * 解析 data/dictionary/ 的目录 URL，供 fetch 使用。
 * 在浏览器中优先用 origin + __APP_BASE__，子路径部署时须落在 /[base]/data/dictionary/。
 * 若先 import.meta.url，子路径下 ../../../ 常指到站点根，误成 /data/ 而非 /[base]/data/ 导致 cedict 全量 404。
 * 无 DOM 时回退 import.meta 或本地占位，供构建/单测。
 */
function getDictionaryDataDir() {
  if (typeof location !== "undefined" && location.origin) {
    const r = getDataRoot() || "/";
    const pathBase =
      r === "/" ? `${location.origin}/` : `${location.origin}${r.startsWith("/") ? r : `/${r}`}`.replace(/\/+$/, "/");
    return new URL("data/dictionary/", pathBase);
  }
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return new URL("../../../data/dictionary/", import.meta.url);
    }
  } catch (e) {
    /* ignore */
  }
  return new URL("../../../data/dictionary/", "http://localhost/");
}

function dictDataUrl(fileName) {
  const name = String(fileName || "").replace(/^\//, "");
  const u = new URL(name, getDictionaryDataDir());
  u.searchParams.set("v", DICT_DATA_VERSION);
  return u.href;
}

/**
 * 索引中 file 可能为 cedict/words-… 或仅 words-…，须落在 data/dictionary/cedict/ 下
 * @param {string} file
 * @returns {string}
 */
function normalizeCedictFilePath(file) {
  const raw = String(file || "").replace(/^\/+/, "");
  if (!raw) return raw;
  if (raw.startsWith("cedict/cedict/")) return raw.replace(/^cedict\//, "");
  if (raw.startsWith("cedict/")) return raw;
  return `cedict/${raw}`;
}

/** 成语轻量索引缓存版本（与 dictionary 分离） */
const IDIOMS_INDEX_VERSION = "20260427";

/**
 * data/culture/idioms/ 目录 URL（与 page.culture、dataPaths 子路径规则一致）
 */
function getIdiomsDataDir() {
  if (typeof location !== "undefined" && location.origin) {
    const r = getDataRoot() || "/";
    const pathBase =
      r === "/" ? `${location.origin}/` : `${location.origin}${r.startsWith("/") ? r : `/${r}`}`.replace(/\/+$/, "/");
    return new URL("data/culture/idioms/", pathBase);
  }
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return new URL("../../../data/culture/idioms/", import.meta.url);
    }
  } catch (e) {
    /* ignore */
  }
  return new URL("../../../data/culture/idioms/", "http://localhost/");
}

function idiomsIndexDataUrl() {
  const u = new URL("idioms-index.json", getIdiomsDataDir());
  u.searchParams.set("v", IDIOMS_INDEX_VERSION);
  return u.href;
}

let _idiomsIndexCache = null;
let _idiomsIndexLoadPromise = null;

/**
 * 搜索归一化：小写、去声调、去空白
 * @param {string} value
 */
export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

async function loadIdiomsIndexForSearch() {
  if (_idiomsIndexCache) return _idiomsIndexCache;
  if (!_idiomsIndexLoadPromise) {
    const url = idiomsIndexDataUrl();
    if (DEBUG_DICT()) console.log("[dictionary] fetch idioms index", url);
    _idiomsIndexLoadPromise = fetch(url, { cache: "default" })
      .then((r) => {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error(`idioms index: HTTP ${r.status} ${url}`);
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        _idiomsIndexCache = arr;
        return _idiomsIndexCache;
      })
      .catch((e) => {
        if (DEBUG_DICT()) console.warn("[dictionary] idioms index", e);
        _idiomsIndexCache = [];
        return _idiomsIndexCache;
      });
  }
  return _idiomsIndexLoadPromise;
}

/**
 * 在 idioms-index.json 中找一条最匹配项（不加载详情 JSON）
 * @param {any[]} rows
 * @param {string} q
 * @returns {any | null}
 */
function bestIdiomIndexMatch(rows, q) {
  const qRaw = String(q).trim();
  if (!qRaw || !rows?.length) return null;
  const qNorm = normalizeSearchText(q);
  if (!qNorm && !/[\u4e00-\u9fff]/.test(qRaw)) return null;
  let best = null;
  let bestScore = -1;
  for (const row of rows) {
    if (!row || !row.idiom) continue;
    const idiom = String(row.idiom);
    const p = String(row.pinyin || "");
    const pNorm = normalizeSearchText(p);
    const idiomNorm = normalizeSearchText(idiom);
    let s = 0;
    if (idiom === qRaw) s = 100000;
    else if (qNorm && idiomNorm === qNorm) s = 95000;
    else if (qNorm && pNorm && pNorm === qNorm) s = 90000;
    else if (qRaw && idiom.includes(qRaw)) s = 70000 - idiom.length;
    else if (qNorm && idiomNorm.includes(qNorm)) s = 65000 - idiom.length;
    else if (qRaw && p.toLowerCase().includes(qRaw.toLowerCase())) s = 50000;
    else if (qNorm && pNorm && pNorm.includes(qNorm)) s = 40000;
    else continue;
    if (s > bestScore) {
      bestScore = s;
      best = row;
    } else if (s === bestScore && best) {
      if (idiom.length > String(best.idiom || "").length) best = row;
    }
  }
  return best;
}

/**
 * 词典主库 + cedict 均未命中时，在文化成语索引中兜底
 * @param {string} query
 * @returns {Promise<{ found: boolean, type: string, query: string, entry?: object }>}
 */
export async function searchCultureIdiomFallback(query) {
  const q = String(query ?? "").trim();
  const notFound = { found: false, type: "word", query: q, stroke: { codePoint: 0, path: "", exists: false } };
  if (!q) return notFound;
  const hasCjk = /[\u4e00-\u9fff]/.test(q);
  const pinyinish = /^[a-zA-Z0-9\s'·.]+$/.test(q.replace(/\s/g, " ").trim());
  if (!hasCjk && !pinyinish) return notFound;

  let list = [];
  try {
    list = await loadIdiomsIndexForSearch();
  } catch (e) {
    if (DEBUG_DICT()) console.warn("[dictionary] searchCultureIdiomFallback", e);
    return notFound;
  }
  const row = bestIdiomIndexMatch(list, q);
  if (!row) return notFound;

  return {
    found: true,
    type: "culture-idiom",
    query: q,
    entry: {
      id: row.id,
      idiom: row.idiom,
      pinyin: row.pinyin,
      file: row.file,
      category: row.category,
    },
  };
}

/**
 * 主词库 → cedict → 文化成语 index
 * @param {string} query
 */
export async function searchDictionaryWithIdiomFallback(query) {
  const q = String(query ?? "").trim();
  if (!q) {
    return emptyCharStrokeResult("");
  }
  const dictResult = await searchDictionary(q);
  if (dictResult && dictResult.found) {
    return dictResult;
  }
  const idiomResult = await searchCultureIdiomFallback(q);
  if (idiomResult && idiomResult.found) {
    return idiomResult;
  }
  return dictResult;
}

let _indexCache = null;
let _indexLoadPromise = null;
/** @type {Map<string, Promise<any[]>>} */
const _filePromises = new Map();

/** CC-CEDICT 全量 fallback 轻量索引（懒加载） */
let cedictIndexCache = null;
let _cedictIndexLoadPromise = null;
/** @type {Map<string, Promise<any[]>>} cedict 详情分包 Promise 缓存（与 _filePromises 键一致，显式命名供调试） */
const cedictDetailFileCache = new Map();

const DEBUG_DICT = () =>
  typeof localStorage !== "undefined" && localStorage.getItem("DEBUG_DICT") === "1";

function firstCjkFromString(s) {
  const t = String(s ?? "");
  for (const ch of t) {
    if (isSingleCjkChar(ch)) return ch;
  }
  return "";
}

/**
 * 单字判断（CJK 统一表意文字）
 * @param {string} value
 * @returns {boolean}
 */
export function isSingleCjkChar(value) {
  return /^[\u4e00-\u9fff]$/.test(String(value || "").trim());
}

/**
 * 笔顺 SVG 路径（与 dataPaths.strokeUrl 一致，支持子目录部署）
 * @param {string} char
 * @returns {string}
 */
export function getStrokeSvgPathForChar(char) {
  const s = String(char ?? "").trim();
  const ch = s ? [...s][0] : "";
  if (!ch) return "";
  if (typeof window !== "undefined" && window.DATA_PATHS?.strokeUrl) {
    const u = window.DATA_PATHS.strokeUrl(ch);
    if (u) return String(u).replace(/\?.*$/, "");
  }
  const codePoint = ch.codePointAt(0);
  if (!codePoint) return "";
  return `/data/strokes/${codePoint}.svg`;
}

/**
 * 检查笔顺文件是否存在
 * @param {string} char
 * @returns {Promise<boolean>}
 */
export async function checkStrokeSvgExists(char) {
  const path = getStrokeSvgPathForChar(char);
  if (!path) return false;
  try {
    const tryReq = (method) => fetch(path, { method, cache: "force-cache" });
    let res = await tryReq("HEAD");
    if (res.ok) return true;
    if (res.status === 404) return false;
    res = await tryReq("GET");
    return res.ok;
  } catch {
    return false;
  }
}

async function loadIndex() {
  if (_indexCache) return _indexCache;
  if (!_indexLoadPromise) {
    const url = dictDataUrl("dictionary-index.json");
    if (DEBUG_DICT()) console.log("[dictionary] fetch index", url);
    _indexLoadPromise = fetch(url, { cache: "default" })
      .then((r) => {
        if (!r.ok) throw new Error(`dictionary index: HTTP ${r.status} ${url}`);
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        _indexCache = arr;
        if (DEBUG_DICT()) {
          const words = arr.filter((x) => x && x.type === "word");
          console.log("[dictionary] index loaded", arr.length, "word rows", words.length, words.map((w) => w.word || w.query).slice(0, 5));
        }
        return _indexCache;
      });
  }
  return _indexLoadPromise;
}

async function loadDetailArray(fileName) {
  if (!fileName) return [];
  if (_filePromises.has(fileName)) return _filePromises.get(fileName);

  const p = (async () => {
    const url = dictDataUrl(fileName);
    if (DEBUG_DICT()) console.log("[dictionary] fetch detail", url);
    const r = await fetch(url, { cache: "default" });
    if (!r.ok) throw new Error(`dictionary detail: HTTP ${r.status} ${fileName} ${url}`);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  })();

  _filePromises.set(fileName, p);
  return p;
}

/**
 * 词语索引层匹配：word → query → traditional → pinyinPlain → 包含
 * 每个索引层内同规则，返回一个最优匹配
 * @param {any[]} wordRows
 * @param {string} q
 * @returns {any | null}
 */
function bestWordIndexEntry(wordRows, q) {
  const nq = String(q).trim();
  if (!nq || !wordRows?.length) return null;
  const nqLower = nq.toLowerCase();
  let best = null;
  let bestScore = -1;
  for (const item of wordRows) {
    if (!item || item.type !== "word") continue;
    const w = String(item.word || "");
    const qu = String(item.query || "");
    const tr = String(item.traditional || "");
    const pp = String(item.pinyinPlain || "").toLowerCase();
    let s = 0;
    if (w === nq) s = 100000;
    else if (qu === nq) s = 90000;
    else if (tr && tr === nq) s = 80000;
    else if (pp && nqLower === pp) s = 70000;
    else if (w && nq.length && w.includes(nq)) s = 50000 - w.length;
    else if (w && w.length && nq.includes(w)) s = 40000 - w.length;
    else continue;
    if (s > bestScore) {
      bestScore = s;
      best = item;
    } else if (s === bestScore && best && s >= 40000) {
      if (w.length < String(best.word || "").length) best = item;
    }
  }
  return best;
}

/**
 * 加载 CC-CEDICT 全量 fallback 轻量索引
 * @returns {Promise<any[]>}
 */
export async function loadCedictIndex() {
  if (cedictIndexCache) return cedictIndexCache;
  if (!_cedictIndexLoadPromise) {
    const url = dictDataUrl("cedict/cedict-index.json");
    if (DEBUG_DICT()) console.log("[dictionary] fetch cedict index", url);
    _cedictIndexLoadPromise = fetch(url, { cache: "default" })
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`cedict index: HTTP ${r.status} ${url}`);
        return r.json();
      })
      .then((data) => {
        if (data === null) {
          cedictIndexCache = [];
          return cedictIndexCache;
        }
        const arr = Array.isArray(data) ? data : [];
        cedictIndexCache = arr;
        if (DEBUG_DICT()) console.log("[dictionary] cedict index loaded count:", arr.length);
        return cedictIndexCache;
      })
      .catch((e) => {
        if (DEBUG_DICT()) console.warn("[dictionary] cedict index", e);
        cedictIndexCache = [];
        return cedictIndexCache;
      });
  }
  return _cedictIndexLoadPromise;
}

/**
 * 加载 cedict 目录下详情分包（带缓存，路径相对 data/dictionary/）
 * @param {string} file
 * @returns {Promise<any[]>}
 */
export async function loadCedictDetailFile(file) {
  const name = normalizeCedictFilePath(file);
  if (!name) return [];
  if (cedictDetailFileCache.has(name)) {
    return cedictDetailFileCache.get(name);
  }
  if (DEBUG_DICT()) {
    const url = dictDataUrl(name);
    console.log("[dictionary] cedict detail url", url);
  }
  const p = loadDetailArray(name);
  cedictDetailFileCache.set(name, p);
  return p;
}

/**
 * 仅 cedict 索引层查词（fallback）
 * @param {string} query
 */
export async function getCedictEntryByWord(query) {
  const q = String(query ?? "").trim();
  const emptySt = { codePoint: 0, path: "", exists: false };
  if (!q) {
    return { found: false, type: "word", query: q, stroke: emptySt };
  }
  if (DEBUG_DICT()) console.log("[dictionary] query (cedict path)", q);

  let list = [];
  try {
    list = await loadCedictIndex();
  } catch (e) {
    if (DEBUG_DICT()) console.warn("[dictionary] getCedictEntryByWord", e);
    return { found: false, type: "word", query: q, stroke: emptySt };
  }

  const wordRows = (list || []).filter((x) => x && x.type === "word");
  const indexEntry = bestWordIndexEntry(wordRows, q);
  if (!indexEntry) {
    if (DEBUG_DICT()) console.log("[dictionary] no cedict index for", q);
    return { found: false, type: "word", query: q, stroke: emptySt };
  }
  if (DEBUG_DICT()) {
    console.log("[dictionary] cedict match:", indexEntry.word || indexEntry.query, "detail file:", indexEntry.file, "id:", indexEntry.id);
  }
  if (!indexEntry.file) {
    if (DEBUG_DICT()) console.warn("[dictionary] cedict index entry missing file", indexEntry);
    return { found: false, type: "word", query: q, stroke: emptySt, indexEntry };
  }

  const detailList = await loadCedictDetailFile(indexEntry.file);
  const entry = pickWordEntryFromList(detailList, indexEntry, q);

  if (DEBUG_DICT()) {
    console.log("[dictionary] cedict word lookup", {
      q,
      indexEntry,
      detailHit: !!entry,
      detailLen: detailList.length,
    });
    if (indexEntry.id) {
      const byId = detailList.find((x) => x && x.id === indexEntry.id);
      console.log("[dictionary] detail hit by id:", !!byId);
    }
  }

  if (!entry) {
    return { found: false, type: "word", query: q, stroke: emptySt, indexEntry };
  }

  const fc = firstCjkFromString(entry.word);
  const stroke = fc ? await buildStrokeInfo(fc) : emptySt;

  return {
    found: true,
    type: "word",
    query: q,
    sourceLayer: "cedict",
    entry: normalizeEntryShape(entry),
    indexEntry,
    stroke,
  };
}

/**
 * 从已加载的详情列表中取一条（单字）
 */
function pickCharEntryFromList(list, id, char) {
  if (!list?.length) return null;
  if (id) {
    const byId = list.find((x) => x && x.id === id);
    if (byId) return byId;
  }
  if (char) {
    return list.find((x) => x && x.type === "char" && x.char === char) || null;
  }
  return null;
}

/**
 * 从已加载的详情列表中取一条（词语），兼容 id / word / query
 */
function pickWordEntryFromList(list, indexEntry, q) {
  if (!list?.length) return null;
  const byId = indexEntry.id ? list.find((x) => x && x.id === indexEntry.id) : null;
  if (byId) return byId;
  const w = indexEntry.word || indexEntry.query;
  const byWord =
    list.find((x) => x && x.type === "word" && w && x.word === w) ||
    list.find((x) => x && x.type === "word" && x.word === indexEntry.query) ||
    (q
      ? list.find((x) => x && x.type === "word" && x.word === q) ||
        list.find((x) => x && x.type === "word" && x.word && q && x.word.includes(q))
      : null);
  if (byWord) return byWord;
  const qp = String(q || "").trim();
  const ip = indexEntry.pinyinPlain ? String(indexEntry.pinyinPlain).toLowerCase() : "";
  if (qp && ip && normalizeSearchText(qp) === normalizeSearchText(ip)) {
    const trad = String(indexEntry.traditional || indexEntry.word || "");
    return (
      list.find(
        (x) => x && x.type === "word" && (x.pinyinPlain || "").toLowerCase() === ip && (x.word === w || x.word === trad)
      ) || null
    );
  }
  return null;
}

/**
 * 构造 stroke 子对象
 * @param {string} char
 */
export async function buildStrokeInfo(char) {
  const c = isSingleCjkChar(char) ? char : firstCjkFromString(char);
  if (!c) {
    return { codePoint: 0, path: "", exists: false };
  }
  const codePoint = c.codePointAt(0) || 0;
  const path = getStrokeSvgPathForChar(c);
  const exists = await checkStrokeSvgExists(c);
  return { codePoint, path, exists };
}

function emptyCharStrokeResult(query) {
  return { found: false, type: "char", query: query || "", stroke: { codePoint: 0, path: "", exists: false } };
}

/**
 * 词语查询：先 dictionary-index.json，未命中再 cedict/cedict-index.json
 * @param {string} word
 */
export async function getDictionaryEntryByWord(query) {
  const q = String(query ?? "").trim();
  const emptySt = { codePoint: 0, path: "", exists: false };
  if (!q) {
    return { found: false, type: "word", query: q, stroke: emptySt };
  }
  const hasCjk = /[\u4e00-\u9fff]/.test(q);
  const pinyinish = /^[a-zA-Z0-9\s'·.]+$/.test(q.replace(/\s/g, " ").trim());
  if (!hasCjk && !pinyinish) {
    return { found: false, type: "word", query: q, stroke: emptySt };
  }

  const firstCjk = hasCjk ? firstCjkFromString(q) || q[0] : "";
  let stroke = firstCjk ? await buildStrokeInfo(firstCjk) : emptySt;

  const index = await loadIndex();
  const wordEntries = index.filter((item) => item && item.type === "word");
  const indexEntry = bestWordIndexEntry(wordEntries, q);

  if (!indexEntry) {
    if (DEBUG_DICT()) console.log("[dictionary] main index miss for", q, "→ cedict fallback");
    return getCedictEntryByWord(q);
  }
  if (DEBUG_DICT()) console.log("[dictionary] main index hit for", q, { file: indexEntry.file, id: indexEntry.id });

  if (!indexEntry.file) {
    if (DEBUG_DICT()) console.warn("[dictionary] index entry missing file", indexEntry);
    return { found: false, type: "word", query: q, stroke, indexEntry, sourceLayer: "main" };
  }

  const detailList = await loadDetailArray(indexEntry.file);
  const entry = pickWordEntryFromList(detailList, indexEntry, q);

  if (DEBUG_DICT()) {
    console.log("[dictionary] word lookup", { q, indexEntry, detailHit: !!entry, detailLen: detailList.length });
  }

  if (!entry) {
    return { found: false, type: "word", query: q, stroke, indexEntry, sourceLayer: "main" };
  }

  if (!firstCjk && entry.word) {
    const fc = firstCjkFromString(entry.word);
    if (fc) stroke = await buildStrokeInfo(fc);
  }

  return {
    found: true,
    type: "word",
    query: q,
    sourceLayer: "main",
    entry: normalizeEntryShape(entry),
    stroke,
    indexEntry,
  };
}

async function lookupSingleChar(char) {
  const c = char;
  const index = await loadIndex();
  const row = index.find((x) => x && x.type === "char" && x.char === c);
  const stroke = await buildStrokeInfo(c);

  if (!row) {
    return { found: false, type: "char", query: c, stroke };
  }

  const list = await loadDetailArray(row.file);
  const entry = pickCharEntryFromList(list, row.id, c);
  if (!entry) {
    return { found: false, type: "char", query: c, stroke };
  }

  return {
    found: true,
    type: "char",
    entry: normalizeEntryShape(entry),
    stroke,
  };
}

function normalizeEntryShape(entry) {
  if (!entry) return null;
  if (entry.type === "word") {
    return {
      id: entry.id,
      type: "word",
      word: entry.word,
      traditional: entry.traditional,
      pinyin: entry.pinyin,
      pinyinNumbered: entry.pinyinNumbered,
      meaning: entry.meaning,
      example: entry.example,
      examplePinyin: entry.examplePinyin,
      qualityLevel: entry.qualityLevel,
      needsReview: entry.needsReview,
    };
  }
  return {
    id: entry.id,
    type: "char",
    char: entry.char,
    pinyin: entry.pinyin,
    meaning: entry.meaning,
    teachingNote: entry.teachingNote,
    commonWords: entry.commonWords,
  };
}

/**
 * 单字/词语统一查询
 * @param {string} query
 */
let _debugDictionaryLookupExposed = false;
function ensureDebugDictionaryLookupOnWindow() {
  if (typeof window === "undefined" || _debugDictionaryLookupExposed || !DEBUG_DICT()) return;
  _debugDictionaryLookupExposed = true;
  window.debugDictionaryLookup = debugDictionaryLookup;
}

export async function searchDictionary(query) {
  const q = String(query ?? "").trim();
  if (DEBUG_DICT()) {
    ensureDebugDictionaryLookupOnWindow();
    console.log("[dictionary] query", q);
  }
  if (!q) {
    return emptyCharStrokeResult("");
  }

  if (isSingleCjkChar(q)) {
    return getDictionaryEntryByChar(q);
  }

  const hasCjk = /[\u4e00-\u9fff]/.test(q);
  const pinyinish = /^[a-zA-Z0-9\s'·.]+$/.test(q.replace(/\s/g, " ").trim());
  if (!hasCjk && !pinyinish) {
    return { found: false, type: "word", query: q, stroke: { codePoint: 0, path: "", exists: false } };
  }

  return getDictionaryEntryByWord(q);
}

/**
 * 按单字/词语取结果：整段为单字则 char，否则为词语
 * @param {string} char
 */
export async function getDictionaryEntryByChar(char) {
  const c = String(char ?? "").trim();
  if (!c) {
    return emptyCharStrokeResult("");
  }
  if (isSingleCjkChar(c)) {
    return lookupSingleChar(c);
  }
  if (/[\u4e00-\u9fff]/.test(c)) {
    return getDictionaryEntryByWord(c);
  }
  return emptyCharStrokeResult(c);
}

/**
 * 主索引 + cedict 轻量索引上的候选，不加载 detail 分包，不含文化成语
 * @param {string} query
 * @param {{ limit?: number }} [options] limit 默认 200；autocomplete 等可传 8
 * @returns {Promise<object[]>}
 */
export async function searchDictionarySuggestions(query, options = {}) {
  const rawQ = String(query ?? "").trim();
  if (!rawQ) return [];
  const hasCjk = /[\u4e00-\u9fff]/.test(rawQ);
  const pinyinish = /^[a-zA-Z0-9\s'·.]+$/.test(String(rawQ).replace(/\s/g, " ").trim());
  if (!hasCjk && !isSingleCjkChar(rawQ) && !pinyinish) return [];

  const lim = options.limit;
  const maxOut =
    lim != null && Number.isFinite(Number(lim)) && Number(lim) > 0 ? Math.min(200, Math.floor(Number(lim))) : 200;

  const [mainIndex, cedictIndexRaw] = await Promise.all([loadIndex(), loadCedictIndex()]);
  const mainWords = (Array.isArray(mainIndex) ? mainIndex : []).filter((x) => x && x.type === "word");
  const cedictIndex = Array.isArray(cedictIndexRaw) ? cedictIndexRaw : [];
  const mainAllWord = new Set();
  for (const r of mainWords) {
    const w = r.word || r.query;
    if (w) mainAllWord.add(String(w));
  }

  const collected = [];

  for (const row of mainWords) {
    if (!rowMatchesForSuggestion(row, rawQ)) continue;
    collected.push(mapSuggestionRow(row, "main"));
  }

  for (const row of cedictIndex) {
    if (!row || row.type !== "word") continue;
    const w = String(row.word || row.query || "");
    if (w && mainAllWord.has(w)) continue;
    if (!rowMatchesForSuggestion(row, rawQ)) continue;
    collected.push(mapSuggestionRow(row, "cedict"));
  }

  const nq = normalizeSearchText(rawQ);
  collected.sort((a, b) => {
    const sa = scoreSuggestionItem(a, rawQ, nq);
    const sb = scoreSuggestionItem(b, rawQ, nq);
    if (sb !== sa) return sb - sa;
    return String(a.id).localeCompare(String(b.id), "en");
  });

  const seen = new Set();
  const out = [];
  for (const it of collected) {
    const w = String(it.word || it.query || "").trim();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push(it);
    if (out.length >= maxOut) break;
  }
  return out;
}

/**
 * 候选在索引行上是否相关（不加载 detail）
 * @param {any} row
 * @param {string} rawQ
 */
function rowMatchesForSuggestion(row, rawQ) {
  const q = String(rawQ ?? "").trim();
  if (!q) return false;
  const nq = normalizeSearchText(q);
  const w = String(row.word || row.query || "");
  const tr = String(row.traditional || "");
  const pp = normalizeSearchText(String(row.pinyinPlain || ""));
  const py = normalizeSearchText(String(row.pinyin || ""));
  if (w && w.includes(q)) return true;
  if (q.length && w.length && q.includes(w)) return true;
  if (tr && tr.includes(q)) return true;
  if (nq && pp && (pp.includes(nq) || pp === nq)) return true;
  if (nq && py && (py.includes(nq) || py === nq)) return true;
  return false;
}

/**
 * @param {any} row
 * @param {"main"|"cedict"} sourceLayer
 */
function mapSuggestionRow(row, sourceLayer) {
  return {
    id: row.id,
    type: "word",
    word: String(row.word || row.query || ""),
    query: String(row.query || row.word || ""),
    pinyin: String(row.pinyin || ""),
    pinyinPlain: row.pinyinPlain != null ? String(row.pinyinPlain) : "",
    pinyinNumbered: row.pinyinNumbered != null ? String(row.pinyinNumbered) : "",
    file: row.file,
    sourceLayer,
  };
}

/**
 * @param {object} item
 * @param {string} query
 * @param {string} nq
 */
function scoreSuggestionItem(item, query, nq) {
  let score = 0;
  const q = String(query ?? "").trim();
  const word = String(item.word || item.query || "");
  const wordNorm = normalizeSearchText(word);
  const pinyinNorm = normalizeSearchText(String(item.pinyinPlain || item.pinyin || ""));
  if (word === q) score += 1000;
  if (wordNorm === nq) score += 900;
  if (item.sourceLayer === "main") score += 200;
  if (q && word.startsWith(q)) score += 120;
  if (q && word.includes(q)) score += 80;
  if (nq && pinyinNorm.startsWith(nq)) score += 60;
  if (nq && pinyinNorm.includes(nq)) score += 30;
  score -= word.length;
  return score;
}

/**
 * 仅在 localStorage DEBUG_DICT=1 时用于控制台手查。勿在正常路径调用。
 * @param {string} query
 */
export async function debugDictionaryLookup(query) {
  if (typeof localStorage === "undefined" || localStorage.getItem("DEBUG_DICT") !== "1") {
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[dict debug] set localStorage.setItem('DEBUG_DICT','1') first");
    }
    return null;
  }
  const q = String(query ?? "").trim();
  console.log("[dict debug] query", q);
  const main = await getDictionaryEntryByWord(q);
  console.log("[dict debug] getDictionaryEntryByWord (main then cedict)", main);
  const cedictIndex = await loadCedictIndex();
  const wordRows = cedictIndex.filter((x) => x && x.type === "word");
  const cedictMatch = bestWordIndexEntry(wordRows, q);
  console.log("[dict debug] cedict index count", cedictIndex.length);
  console.log("[dict debug] cedict match", cedictMatch);
  if (cedictMatch && cedictMatch.file) {
    const norm = normalizeCedictFilePath(cedictMatch.file);
    const detailList = await loadCedictDetailFile(cedictMatch.file);
    console.log("[dict debug] cedict detail file", norm, "count", detailList.length);
    const hit = cedictMatch.id ? detailList.find((x) => x && x.id === cedictMatch.id) : null;
    console.log("[dict debug] detail hit", !!hit, hit);
  }
  return { main, cedictIndexLen: cedictIndex.length, cedictMatch };
}
