/**
 * Progress Engine v1 - 学习进度模块
 * 委托 platform/progress，提供统一接口
 */

import * as P from "../../platform/progress/progressEngine.js";
import * as S from "../../platform/progress/progressSelectors.js";

/**
 * 获取课程进度
 * @param {string} courseId
 * @returns {object|null}
 */
export function getProgress(courseId) {
  return S.getCourseProgress?.(courseId) ?? null;
}

/**
 * 获取课程统计
 */
export function getCourseStats(courseId, totalLessons = 0) {
  return S.getCourseStats?.(courseId, totalLessons) ?? {};
}

export const markLessonStarted = P.markLessonStarted ?? (() => {});
export const markLessonCompleted = P.markLessonCompleted ?? (() => {});
export const recordPracticeResult = P.recordPracticeResult ?? (() => {});
