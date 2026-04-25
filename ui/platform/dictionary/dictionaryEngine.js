// ui/platform/dictionary/dictionaryEngine.js
// Dictionary Engine v1：索引 + 详情分文件，与笔顺数据独立

function getDataRoot() {
  const base = String(typeof window !== "undefined" && window.__APP_BASE__ ? window.__APP_BASE__ : "")
    .trim()
    .replace(/\/+$/, "");
  return base ? `${base}/` : "/";
}

function dictDataUrl(suffix) {
  const s = String(suffix || "").replace(/^\//, "");
  return `${getDataRoot()}data/dictionary/${s}`;
}

let _indexCache = null;
let _indexLoadPromise = null;
/** @type {Map<string, Promise<any[]>>} */
const _filePromises = new Map();

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
    _indexLoadPromise = fetch(url, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`dictionary index: HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        _indexCache = Array.isArray(data) ? data : [];
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
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) throw new Error(`dictionary detail: HTTP ${r.status} ${fileName}`);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  })();

  _filePromises.set(fileName, p);
  return p;
}

/**
 * 从已加载的详情列表中取一条
 * @param {any[]} list
 * @param {string} id
 * @param {string} key
 * @param {"char"|"word"} entryType
 */
function pickEntryFromList(list, id, key, entryType) {
  if (!list?.length) return null;
  if (id) {
    const byId = list.find((x) => x && x.id === id);
    if (byId) return byId;
  }
  if (entryType === "char" && key) {
    return list.find((x) => x && x.type === "char" && x.char === key) || null;
  }
  if (entryType === "word" && key) {
    return list.find((x) => x && x.type === "word" && x.word === key) || null;
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
 * 词语查询：完全匹配 → 含「query」/「被 query 含」的最近一条
 * @param {string} word
 */
export async function getDictionaryEntryByWord(word) {
  const raw = String(word ?? "").trim();
  if (!raw) {
    return { found: false, type: "word", query: "", stroke: { codePoint: 0, path: "", exists: false } };
  }
  if (!/[\u4e00-\u9fff]/.test(raw)) {
    return { found: false, type: "word", query: raw, stroke: { codePoint: 0, path: "", exists: false } };
  }
  const first = firstCjkFromString(raw) || raw[0];
  const stroke = await buildStrokeInfo(first);
  const index = await loadIndex();
  const wordRows = index.filter((x) => x && x.type === "word");
  let row = wordRows.find((x) => (x.word && x.word === raw) || (x.query && x.query === raw));
  if (!row) {
    const candidates = wordRows.filter(
      (x) => x.word && (x.word === raw || x.word.includes(raw) || raw.includes(x.word))
    );
    if (candidates.length) {
      row = candidates
        .slice()
        .sort((a, b) => {
          const al = a.word.length;
          const bl = b.word.length;
          if (bl !== al) return bl - al;
          return String(a.id || "").localeCompare(String(b.id || ""));
        })[0];
    }
  }
  if (!row) {
    return { found: false, type: "word", query: raw, stroke };
  }
  const list = await loadDetailArray(row.file);
  const entry = pickEntryFromList(list, row.id, row.word, "word");
  if (!entry) {
    return { found: false, type: "word", query: raw, stroke };
  }
  return {
    found: true,
    type: "word",
    entry: normalizeEntryShape(entry),
    stroke,
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
  const entry = pickEntryFromList(list, row.id, c, "char");
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
 * 单字/词语统一查询：单字 → char 词条；多字/词 → 词语
 * @param {string} query
 */
export async function searchDictionary(query) {
  const raw = String(query ?? "").trim();
  if (!raw) {
    return emptyCharStrokeResult("");
  }

  if (isSingleCjkChar(raw)) {
    return lookupSingleChar(raw);
  }

  if (!/[\u4e00-\u9fff]/.test(raw)) {
    return { found: false, type: "word", query: raw, stroke: { codePoint: 0, path: "", exists: false } };
  }

  return getDictionaryEntryByWord(raw);
}

/**
 * 按单字取字典：整串为单字则 char，否则当词语/短语
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
