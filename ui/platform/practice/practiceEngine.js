/**
 * Practice Engine v1 - 核心逻辑
 * loadPractice(lesson) / submitAnswer(questionId, answer)
 */

import { filterSupportedQuestions } from "./practiceTypes.js";
import * as PracticeState from "./practiceState.js";

/**
 * 加载练习
 * @param {object} lesson - 归一化后的 lesson
 * @returns {{ questions: Array, totalScore: number, currentIndex: number }}
 */
export function loadPractice(lesson) {
  PracticeState.resetPracticeState();
  const raw = Array.isArray(lesson?.practice) ? lesson.practice : [];
  const questions = filterSupportedQuestions(raw);
  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);

  PracticeState.setPracticeState({
    questions,
    totalScore,
    currentIndex: 0,
  });

  return {
    questions,
    totalScore,
    currentIndex: 0,
  };
}

/**
 * 提交答案
 * @param {string} questionId - 题目 id
 * @param {string|Array} answer - 用户答案
 * @returns {{ correct: boolean, score: number }}
 */
export function submitAnswer(questionId, answer) {
  const questions = PracticeState.getQuestions();
  const q = questions.find((x) => x.id === questionId);
  if (!q) return { correct: false, score: 0 };

  const expected = q.answer;
  const score = Number(q.score) || 1;
  let correct = false;

  switch (q.type) {
    case "choice":
      correct = String(answer ?? "").trim() === String(expected ?? "").trim();
      break;
    case "fill":
      correct = String(answer ?? "").trim() === String(expected ?? "").trim();
      break;
    case "order":
      const ansArr = Array.isArray(answer) ? answer : (typeof answer === "string" ? answer.split("") : []);
      const expArr = Array.isArray(expected) ? expected : (typeof expected === "string" ? expected.split("") : []);
      correct = JSON.stringify(ansArr) === JSON.stringify(expArr);
      break;
    case "typing":
      correct = String(answer ?? "").trim() === String(expected ?? "").trim();
      break;
    default:
      correct = false;
  }

  PracticeState.recordAnswer(questionId, { correct, score: correct ? score : 0 });
  return { correct, score: correct ? score : 0 };
}

export { PracticeState };
