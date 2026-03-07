/**
 * Practice Engine v1 - 状态管理
 * 管理 currentQuestion、score、progress
 */

let state = {
  currentIndex: 0,
  score: 0,
  totalScore: 0,
  questions: [],
  answered: new Map(), // questionId -> { correct, score }
};

export function resetPracticeState() {
  state = {
    currentIndex: 0,
    score: 0,
    totalScore: 0,
    questions: [],
    answered: new Map(),
  };
}

export function setPracticeState(next) {
  if (next?.questions) state.questions = next.questions;
  if (typeof next?.totalScore === "number") state.totalScore = next.totalScore;
  if (typeof next?.currentIndex === "number") state.currentIndex = next.currentIndex;
}

export function getCurrentQuestion() {
  return state.questions[state.currentIndex] ?? null;
}

export function getCurrentIndex() {
  return state.currentIndex;
}

export function getQuestions() {
  return state.questions;
}

export function getScore() {
  return state.score;
}

export function getTotalScore() {
  return state.totalScore;
}

export function getProgress() {
  const total = state.questions.length;
  if (!total) return { current: 0, total: 0, percent: 0 };
  return {
    current: state.currentIndex + 1,
    total,
    percent: Math.round(((state.currentIndex + 1) / total) * 100),
  };
}

export function recordAnswer(questionId, { correct, score }) {
  state.answered.set(questionId, { correct, score });
  if (correct) state.score += score;
}

export function goToNext() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    return true;
  }
  state.currentIndex = state.questions.length;
  return true;
}

export function isLastQuestion() {
  return state.currentIndex >= state.questions.length - 1;
}
