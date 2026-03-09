/**
 * Review Engine v1 - 复习记录
 * localStorage: lumina_review_wrong, lumina_review_recent
 */

const KEY_WRONG = "lumina_review_wrong";
const KEY_RECENT = "lumina_review_recent";
const MAX_RECENT = 50;
const MAX_WRONG = 100;

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("[Review] save failed:", e?.message);
  }
}

/**
 * 保存错题记录
 * @param {object} item - { questionId, lessonId, courseId, subtype, selected, correct, questionSnapshot, practicedAt }
 */
export function addWrongItem(item) {
  const list = load(KEY_WRONG);
  const record = {
    ...item,
    practicedAt: item.practicedAt ?? Date.now(),
  };
  const idx = list.findIndex((x) => x.lessonId === item.lessonId && x.questionId === item.questionId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...record, wrongCount: (list[idx].wrongCount || 1) + 1 };
  } else {
    list.unshift(record);
  }
  save(KEY_WRONG, list.slice(0, MAX_WRONG));
}

/**
 * 批量保存错题
 */
export function addWrongItems(items, { lessonId, courseId } = {}) {
  if (!Array.isArray(items)) return;
  const now = Date.now();
  items.forEach((it) => {
    addWrongItem({
      questionId: it.questionId,
      lessonId: lessonId || it.lessonId,
      courseId: courseId || it.courseId,
      subtype: it.subtype,
      selected: it.selected,
      correct: it.correct,
      questionSnapshot: it.questionSnapshot,
      practicedAt: now,
    });
  });
}

/**
 * 保存最近练习记录
 * @param {object} record - { lessonId, courseId, total, correct, score, practicedAt, questionSnapshots? }
 */
export function addRecentItem(record) {
  const list = load(KEY_RECENT);
  const item = {
    ...record,
    practicedAt: record.practicedAt ?? Date.now(),
  };
  list.unshift(item);
  save(KEY_RECENT, list.slice(0, MAX_RECENT));
}

/**
 * 获取错题列表
 */
export function getWrongItems() {
  return load(KEY_WRONG);
}

/**
 * 获取最近练习列表
 */
export function getRecentItems() {
  return load(KEY_RECENT);
}

/**
 * 清除复习记录
 * @param {string} [type] - "wrong" | "recent" | 不传则清除全部
 */
export function clearReview(type) {
  if (type === "wrong") {
    save(KEY_WRONG, []);
  } else if (type === "recent") {
    save(KEY_RECENT, []);
  } else {
    save(KEY_WRONG, []);
    save(KEY_RECENT, []);
  }
}

/**
 * 移除单条错题
 */
export function removeWrongItem(lessonId, questionId) {
  const list = load(KEY_WRONG).filter(
    (x) => !(x.lessonId === lessonId && x.questionId === questionId)
  );
  save(KEY_WRONG, list);
}
