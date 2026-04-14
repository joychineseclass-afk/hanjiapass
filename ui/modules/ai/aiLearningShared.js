/**
 * Lumina：课程 JSON 中 aiLearning 字段的轻量读取（与 aiTutor / 本课重点 / 跟读共用）
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function normLang(lang) {
  const l = String(lang || "kr").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "ko" || l === "kr") return "kr";
  if (l === "jp" || l === "ja") return "jp";
  return "en";
}

/** 与 aiLessonFocus 一致：cn → zh 键 */
export function pickLessonLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = normLang(lang);
  const key = l === "cn" ? "zh" : l === "kr" ? "kr" : l === "jp" ? "jp" : "en";
  const v = obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.en ?? obj.jp;
  return str(v != null ? v : "");
}

export function getAiLearning(lesson) {
  const al = lesson?.aiLearning;
  return al && typeof al === "object" ? al : null;
}

/**
 * @param {object} exObj - freeAskExamples: { kr: string[], cn?: string[], ... }
 * @returns {string[]} 最多 6 条
 */
export function pickFreeAskExampleList(exObj, lang) {
  if (!exObj || typeof exObj !== "object") return [];
  const l = normLang(lang);
  const key = l === "kr" ? "kr" : l === "cn" ? "zh" : l === "jp" ? "jp" : "en";
  const arr =
    exObj[key] ||
    (l === "cn" ? exObj.zh || exObj.cn : null) ||
    exObj.kr ||
    exObj.en ||
    exObj.jp ||
    exObj.zh ||
    exObj.cn;
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => str(s)).filter(Boolean).slice(0, 6);
}

export function pickFreeAskPlaceholder(al, lang) {
  if (!al?.freeAskPlaceholder || typeof al.freeAskPlaceholder !== "object") return "";
  return pickLessonLang(al.freeAskPlaceholder, lang);
}
