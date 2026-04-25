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

/** @type {readonly ['idioms','proverbs','festivals','etiquette','figures','expressions']} */
export const CULTURE_SECTION_IDS = /** @type {const} */ ([
  "idioms",
  "proverbs",
  "festivals",
  "etiquette",
  "figures",
  "expressions",
]);

const CULTURE_ID_SET = new Set(CULTURE_SECTION_IDS);

/**
 * @param {'idioms'|'proverbs'|'festivals'|'etiquette'|'figures'|'expressions'} id
 * @returns {{ titleKey: string, descKey: string }}
 */
export function cultureSectionContentKeys(id) {
  const m = {
    idioms: { titleKey: "culture.idioms.title", descKey: "culture.idioms.desc" },
    proverbs: { titleKey: "culture.proverbs.title", descKey: "culture.proverbs.desc" },
    festivals: { titleKey: "culture.festivals.title", descKey: "culture.festivals.desc" },
    etiquette: { titleKey: "culture.etiquette.title", descKey: "culture.etiquette.desc" },
    figures: { titleKey: "culture.figures.title", descKey: "culture.figures.desc" },
    expressions: { titleKey: "culture.expressions.title", descKey: "culture.expressions.desc" },
  };
  return m[id] || m.idioms;
}

/** @param {string} id */
export function isCultureSectionId(id) {
  return CULTURE_ID_SET.has(String(id || "").toLowerCase());
}

/** @type {readonly ['basic3000','oracle','korean-test']} */
export const HANJA_SECTION_IDS = /** @type {const} */ (["basic3000", "oracle", "korean-test"]);
const HANJA_ID_SET = new Set(HANJA_SECTION_IDS);

/**
 * @param {'basic3000'|'oracle'|'korean-test'|string} id
 * @returns {{ titleKey: string, descKey: string }}
 */
export function hanjaSectionContentKeys(id) {
  const s = String(id || "basic3000").toLowerCase();
  const m = {
    basic3000: { titleKey: "hanja.basic3000.title", descKey: "hanja.basic3000.desc" },
    oracle: { titleKey: "hanja.oracle.title", descKey: "hanja.oracle.desc" },
    "korean-test": { titleKey: "hanja.koreanTest.title", descKey: "hanja.koreanTest.desc" },
  };
  if (m[s]) return m[s];
  return m.basic3000;
}

/** @param {string} id */
export function isHanjaSectionId(id) {
  return HANJA_ID_SET.has(String(id || "").toLowerCase());
}
