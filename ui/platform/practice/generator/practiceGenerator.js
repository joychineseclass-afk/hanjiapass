/**
 * Practice Auto Generator v1
 * 每课自动生成约 20 题，统一为 choice 题型
 *
 * 题型分布（全部 type: "choice"）：
 * - 词汇选择题：6 题（vocab）
 * - 听句选词：4 题（dialogue）
 * - 语序选择题：4 题（dialogue）
 * - 填空题：4 题（dialogue）
 * - 理解题：2 题（dialogue）
 * - 语法选择题：3 题（grammar）
 *
 * 若 lesson.practice 已有题，则优先使用，不足部分由系统补齐
 * 所有题目统一为 choice，保证 Practice UI 正常显示 20/20 题
 */

import { generateFromVocab } from "./vocabGenerator.js";
import { generateFromDialogue } from "./dialogueGenerator.js";
import { generateFromGrammar } from "./grammarGenerator.js";

const TARGET_COUNT = 20;

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

/**
 * 将任意题型统一为 choice 格式
 * 保证 question、options、answer 存在
 */
function normalizeToChoice(q) {
  if (!q || !q.question) return null;
  const type = String(q.type || "").toLowerCase();
  const question = pickQuestionText(q) || (typeof q.question === "object" ? JSON.stringify(q.question) : "");
  if (!question) return null;

  let options = Array.isArray(q.options) ? q.options : [];
  const answer = str(q.answer ?? q.correct ?? "");

  if (type !== "choice") {
    if (!options.length && answer) {
      options = [answer, "其他", "不确定", "跳过"];
    }
  }
  if (options.length < 2) options = [answer || "A", "B", "C", "D"].slice(0, 4);
  if (!answer && options[0]) options = shuffle(options);

  return {
    ...q,
    type: "choice",
    question: q.question,
    options,
    answer: answer || options[0],
    id: q.id,
  };
}

/**
 * 生成练习题（用于补齐）
 */
function generateQuestions(lesson) {
  if (!lesson) return [];
  const vocab = generateFromVocab(lesson);
  const dialogue = generateFromDialogue(lesson);
  const grammar = generateFromGrammar(lesson);
  return [...vocab, ...dialogue, ...grammar];
}

/**
 * 生成练习题
 * @param {object} lesson - 归一化后的 lesson
 * @param {Array} [existing] - 已有题目（来自 lesson.practice）
 * @returns {Array<object>} 题目列表（全部 type: "choice"）
 */
export function generatePractice(lesson, existing = []) {
  if (!lesson) return [];

  const existingValid = Array.isArray(existing) ? existing.filter(Boolean) : [];
  let result = existingValid.map(normalizeToChoice).filter(Boolean);

  if (result.length < TARGET_COUNT) {
    const generated = generateQuestions(lesson);
    const pool = shuffle(generated);
    for (let i = 0; result.length < TARGET_COUNT && pool.length; i++) {
      const q = normalizeToChoice(pool[i % pool.length]);
      if (q) result.push(q);
    }
  } else if (result.length > TARGET_COUNT) {
    result = shuffle(result).slice(0, TARGET_COUNT);
  }

  return result.map((q, i) => ({
    ...q,
    id: q.id || `q-${i + 1}`,
  }));
}
