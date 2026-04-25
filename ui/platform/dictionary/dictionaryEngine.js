// ui/platform/dictionary/dictionaryEngine.js
// Dictionary Engine：索引 + 详情分文件，与笔顺数据独立
// 数据根路径：优先相对 import.meta.url 解析，避免子目录部署时 /data/ 解析错误

/** 资源缓存版本，修改 dictionary JSON 时递增以绕开 HTTP 强缓存 */
const DICT_DATA_VERSION = "20260220";

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

let _indexCache = null;
let _indexLoadPromise = null;
/** @type {Map<string, Promise<any[]>>} */
const _filePromises = new Map();

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
 * 词语查询
 * @param {string} word
 */
export async function getDictionaryEntryByWord(query) {
  const q = String(query ?? "").trim();
  if (!q) {
    return { found: false, type: "word", query: q, stroke: { codePoint: 0, path: "", exists: false } };
  }
  if (!/[\u4e00-\u9fff]/.test(q)) {
    return { found: false, type: "word", query: q, stroke: { codePoint: 0, path: "", exists: false } };
  }
  const first = firstCjkFromString(q) || q[0];
  const stroke = await buildStrokeInfo(first);
  const index = await loadIndex();
  const wordEntries = index.filter((item) => item && item.type === "word");

  let indexEntry =
    wordEntries.find((item) => item && item.word === q) ||
    wordEntries.find((item) => item && item.query === q) ||
    wordEntries.find((item) => item && item.word && String(item.word).includes(q)) ||
    wordEntries.find((item) => item && item.query && String(item.query).includes(q)) ||
    null;

  if (!indexEntry) {
    const looser = wordEntries.filter(
      (item) => item && item.word && (q.includes(String(item.word)) || String(item.word).includes(q))
    );
    if (looser.length) {
      indexEntry = looser
        .sort((a, b) => {
          const al = String(a.word || "").length;
          const bl = String(b.word || "").length;
          if (bl !== al) return bl - al;
          return String(a.id || "").localeCompare(String(b.id || ""));
        })[0];
    }
  }

  if (!indexEntry) {
    if (DEBUG_DICT()) console.log("[dictionary] no word index for", q);
    return { found: false, type: "word", query: q, stroke };
  }

  if (!indexEntry.file) {
    if (DEBUG_DICT()) console.warn("[dictionary] index entry missing file", indexEntry);
    return { found: false, type: "word", query: q, stroke, indexEntry };
  }

  const detailList = await loadDetailArray(indexEntry.file);
  const entry = pickWordEntryFromList(detailList, indexEntry, q);

  if (DEBUG_DICT()) {
    console.log("[dictionary] word lookup", { q, indexEntry, detailHit: !!entry, detailLen: detailList.length });
  }

  if (!entry) {
    return { found: false, type: "word", query: q, stroke, indexEntry };
  }

  return {
    found: true,
    type: "word",
    query: q,
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

  if (!/[\u4e00-\u9fff]/.test(q)) {
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
