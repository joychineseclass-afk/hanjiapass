/**
 * Progress Engine v1 - 查询接口
 */

import * as Store from "./progressStore.js";
import * as Scheduler from "./reviewScheduler.js";

/**
 * 获取课程进度
 */
export function getCourseProgress(courseId) {
  if (!courseId) return null;
  const data = Store.loadProgress();
  return data.courses?.[courseId] ?? null;
}

/**
 * 获取单课进度
 */
export function getLessonProgress(courseId, lessonId) {
  const course = getCourseProgress(courseId);
  if (!course) return null;
  return course.lessons?.[lessonId] ?? null;
}

/**
 * 获取待复习词列表
 */
export function getDueReviewItems(courseId, now = Date.now()) {
  const course = getCourseProgress(courseId);
  if (!course?.vocab) return [];
  return Object.values(course.vocab).filter((item) => Scheduler.isDueReview(item, now));
}

/**
 * 已完成课程数
 */
export function getCompletedLessonCount(courseId) {
  const course = getCourseProgress(courseId);
  if (!course?.lessons) return 0;
  return Object.values(course.lessons).filter((l) => l.completedAt > 0).length;
}

/**
 * 当前进行到的课号
 */
export function getCurrentLessonNo(courseId) {
  const course = getCourseProgress(courseId);
  return course?.lastLessonNo ?? 0;
}

/**
 * 课程统计
 */
export function getCourseStats(courseId, totalLessons = 0) {
  const course = getCourseProgress(courseId);
  const completed = getCompletedLessonCount(courseId);
  const dueReview = getDueReviewItems(courseId).length;
  const lastLessonNo = course?.lastLessonNo ?? 0;
  const lessonTimes = Object.values(course?.lessons ?? {}).map((l) => l.startedAt || l.completedAt || 0);
  const updatedAt = lessonTimes.length ? Math.max(...lessonTimes, 0) : 0;
  return {
    completedLessonCount: completed,
    totalLessons,
    lastLessonNo,
    dueReviewCount: dueReview,
    lastActivityAt: updatedAt,
  };
}
