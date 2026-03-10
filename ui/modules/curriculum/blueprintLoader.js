/**
 * Lumina Curriculum Blueprint Loader
 * 加载课程蓝图（仅结构：title, grammar, scene），不生成内容
 */

const CACHE = new Map();

function getBase() {
  try {
    const base = window.DATA_PATHS?.getBase?.();
    if (base && String(base).trim()) return String(base).replace(/\/+$/, "") + "/";
  } catch {}
  const appBase = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  return appBase ? appBase + "/" : "/";
}

/**
 * 加载蓝图
 * @param {string} level - "hsk1" | "hsk2"
 * @returns {Promise<Object>} 蓝图对象，key 为课序号 "1" "2" ... "22"
 */
export async function loadBlueprint(level) {
  const key = String(level || "hsk1").toLowerCase().replace(/^hsk/, "hsk");
  const cacheKey = key.startsWith("hsk") ? key : `hsk${key}`;

  const hit = CACHE.get(cacheKey);
  if (hit) return hit;

  const url = getBase() + `data/pedagogy/${cacheKey}-blueprint.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      CACHE.set(cacheKey, null);
      return null;
    }
    const data = await res.json();
    const blueprint = {};
    for (const k of Object.keys(data)) {
      if (k !== "description" && k !== "version" && /^\d+$/.test(k)) {
        blueprint[k] = data[k];
      }
    }
    CACHE.set(cacheKey, blueprint);
    return blueprint;
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[Blueprint] load failed:", cacheKey, err?.message);
    }
    CACHE.set(cacheKey, null);
    return null;
  }
}
