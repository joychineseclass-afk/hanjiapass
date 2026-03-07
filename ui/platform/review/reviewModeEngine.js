/**
 * Review Mode Engine v1 - 核心逻辑
 */

import { i18n } from "../../i18n.js";
import * as SessionBuilder from "./reviewSessionBuilder.js";
import * as ReviewState from "./reviewState.js";
import * as ProgressEngine from "../progress/progressEngine.js";

/**
 * 从 wrongQuestion 解析为可渲染的题目
 */
function resolveQuestion(wrongItem) {
  const snap = wrongItem?.questionSnapshot;
  if (!snap || !snap.question) {
    return null;
  }
  const opts = Array.isArray(snap.options) ? snap.options : [];
  const qObj = typeof snap.question === "object" ? snap.question : { zh: String(snap.question ?? "") };
  return {
    id: wrongItem.questionId,
    lessonId: wrongItem.lessonId,
    question: qObj,
    options: opts,
    answer: snap.answer,
    explanation: snap.explanation,
    type: "choice",
    subtype: wrongItem.subtype,
    score: 1,
    _wrongItem: wrongItem,
  };
}

/**
 * 构建并解析复习会话
 * @param {{ mode, lessonId?, levelKey? }}
 * @returns {{ session, questions }}
 */
export function prepareReviewSession(params) {
  const session = SessionBuilder.buildReviewSession(params);
  const questions = session.items
    .map((w) => resolveQuestion(w))
    .filter(Boolean);
  session.questions = questions;
  return { session, questions };
}

/**
 * 判题（与 practice 一致）
 */
function judgeOne(q, answer, lang) {
  const expected = q.answer;
  const sel = String(answer ?? "").trim();
  let exp = "";
  if (expected == null) exp = "";
  else if (typeof expected === "object") {
    const l = (lang || "ko").toLowerCase();
    exp = l === "zh" || l === "cn"
      ? String(expected.zh ?? expected.cn ?? expected.kr ?? expected.ko ?? expected.en ?? "").trim()
      : l === "en"
        ? String(expected.en ?? expected.kr ?? expected.ko ?? expected.zh ?? expected.cn ?? "").trim()
        : String(expected.kr ?? expected.ko ?? expected.en ?? expected.zh ?? expected.cn ?? "").trim();
  } else {
    exp = String(expected ?? "").trim();
  }
  return sel === exp;
}

/**
 * 提交复习
 * @returns {{ correctCount, total, results, clearedCount }}
 */
export function submitReview() {
  const session = ReviewState.getSession();
  const answers = ReviewState.getAnswers();
  const questions = session?.questions || [];
  const lang = (i18n?.getLang?.()) ? String(i18n.getLang()).toLowerCase() : "ko";
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "en" ? "en" : "ko";

  const beforeWrong = ProgressEngine.getWrongQuestions().length;
  const results = [];
  let correctCount = 0;

  questions.forEach((q) => {
    const selected = answers[q.id];
    const correct = judgeOne(q, selected, langKey);
    if (correct) correctCount++;
    results.push({
      questionId: q.id,
      lessonId: q.lessonId,
      correct,
    });
  });

  ProgressEngine.recordReviewSubmit({
    sessionId: session?.id,
    results,
  });

  const afterWrong = ProgressEngine.getWrongQuestions().length;
  const clearedCount = beforeWrong - afterWrong;

  const resultMap = {};
  questions.forEach((q) => {
    const r = results.find((x) => x.questionId === q.id);
    if (r) resultMap[q.id] = { correct: r.correct, answer: q.answer };
  });
  ReviewState.setResultMap(resultMap);
  ReviewState.setSubmitted(true);
  ReviewState.setReviewResult({
    correctCount,
    total: questions.length,
    results,
    clearedCount,
  });

  return {
    correctCount,
    total: questions.length,
    results,
    clearedCount,
  };
}
