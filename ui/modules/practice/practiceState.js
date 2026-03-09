/**
 * Practice Engine v1 - 状态管理（整页提交批改模式）
 */

let state = {
  questions: [],
  answers: {},
  submitted: false,
  resultMap: {},
  score: 0,
  totalScore: 0,
};

export function resetPracticeState() {
  state = {
    questions: [],
    answers: {},
    submitted: false,
    resultMap: {},
    score: 0,
    totalScore: 0,
  };
}

export function setPracticeState(next) {
  if (next?.questions) state.questions = next.questions;
  if (typeof next?.totalScore === "number") state.totalScore = next.totalScore;
  if (next?.answers && typeof next.answers === "object") state.answers = { ...next.answers };
}

export function getQuestions() {
  return state.questions;
}

export function getAnswers() {
  return { ...state.answers };
}

export function setAnswer(questionId, value) {
  state.answers[questionId] = value;
}

export function getAnswer(questionId) {
  return state.answers[questionId] ?? null;
}

export function isSubmitted() {
  return state.submitted;
}

export function setSubmitted(val) {
  state.submitted = !!val;
}

export function getResultMap() {
  return { ...state.resultMap };
}

export function setResultMap(map) {
  state.resultMap = { ...map };
  state.score = Object.values(map).reduce((sum, r) => sum + (r?.score ?? 0), 0);
}

export function getScore() {
  return state.score;
}

export function getTotalScore() {
  return state.totalScore;
}

export function getCorrectCount() {
  return Object.values(state.resultMap).filter((x) => x?.correct).length;
}
