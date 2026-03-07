/**
 * Review Mode Engine v1 - 选择器
 */

import * as Store from "../progress/progressStore.js";

/**
 * 获取全部错题（含迁移旧结构）
 */
export function getWrongQuestions() {
  const data = Store.loadProgress();
  const list = Array.isArray(data.wrongQuestions) ? data.wrongQuestions : [];
  return list.map(migrateWrongQuestion);
}

/**
 * 按 lesson 获取错题
 */
export function getWrongQuestionsByLesson(lessonId) {
  if (!lessonId) return [];
  return getWrongQuestions().filter((x) => x.lessonId === lessonId);
}

/**
 * 按 course 获取错题
 */
export function getWrongQuestionsByCourse(courseId) {
  if (!courseId) return [];
  return getWrongQuestions().filter((x) => {
    const lid = x.lessonId || "";
    return lid.startsWith(courseId + "_") || lid === courseId;
  });
}

/**
 * 迁移旧结构到新结构
 */
function migrateWrongQuestion(w) {
  if (!w || typeof w !== "object") return null;
  const ts = w.lastWrongAt ?? w.timestamp ?? 0;
  const tsSec = ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return {
    lessonId: w.lessonId ?? "",
    questionId: w.questionId ?? "",
    subtype: w.subtype ?? w.subType ?? "choice",
    selected: String(w.selected ?? ""),
    correct: String(w.correct ?? ""),
    wrongCount: Number(w.wrongCount ?? 1),
    reviewCorrectCount: Number(w.reviewCorrectCount ?? 0),
    lastWrongAt: tsSec,
    lastReviewAt: Number(w.lastReviewAt ?? 0),
    questionSnapshot: w.questionSnapshot ?? null,
  };
}

/**
 * 复习统计
 */
export function getReviewStats() {
  const list = getWrongQuestions();
  const now = Math.floor(Date.now() / 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartSec = Math.floor(todayStart.getTime() / 1000);

  let clearedToday = 0;
  const clearedKeys = new Set();
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("lumina_review_cleared_today");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((k) => {
            if (k && typeof k === "string") clearedKeys.add(k);
          });
        }
      }
    } catch {}
  }

  return {
    totalWrong: list.length,
    dueReview: list.length,
    clearedToday: clearedKeys.size,
  };
}
