/**
 * Auto Practice Generator v1
 * 当 lesson.practice 不存在时，根据 lesson 内容自动生成 20 道题
 *
 * 规则：
 * - vocab: 5 choice + 5 fill
 * - dialogue: 4 choice + 3 order
 * - grammar: 3 fill
 * 总计 20 题
 */

import { generateFromVocab } from "./vocabGenerator.js";
import { generateFromDialogue } from "./dialogueGenerator.js";
import { generateFromGrammar } from "./grammarGenerator.js";

const TARGET_COUNT = 20;

/**
 * 生成练习题
 * @param {object} lesson - 归一化后的 lesson
 * @returns {Array<object>} 题目列表
 */
export function generatePractice(lesson) {
  if (!lesson) return [];

  const vocab = generateFromVocab(lesson);
  const dialogue = generateFromDialogue(lesson);
  const grammar = generateFromGrammar(lesson);

  const all = [...vocab, ...dialogue, ...grammar];

  let result = all;
  if (all.length < TARGET_COUNT) {
    const repeat = [...all];
    while (result.length < TARGET_COUNT && repeat.length) {
      result = [...result, ...repeat.slice(0, TARGET_COUNT - result.length)];
    }
  } else if (all.length > TARGET_COUNT) {
    result = all.slice(0, TARGET_COUNT);
  }

  return result.map((q, i) => ({
    ...q,
    id: q.id || `q-auto-${i + 1}`,
  }));
}
