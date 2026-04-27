/**
 * 统一学习承载层 — 课程 / 课次上下文
 * 不承载 UI；仅描述「当前打开的是哪种学习、来自哪里、用哪些键定位」
 */

/** @typedef {'hsk' | 'kids' | 'classroom_asset' | 'teacher_course' | 'unknown'} LessonSourceType */
/** @typedef {'student' | 'teacher' | 'preview'} LessonExperienceMode */

/**
 * 与文档任务书方向对齐的 course context（可逐步扩展，不要求一次填满）
 *
 * @typedef {Object} LessonExperienceContext
 * @property {LessonSourceType} sourceType
 * @property {LessonExperienceMode} mode
 * @property {string} courseId
 * @property {string} [version]
 * @property {string} level
 * @property {string} lessonId
 * @property {string} [assetId]
 * @property {string} [listingId]
 * @property {string} [gcePathVersion]
 * @property {string} [gcePathLevel]
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * @param {string} [hash=location.hash]
 * @returns {Record<string, string>}
 */
export function parseHashQueryString(hash) {
  const h = String(hash || "");
  const qIndex = h.indexOf("?");
  const query = qIndex >= 0 ? h.slice(qIndex + 1) : "";
  const out = /** @type {Record<string, string>} */ ({});
  if (!query) return out;
  query.split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    if (!k) return;
    out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return out;
}

/**
 * @param {string} hash
 */
export function hashHasQueryString(hash) {
  const h = String(hash || "");
  const qIndex = h.indexOf("?");
  return qIndex >= 0 && h.slice(qIndex + 1).trim().length > 0;
}

/**
 * 构建空上下文占位（resolve 失败或跳过加载时仍可用于 UI）
 * @param {Partial<LessonExperienceContext>} p
 * @returns {LessonExperienceContext}
 */
export function createLessonExperienceContext(p = {}) {
  return {
    sourceType: /** @type {LessonSourceType} */ (p.sourceType || "unknown"),
    mode: /** @type {LessonExperienceMode} */ (p.mode || "student"),
    courseId: str(p.courseId) || "kids",
    version: p.version,
    level: str(p.level) || "1",
    lessonId: str(p.lessonId) || "1",
    assetId: p.assetId,
    listingId: p.listingId,
    gcePathVersion: p.gcePathVersion,
    gcePathLevel: p.gcePathLevel,
  };
}
