/**
 * Practice Engine v1 - 核心逻辑（整页提交批改模式）
 * loadPractice(lesson) / submitAll()
 */

import { filterSupportedQuestions } from "./practiceTypes.js";
import * as PracticeState from "./practiceState.js";
import { generatePractice } from "./generator/practiceGenerator.js";

/**
 * 加载练习
 * @param {object} lesson - 归一化后的 lesson
 * @returns {{ questions: Array, totalScore: number }}
 */
export function loadPractice(lesson) {
  PracticeState.resetPracticeState();
  const existing = Array.isArray(lesson?.practice) ? lesson.practice : [];
  const raw = generatePractice(lesson, existing);
  const questions = filterSupportedQuestions(raw);
  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);

  PracticeState.setPracticeState({
    questions,
    totalScore,
  });

  return {
    questions,
    totalScore,
  };
}

/**
 * 单题判题（内部用）
 */
function judgeOne(q, answer) {
  const expected = q.answer;
  const score = Number(q.score) || 1;
  let correct = false;
  const type = String(q.type || "choice").toLowerCase();

  if (type === "choice" || type === "fill" || type === "typing") {
    correct = String(answer ?? "").trim() === String(expected ?? "").trim();
  } else if (type === "order") {
    const ansArr = Array.isArray(answer) ? answer : (typeof answer === "string" ? answer.split("") : []);
    const expArr = Array.isArray(expected) ? expected : (typeof expected === "string" ? expected.split("") : []);
    correct = JSON.stringify(ansArr) === JSON.stringify(expArr);
  }

  return { correct, score: correct ? score : 0 };
}

/**
 * 整页提交批改
 * @returns {{ resultMap: object, score: number, correctCount: number }}
 */
export function submitAll() {
  const questions = PracticeState.getQuestions();
  const answers = PracticeState.getAnswers();
  const resultMap = {};
  let score = 0;

  questions.forEach((q) => {
    const selected = answers[q.id] ?? null;
    const { correct, score: s } = judgeOne(q, selected);
    resultMap[q.id] = {
      correct,
      selected,
      answer: q.answer,
      score: s,
    };
    if (correct) score += s;
  });

  PracticeState.setResultMap(resultMap);
  PracticeState.setSubmitted(true);

  return {
    resultMap,
    score,
    correctCount: Object.values(resultMap).filter((r) => r?.correct).length,
  };
}

/** 兼容：单题提交（供 Progress 等调用时 fallback） */
export function submitAnswer(questionId, answer) {
  const questions = PracticeState.getQuestions();
  const q = questions.find((x) => x.id === questionId);
  if (!q) return { correct: false, score: 0 };
  const { correct, score } = judgeOne(q, answer);
  PracticeState.recordAnswer(questionId, { correct, score: correct ? score : 0 });
  return { correct, score: correct ? score : 0 };
}

export { PracticeState };
