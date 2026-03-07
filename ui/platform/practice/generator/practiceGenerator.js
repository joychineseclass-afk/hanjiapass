/**
 * Practice Generator v2
 * 按 HSK 等级控制题量，优先使用 lesson.practice 人工题
 *
 * 题量规则：
 * HSK1-2: 5题
 * HSK3-4: 10题
 * HSK5-6: 15题
 * HSK7-9: 20题
 */

import { generateFromVocab } from "./vocabGenerator.js";
import { generateFromDialogue } from "./dialogueGenerator.js";
import { generateFromGrammar } from "./grammarGenerator.js";

/** 按等级获取目标题量 */
export function getTargetCountByLevel(level) {
  const lv = parseInt(String(level || "").replace(/\D/g, ""), 10) || 1;
  if (lv <= 2) return 5;
  if (lv <= 4) return 10;
  if (lv <= 6) return 15;
  return 20;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function pickQuestionText(q) {
  const qu = q?.question;
  if (typeof qu === "string") return qu;
  return str(qu?.zh ?? qu?.cn ?? qu?.kr ?? qu?.ko ?? qu?.en) || "";
}

/** 校验题目逻辑：question、options、answer 需匹配 */
function normalizeToChoice(q) {
  if (!q || !q.question) return null;
  const question = pickQuestionText(q) || (typeof q.question === "object" ? JSON.stringify(q.question) : "");
  if (!question) return null;

  let options = Array.isArray(q.options) ? q.options : [];
  const answer = str(q.answer ?? q.correct ?? "");

  if (options.length < 2 && answer) {
    options = [answer, ...options.filter((o) => o !== answer)];
  }
  if (options.length < 2) options = [answer || "A", "B", "C", "D"].slice(0, 4);
  if (!answer && options[0]) options = shuffle(options);

  return {
    ...q,
    type: "choice",
    question: q.question,
    options: [...new Set(options)].slice(0, 6),
    answer: answer || options[0],
    id: q.id,
  };
}

/** 按等级生成题目池（用于补足） */
function generateByLevel(lesson, level) {
  const lv = parseInt(String(level || "").replace(/\D/g, ""), 10) || 1;
  const vocab = generateFromVocab(lesson, lv);
  const dialogue = generateFromDialogue(lesson, lv);
  const grammar = generateFromGrammar(lesson, lv);
  return [...vocab, ...dialogue, ...grammar];
}

/**
 * 生成练习题
 * @param {object} lesson - 归一化后的 lesson
 * @param {Array} [existing] - lesson.practice
 * @returns {Array<object>}
 */
export function generatePractice(lesson, existing = []) {
  if (!lesson) return [];

  const level = lesson?.level ?? lesson?.courseId ?? "";
  const targetCount = getTargetCountByLevel(level);

  const existingValid = Array.isArray(existing) ? existing.filter(Boolean) : [];
  let result = existingValid.map(normalizeToChoice).filter(Boolean);

  if (result.length < targetCount) {
    const generated = generateByLevel(lesson, level);
    const pool = shuffle(generated);
    for (let i = 0; result.length < targetCount && pool.length; i++) {
      const q = normalizeToChoice(pool[i % pool.length]);
      if (q && !result.some((r) => r.id === q.id)) result.push(q);
    }
  }

  if (result.length > targetCount) {
    result = result.slice(0, targetCount);
  }

  return result.map((q, i) => ({
    ...q,
    id: q.id || `q-${i + 1}`,
  }));
}
