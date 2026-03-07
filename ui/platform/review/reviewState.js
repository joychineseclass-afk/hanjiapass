/**
 * Review Mode Engine v1 - 复习会话状态
 */

let _session = null;
let _answers = {};
let _submitted = false;
let _resultMap = {};
let _reviewResult = null;

export function getSession() {
  return _session;
}

export function setSession(session) {
  _session = session;
  _answers = {};
  _submitted = false;
  _resultMap = {};
  _reviewResult = null;
}

export function getReviewResult() {
  return _reviewResult;
}

export function setReviewResult(r) {
  _reviewResult = r;
}

export function getAnswers() {
  return { ..._answers };
}

export function setAnswer(questionId, answer) {
  _answers[questionId] = answer;
}

export function isSubmitted() {
  return _submitted;
}

export function setSubmitted(v) {
  _submitted = !!v;
}

export function getResultMap() {
  return { ..._resultMap };
}

export function setResultMap(map) {
  _resultMap = map || {};
}

export function resetReviewState() {
  _session = null;
  _answers = {};
  _submitted = false;
  _resultMap = {};
  _reviewResult = null;
}
