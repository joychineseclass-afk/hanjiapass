/**
 * Practice Engine v1 - 统一练习题数据结构
 * 支持 choice / fill / match / order 四种题型
 *
 * Schema 示例:
 *
 * choice:
 * { id, type: "choice", prompt: { cn, kr, en, jp }, options: [], answer, explanation: {} }
 *
 * fill:
 * { id, type: "fill", prompt: { cn, kr, en, jp }, answer, explanation: {} }
 *
 * match:
 * { id, type: "match", pairs: [{ left, right }], explanation: {} }
 *
 * order:
 * { id, type: "order", prompt: { cn, kr, en, jp }, items: [], answer: [], explanation: {} }
 */

export const PRACTICE_TYPES = ["choice", "fill", "match", "order"];

/** 兼容旧 key：question -> prompt, reorder -> order */
export function normalizePracticeType(type) {
  const t = String(type || "").toLowerCase().trim();
  if (t === "reorder") return "order";
  return PRACTICE_TYPES.includes(t) ? t : "";
}

/**
 * 校验题目结构
 */
export function validateQuestion(q) {
  if (!q || typeof q !== "object") return { valid: false };
  const type = normalizePracticeType(q.type);
  if (!type) return { valid: false };

  const promptOrQuestion = q.prompt ?? q.question;
  if (type === "choice" || type === "fill" || type === "order") {
    if (!promptOrQuestion) return { valid: false, type };
  }
  if (type === "match") {
    const pairs = q.pairs ?? q.items;
    if (!Array.isArray(pairs) || pairs.length < 2) return { valid: false, type };
  }
  if (type === "order") {
    const items = q.items ?? q.options ?? [];
    if (!Array.isArray(items) || items.length < 2) return { valid: false, type };
  }
  return { valid: true, type };
}

/**
 * 过滤并标准化题目
 */
export function filterSupportedQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, i) => {
      const { valid, type } = validateQuestion(item);
      if (!valid) return null;
      const normalized = normalizeItem(item, type, i);
      return { ...normalized, type, id: item.id || `p${i + 1}` };
    })
    .filter(Boolean);
}

function normalizeItem(item, type, index) {
  const promptOrQuestion = item.prompt ?? item.question;
  const prompt = typeof promptOrQuestion === "object" ? promptOrQuestion : { cn: String(promptOrQuestion || ""), kr: "", en: "", jp: "" };
  const answer = item.answer ?? item.correct ?? item.key;
  const explanation = item.explanation ?? item.explain ?? {};

  const base = { prompt, answer, explanation, score: Number(item.score) || 1 };

  if (type === "choice") {
    return { ...base, options: Array.isArray(item.options) ? item.options : [] };
  }
  if (type === "fill") {
    return base;
  }
  if (type === "match") {
    const pairs = item.pairs ?? item.items ?? [];
    return { ...base, pairs: pairs.map((p) => ({ left: p.left ?? p[0] ?? "", right: p.right ?? p[1] ?? "" })) };
  }
  if (type === "order") {
    const items = item.items ?? item.options ?? [];
    const ansArr = Array.isArray(answer) ? answer : (typeof answer === "string" ? [answer] : []);
    return { ...base, items, answer: ansArr.length ? ansArr : items };
  }
  return base;
}
