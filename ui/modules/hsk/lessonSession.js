// /ui/modules/hsk/lessonSession.js
import { deriveLessonId } from "../../core/deriveLessonId.js";

const _lessonLoadInflight = new Map();

/**
 * 同一 key 并发只跑一次 loadFn；用于避免重复点击 / 切 Tab 触发的并行课件请求。
 * @param {string} key
 * @param {() => Promise<any>} loadFn
 */
export function dedupeLessonLoad(key, loadFn) {
  const k = String(key || "").trim() || "_";
  const existing = _lessonLoadInflight.get(k);
  if (existing) return existing;
  const p = Promise.resolve()
    .then(() => loadFn())
    .finally(() => {
      if (_lessonLoadInflight.get(k) === p) _lessonLoadInflight.delete(k);
    });
  _lessonLoadInflight.set(k, p);
  return p;
}

export function clearLessonLoadDedupe() {
  _lessonLoadInflight.clear();
}

export function setCurrentLessonGlobal(lesson, opts = {}) {
  const version =
    opts.version ||
    lesson?.version ||
    localStorage.getItem("hsk_vocab_version") ||
    "hsk2.0";

  const lv = opts.lv ?? lesson?.lv ?? lesson?.level;

  const lessonId = deriveLessonId(lesson, { lv, version });

  const cur = { ...(lesson || {}), lv, version, lessonId, openedAt: Date.now() };

  window.__HSK_CURRENT_LESSON_ID = lessonId;
  window.__HSK_CURRENT_LESSON = cur;

  // 兼容旧字段（如果旧模块还读）
  window._CURRENT_LESSON_ID = lessonId;
  window.__HSK_LAST_LESSON_ID = lessonId;

  try {
    localStorage.setItem(
      "hsk_last_lesson",
      JSON.stringify({
        lessonId,
        lv,
        version,
        file: lesson?.file || lesson?.path || lesson?.url || "",
      })
    );
  } catch {}

  return cur;
}

export function setLessonDataOnCurrent({ lesson, lv, version, file, lessonData }) {
  // ✅ lessonId 一律用 deriveLessonId（不要再 computedLessonId 两套并存）
  const lessonId = deriveLessonId(lesson, { lv, version }) || "";

  const prev = window.__HSK_CURRENT_LESSON || {};
  const cur = {
    ...prev,
    ...(lesson || {}),
    lessonId,
    lv,
    version,
    file: file || prev.file,
    lessonData,
    openedAt: Date.now(),
  };

  window.__HSK_CURRENT_LESSON_ID = lessonId;
  window.__HSK_CURRENT_LESSON = cur;

  // 兼容旧字段
  window._CURRENT_LESSON_ID = lessonId;
  window.__HSK_LAST_LESSON_ID = lessonId;

  try {
    localStorage.setItem("joy_current_lesson", lessonId);
    localStorage.setItem(
      "hsk_last_lesson",
      JSON.stringify({
        lessonId,
        lv,
        version,
        file: file || "",
      })
    );
  } catch {}

  return cur;
}

export function restoreLastLessonIfNeeded() {
  let cur = window.__HSK_CURRENT_LESSON || null;

  if (!cur || !window.__HSK_CURRENT_LESSON_ID) {
    try {
      const last = JSON.parse(localStorage.getItem("hsk_last_lesson") || "null");
      if (last) {
        if (!window.__HSK_CURRENT_LESSON_ID && last.lessonId) {
          window.__HSK_CURRENT_LESSON_ID = last.lessonId || "";
        }
        if (!cur) {
          window.__HSK_CURRENT_LESSON = {
            lessonId: last.lessonId || "",
            lv: last.lv,
            version: last.version,
            file: last.file,
          };
          cur = window.__HSK_CURRENT_LESSON;
        }
      }
    } catch {}
  }

  return cur;
}

export function getCurrentLessonIdSafe() {
  const cur = window.__HSK_CURRENT_LESSON || null;
  return window.__HSK_CURRENT_LESSON_ID || cur?.lessonId || cur?.id || "";
}
