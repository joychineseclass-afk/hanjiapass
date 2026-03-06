/**
 * 统一 steps 结构与 step key 命名
 * - step keys: vocab | dialogue | grammar | practice | review | aiPractice
 * - 兼容旧: words→vocab, ai→aiPractice
 */

export const DEFAULT_STEPS = [
  { key: "vocab", label: { zh: "词汇", kr: "단어", en: "Words" } },
  { key: "dialogue", label: { zh: "对话", kr: "대화", en: "Dialogue" } },
  { key: "grammar", label: { zh: "语法", kr: "문법", en: "Grammar" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice" } },
  { key: "aiPractice", label: { zh: "AI练习", kr: "AI 연습", en: "AI Practice" } },
];

export const REVIEW_STEPS = [
  { key: "review", label: { zh: "复习", kr: "복습", en: "Review" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice" } },
  { key: "aiPractice", label: { zh: "AI练习", kr: "AI 연습", en: "AI Practice" } },
];

const KEY_ALIAS = { words: "vocab", ai: "aiPractice" };

/** 从 step 对象或字符串提取 key */
export function stepKey(step) {
  if (!step) return "";
  if (typeof step === "string") {
    return KEY_ALIAS[step] || step;
  }
  const k = step?.key || "";
  return KEY_ALIAS[k] || k;
}

/** 将 raw steps 规范化为对象数组 */
export function normalizeSteps(raw, isReview = false) {
  const def = isReview ? REVIEW_STEPS : DEFAULT_STEPS;
  if (!Array.isArray(raw) || raw.length === 0) return def;

  return raw.map((s) => {
    if (typeof s === "string") {
      const k = KEY_ALIAS[s] || s;
      const found = def.find((d) => d.key === k);
      return found || { key: k, label: { zh: k, kr: k, en: k } };
    }
    if (s && typeof s === "object") {
      const k = KEY_ALIAS[s.key] || s.key || "vocab";
      return {
        key: k,
        label: s.label && typeof s.label === "object"
          ? { zh: s.label.zh || k, kr: s.label.kr || s.label.ko || k, en: s.label.en || k }
          : (def.find((d) => d.key === k)?.label || { zh: k, kr: k, en: k }),
      };
    }
    return def[0];
  }).filter((s) => s && s.key);
}

/** 从 steps 对象数组提取 key 数组（供 engine 使用） */
export function stepKeys(steps) {
  return (steps || DEFAULT_STEPS).map((s) => stepKey(s));
}
