/**
 * Practice Auto Generator v1
 * 每课自动生成约 20 题，不依赖 lesson.json 手写题目
 *
 * 题型分布：
 * - 词汇选择题：6 题（vocab）
 * - 听句选词：4 题（dialogue）
 * - 语序题：4 题（dialogue）
 * - 填空题：4 题（dialogue）
 * - 理解题：2 题（dialogue）
 * 总计 20 题
 *
 * 若 lesson.practice 已有题，则优先使用，不足部分由系统补齐
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

/**
 * 生成练习题（用于补齐）
 * @param {object} lesson - 归一化后的 lesson
 * @returns {Array<object>} 题目列表
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
 * @returns {Array<object>} 题目列表
 */
export function generatePractice(lesson, existing = []) {
  if (!lesson) return [];

  const existingValid = Array.isArray(existing) ? existing.filter(Boolean) : [];
  let result = [...existingValid];

  if (result.length < TARGET_COUNT) {
    const generated = generateQuestions(lesson);
    const pool = shuffle(generated);
    for (let i = 0; result.length < TARGET_COUNT && pool.length; i++) {
      result.push(pool[i % pool.length]);
    }
  } else if (result.length > TARGET_COUNT) {
    result = shuffle(result).slice(0, TARGET_COUNT);
  }

  return result.map((q, i) => ({
    ...q,
    id: q.id || `q-${i + 1}`,
  }));
}
