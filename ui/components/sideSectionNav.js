/**
 * 全站左侧「页面内分类导航」辅助：解析 hash 查询、与 teacher-shell 视觉一致的 class 见 base.css（.page-shell / .section-side-nav*）
 */

/** @type {readonly ['free','paid','official','teacher']} */
export const RESOURCE_SECTION_IDS = /** @type {const} */ (["free", "paid", "official", "teacher"]);

const RESOURCE_ID_SET = new Set(RESOURCE_SECTION_IDS);

/**
 * @param {string} baseHash 如 "#resources"
 * @param {string} param 如 "tab"
 * @param {string} defaultId
 * @param {Set<string>} allowed
 */
export function parseHashSectionId(baseHash, param, defaultId, allowed) {
  const raw = String(typeof location !== "undefined" ? location.hash || "" : "");
  const want = baseHash.startsWith("#") ? baseHash.toLowerCase() : `#${baseHash}`.toLowerCase();
  const base = raw.split("?")[0].split("/")[0].toLowerCase();
  if (base !== want) return defaultId;
  const q = raw.indexOf("?");
  if (q < 0) return defaultId;
  try {
    const v = String(new URLSearchParams(raw.slice(q + 1)).get(param) || "").toLowerCase();
    if (allowed.has(v)) return v;
  } catch {
    /* */
  }
  return defaultId;
}

/** @param {string} id */
export function isResourceSectionId(id) {
  return RESOURCE_ID_SET.has(String(id || "").toLowerCase());
}

/**
 * @param {'free'|'paid'|'official'|'teacher'} id
 * @returns {{ titleKey: string, descKey: string }}
 */
export function resourceSectionContentKeys(id) {
  const m = {
    free: { titleKey: "resources.free.title", descKey: "resources.free.desc" },
    paid: { titleKey: "resources.paid.title", descKey: "resources.paid.desc" },
    official: { titleKey: "resources.official.title", descKey: "resources.official.desc" },
    teacher: { titleKey: "resources.teacherShared.title", descKey: "resources.teacherShared.desc" },
  };
  return m[id] || m.free;
}
