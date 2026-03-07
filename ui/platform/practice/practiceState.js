/**
 * Practice Engine v1 - 状态管理（整页提交批改模式）
 * questions, answers, submitted, resultMap, score
 */

let state = {
  questions: [],
  answers: {},       // { questionId: selectedOptionValue }
  submitted: false,
  resultMap: {},     // { questionId: { correct, selected, answer, score } }
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

/** 答对题数（供 Progress Engine 使用） */
export function getCorrectCount() {
  return Object.values(state.resultMap).filter((x) => x?.correct).length;
}

/** 兼容旧接口 */
export function getCurrentQuestion() {
  return state.questions[0] ?? null;
}

export function getCurrentIndex() {
  return 0;
}

export function getProgress() {
  const total = state.questions.length;
  return { current: 1, total, percent: total ? 100 : 0 };
}

export function recordAnswer(questionId, { correct, score }) {
  if (!state.resultMap[questionId]) state.resultMap[questionId] = {};
  state.resultMap[questionId].correct = correct;
  state.resultMap[questionId].score = correct ? score : 0;
  if (correct) state.score += score;
}

export function goToNext() {
  return true;
}

export function isLastQuestion() {
  return true;
}
