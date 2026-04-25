// ui/platform/dictionary/dictionaryEngine.js
// Dictionary Engine：索引 + 详情分文件，与笔顺数据独立
// 数据根路径：优先相对 import.meta.url 解析，避免子目录部署时 /data/ 解析错误

/** 资源缓存版本，修改 dictionary JSON 时递增以绕开 HTTP 强缓存 */
const DICT_DATA_VERSION = "20260426";

function getDataRoot() {
  const base = String(typeof window !== "undefined" && window.__APP_BASE__ ? window.__APP_BASE__ : "")
    .trim()
    .replace(/\/+$/, "");
  return base ? `${base}/` : "/";
}

/**
 * 解析 data/dictionary/ 的目录 URL，供 fetch 使用。
 * 使用 import.meta.url 相对定位到仓库根下 data/dictionary/，Vercel / GitHub Pages 子路径下均有效。
 * 回退：以当前页面 origin + __APP_BASE__ 拼出根路径，避免仅用 "/data" 在子目录部署 404。
 */
function getDictionaryDataDir() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return new URL("../../../data/dictionary/", import.meta.url);
    }
  } catch (e) {
    /* ignore */
  }
  if (typeof location !== "undefined" && location.origin) {
    const r = getDataRoot() || "/";
    const pathBase =
      r === "/" ? `${location.origin}/` : `${location.origin}${r.startsWith("/") ? r : `/${r}`}`.replace(/\/+$/, "/");
    return new URL("data/dictionary/", pathBase);
  }
  return new URL("../../../data/dictionary/", "http://localhost/");
}

function dictDataUrl(fileName) {
  const name = String(fileName || "").replace(/^\//, "");
  const u = new URL(name, getDictionaryDataDir());
  u.searchParams.set("v", DICT_DATA_VERSION);
  return u.href;
}

/** 成语轻量索引缓存版本（与 dictionary 分离） */
const IDIOMS_INDEX_VERSION = "20260427";

/**
 * data/culture/idioms/ 目录 URL（与 page.culture 数据路径一致）
 */
function getIdiomsDataDir() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return new URL("../../../data/culture/idioms/", import.meta.url);
    }
  } catch (e) {
    /* ignore */
  }
  if (typeof location !== "undefined" && location.origin) {
    const r = getDataRoot() || "/";
    const pathBase =
      r === "/" ? `${location.origin}/` : `${location.origin}${r.startsWith("/") ? r : `/${r}`}`.replace(/\/+$/, "/");
    return new URL("data/culture/idioms/", pathBase);
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
  const name = String(file || "").replace(/^\//, "");
  if (!name) return [];
  if (cedictDetailFileCache.has(name)) {
    return cedictDetailFileCache.get(name);
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
  if (!indexEntry.file) {
    if (DEBUG_DICT()) console.warn("[dictionary] cedict index entry missing file", indexEntry);
    return { found: false, type: "word", query: q, stroke: emptySt, indexEntry };
  }

  const detailList = await loadCedictDetailFile(indexEntry.file);
  const entry = pickWordEntryFromList(detailList, indexEntry, q);

  if (DEBUG_DICT()) {
    console.log("[dictionary] cedict word lookup", { q, indexEntry, detailHit: !!entry, detailLen: detailList.length });
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
  return (
    list.find((x) => x && x.type === "word" && w && x.word === w) ||
    list.find((x) => x && x.type === "word" && x.word === indexEntry.query) ||
    (q
      ? list.find((x) => x && x.type === "word" && x.word === q) ||
        list.find((x) => x && x.type === "word" && x.word && q && x.word.includes(q))
      : null) ||
    null
  );
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
    if (DEBUG_DICT()) console.log("[dictionary] no main word index for", q);
    return getCedictEntryByWord(q);
  }

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
      meaning: entry.meaning,
      example: entry.example,
      examplePinyin: entry.examplePinyin,
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
export async function searchDictionary(query) {
  const q = String(query ?? "").trim();
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
