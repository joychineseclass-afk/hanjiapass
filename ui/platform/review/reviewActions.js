/**
 * Review Mode Engine v1 - 动作
 */

import * as ProgressEngine from "../progress/progressEngine.js";
import * as SessionBuilder from "./reviewSessionBuilder.js";
import * as ReviewEngine from "./reviewModeEngine.js";

export { buildReviewSession } from "./reviewSessionBuilder.js";
export { prepareReviewSession, submitReview } from "./reviewModeEngine.js";

/**
 * 获取错题（代理到 Progress）
 */
export function getWrongQuestions() {
  return ProgressEngine.getWrongQuestions();
}

export function getWrongQuestionsByLesson(lessonId) {
  return ProgressEngine.getWrongQuestionsByLesson(lessonId);
}

export function getWrongQuestionsByCourse(courseId) {
  return ProgressEngine.getWrongQuestionsByCourse(courseId);
}

/**
 * 记录复习提交
 */
export function recordReviewSubmit(params) {
  return ProgressEngine.recordReviewSubmit(params);
}

/**
 * 移除单道错题
 */
export function removeWrongQuestion(questionId, lessonId) {
  return ProgressEngine.removeWrongQuestion(questionId, lessonId);
}

/**
 * 复习统计
 */
export function getReviewStats() {
  return ProgressEngine.getReviewStats();
}
