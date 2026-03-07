/**
 * Review Mode Engine v1 - 复习会话构建
 */

import * as Selectors from "./reviewSelectors.js";

const LIMITS = {
  lesson: 5,
  level: 10,
  all: 15,
};

/**
 * 解析 lessonId 得到 courseId / levelKey
 * 格式: hsk2.0_hsk1_lesson1 -> courseId: hsk2.0_hsk1, lessonNo: 1
 */
function parseLessonId(lessonId) {
  if (!lessonId || typeof lessonId !== "string") return { courseId: "", lessonNo: 0 };
  const m = lessonId.match(/^(.+)_lesson(\d+)$/i);
  if (m) return { courseId: m[1], lessonNo: parseInt(m[2], 10) || 0 };
  return { courseId: lessonId, lessonNo: 0 };
}

/**
 * 排序权重：最近错的优先，同题多次错的优先
 * score = wrongCount * 10 + recencyWeight (越近越大)
 */
function sortWrongQuestions(list) {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 365 * 24 * 3600;
  return [...list].sort((a, b) => {
    const recencyA = Math.max(0, now - (a.lastWrongAt || 0));
    const recencyB = Math.max(0, now - (b.lastWrongAt || 0));
    const weightA = (a.wrongCount || 1) * 10 + (maxAge - recencyA) / 86400;
    const weightB = (b.wrongCount || 1) * 10 + (maxAge - recencyB) / 86400;
    return weightB - weightA;
  });
}

/**
 * 按 lesson 聚合后排序（同一 lesson 尽量连续）
 */
function sortByLessonThenRecency(list) {
  const byLesson = new Map();
  list.forEach((w) => {
    const lid = w.lessonId || "";
    if (!byLesson.has(lid)) byLesson.set(lid, []);
    byLesson.get(lid).push(w);
  });
  const sorted = sortWrongQuestions(list);
  const lessonOrder = [...new Set(sorted.map((w) => w.lessonId))];
  const out = [];
  lessonOrder.forEach((lid) => {
    const items = byLesson.get(lid) || [];
    items.sort((a, b) => (b.wrongCount || 1) - (a.wrongCount || 1));
    out.push(...items);
  });
  return out;
}

/**
 * 构建复习会话
 * @param {{ mode: "lesson"|"level"|"all", lessonId?: string, levelKey?: string }}
 * @returns {{ id: string, mode: string, total: number, items: Array }}
 */
export function buildReviewSession({ mode = "all", lessonId = "", levelKey = "" } = {}) {
  let items = [];

  if (mode === "lesson" && lessonId) {
    items = Selectors.getWrongQuestionsByLesson(lessonId);
  } else if (mode === "level" && levelKey) {
    items = Selectors.getWrongQuestionsByCourse(levelKey);
  } else {
    items = Selectors.getWrongQuestions();
  }

  items = sortByLessonThenRecency(items);
  const limit = LIMITS[mode] ?? LIMITS.all;
  items = items.slice(0, limit);

  const id = `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    mode,
    lessonId: mode === "lesson" ? lessonId : "",
    levelKey: mode === "level" ? levelKey : "",
    total: items.length,
    items,
  };
}
