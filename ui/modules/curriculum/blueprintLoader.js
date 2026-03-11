/**
 * Lumina Curriculum Blueprint Loader
 * 加载课程蓝图（仅结构：title, grammar, scene），不生成内容
 * 路径与 DATA_PATHS / dataPaths 一致：data/pedagogy/{level}-blueprint.json
 */

const CACHE = new Map();

function getBlueprintUrl(cacheKey) {
  try {
    const base = window.DATA_PATHS?.getBase?.();
    const b = base && String(base).trim();
    const root = b ? String(base).replace(/\/+$/, "") + "/" : "/";
    return root + `data/pedagogy/${cacheKey}-blueprint.json`;
  } catch {}
  const appBase = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = appBase ? appBase + "/" : "/";
  return root + `data/pedagogy/${cacheKey}-blueprint.json`;
}

/**
 * 加载课程蓝图
 * hsk1 读取 data/pedagogy/hsk1-blueprint.json，后续可扩展 hsk2 等。
 * @param {string} courseId - 课程标识，如 "hsk1" | "hsk2"
 * @returns {Promise<Object|null>} 课序为 key 的蓝图对象 { "1": { title, coreSentence, ... }, "2": {...} }，失败返回 null
 */
export async function loadBlueprint(courseId) {
  const key = String(courseId || "hsk1").toLowerCase().replace(/^hsk/, "hsk");
  const cacheKey = key.startsWith("hsk") ? key : `hsk${key}`;

  const hit = CACHE.get(cacheKey);
  if (hit) return hit;

  const url = getBlueprintUrl(cacheKey);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[Blueprint] load failed (404 or error):", url, "status:", res.status);
      }
      CACHE.set(cacheKey, null);
      return null;
    }
    const data = await res.json();
    // 新结构：data.lessons 为 { "1": {...}, "2": {...} }
    let blueprint = null;
    if (data.lessons && typeof data.lessons === "object") {
      blueprint = data.lessons;
    } else {
      // 兼容旧版：课序在顶层
      blueprint = {};
      for (const k of Object.keys(data)) {
        if (k !== "description" && k !== "version" && k !== "course" && /^\d+$/.test(k)) {
          blueprint[k] = data[k];
        }
      }
    }
    CACHE.set(cacheKey, blueprint);
    return blueprint;
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[Blueprint] load failed:", cacheKey, url, err?.message);
    }
    CACHE.set(cacheKey, null);
    return null;
  }
}
