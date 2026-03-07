/**
 * 平台级 Step 注册表
 * 统一定义 step key，兼容旧 key 映射
 */

export const STEP_KEYS = ["vocab", "dialogue", "grammar", "practice", "aiPractice", "review"];

const KEY_ALIAS = {
  words: "vocab",
  ai: "aiPractice",
  ai_interaction: "aiPractice",
};

/** 归一化 step key */
export function normalizeStepKey(key) {
  if (!key || typeof key !== "string") return "";
  const k = key.trim().toLowerCase();
  return KEY_ALIAS[k] || k;
}

const DEFAULT_STEPS = [
  { key: "vocab", label: { zh: "单词", kr: "단어", en: "Words" } },
  { key: "dialogue", label: { zh: "会话", kr: "회화", en: "Dialogue" } },
  { key: "grammar", label: { zh: "语法", kr: "문법", en: "Grammar" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice" } },
  { key: "aiPractice", label: { zh: "AI学习", kr: "AI 학습", en: "AI Practice" } },
];

const REVIEW_STEPS = [
  { key: "review", label: { zh: "复习", kr: "복습", en: "Review" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice" } },
  { key: "aiPractice", label: { zh: "AI学习", kr: "AI 학습", en: "AI Practice" } },
];

/** 根据 lesson 返回默认 steps */
export function getDefaultStepsByLesson(lesson) {
  const isReview = lesson?.type === "review";
  return isReview ? [...REVIEW_STEPS] : [...DEFAULT_STEPS];
}

/** 将 raw steps 规范化为对象数组 */
export function normalizeSteps(rawSteps, lesson) {
  const def = getDefaultStepsByLesson(lesson);
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return def;

  return rawSteps.map((s) => {
    if (typeof s === "string") {
      const k = normalizeStepKey(s);
      const found = def.find((d) => d.key === k);
      return found || { key: k, label: { zh: k, kr: k, en: k } };
    }
    if (s && typeof s === "object") {
      const k = normalizeStepKey(s.key || "vocab");
      const label = s.label && typeof s.label === "object"
        ? { zh: s.label.zh || k, kr: s.label.kr || s.label.ko || k, en: s.label.en || k }
        : (def.find((d) => d.key === k)?.label || { zh: k, kr: k, en: k });
      return { key: k, label };
    }
    return def[0];
  }).filter((s) => s && s.key);
}
