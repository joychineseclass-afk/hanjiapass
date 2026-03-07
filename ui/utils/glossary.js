/**
 * 多语言词典层（Glossary Layer）
 * 为课程词条提供教学短释义和词性，作为课程数据缺失时的补充
 *
 * loadGlossary(lang, scope)
 * getGlossaryEntry(hanzi, lang, scope)
 * getGlossaryMeaning(hanzi, lang, scope)
 * getGlossaryPos(hanzi, lang, scope)
 */

const CACHE = new Map();

/** 计算缓存 key */
function cacheKey(lang, scope) {
  return `${String(lang || "").toLowerCase()}-${String(scope || "").toLowerCase()}`;
}

/** 获取 glossary JSON 的 URL */
function getGlossaryUrl(lang, scope) {
  const base = (typeof window !== "undefined" && window.__APP_BASE__)
    ? String(window.__APP_BASE__).replace(/\/+$/, "") + "/"
    : "/";
  const file = `${lang}-${scope}.json`;
  return `${base}data/glossary/${file}`;
}

/**
 * 加载 glossary 并缓存
 * @param {string} lang - kr | en | zh | jp | vi | kh ...
 * @param {string} scope - hsk1 | hsk2 | global ...
 * @returns {Promise<Record<string,{meaning:string,pos:string}>>}
 */
export async function loadGlossary(lang, scope) {
  if (!lang || !scope) return {};
  const key = cacheKey(lang, scope);
  if (CACHE.has(key)) return CACHE.get(key);

  const url = getGlossaryUrl(lang, scope);
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const obj = typeof data === "object" && data !== null ? data : {};
    CACHE.set(key, obj);
    return obj;
  } catch (e) {
    console.warn("[glossary] load failed:", url, e?.message);
    CACHE.set(key, {});
    return {};
  }
}

/**
 * 从缓存获取词条（同步，需先 loadGlossary）
 * @param {string} hanzi
 * @param {string} lang
 * @param {string} scope
 * @returns {{meaning?:string, pos?:string}|undefined}
 */
export function getGlossaryEntry(hanzi, lang, scope) {
  if (!hanzi || typeof hanzi !== "string") return undefined;
  const key = cacheKey(lang, scope);
  const data = CACHE.get(key);
  if (!data || typeof data !== "object") return undefined;
  return data[hanzi.trim()];
}

/**
 * 获取教学短释义
 * @param {string} hanzi
 * @param {string} lang
 * @param {string} scope
 * @returns {string}
 */
export function getGlossaryMeaning(hanzi, lang, scope) {
  const entry = getGlossaryEntry(hanzi, lang, scope);
  if (!entry) return "";
  const m = entry.meaning;
  return typeof m === "string" && m.trim() ? m.trim() : "";
}

/**
 * 获取词性
 * @param {string} hanzi
 * @param {string} lang
 * @param {string} scope
 * @returns {string}
 */
export function getGlossaryPos(hanzi, lang, scope) {
  const entry = getGlossaryEntry(hanzi, lang, scope);
  if (!entry) return "";
  const p = entry.pos;
  return typeof p === "string" && p.trim() ? p.trim() : "";
}
