/**
 * Practice Engine v1 - 题型定义与校验
 * 支持: choice, fill, order, typing
 */

export const PRACTICE_TYPES = ["choice", "fill", "order", "typing"];

/** 兼容旧 key：reorder -> order */
export function normalizePracticeType(type) {
  const t = String(type || "").toLowerCase().trim();
  if (t === "reorder") return "order";
  return PRACTICE_TYPES.includes(t) ? t : "";
}

/**
 * 校验题目结构
 * @param {object} q - 题目对象
 * @returns {{ valid: boolean, type?: string }}
 */
export function validateQuestion(q) {
  if (!q || typeof q !== "object") return { valid: false };
  const type = normalizePracticeType(q.type);
  if (!type) return { valid: false };
  if (!q.question) return { valid: false, type };
  return { valid: true, type };
}

/**
 * 过滤出支持的题型
 * @param {Array} items - lesson.practice 原始数组
 * @returns {Array<object>} 带 id 的题目列表
 */
export function filterSupportedQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, i) => {
      const { valid, type } = validateQuestion(item);
      if (!valid) return null;
      return {
        ...item,
        type,
        id: item.id || `q-${i + 1}`,
      };
    })
    .filter(Boolean);
}
