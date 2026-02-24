// /ui/pages/hsk/state.js
import { deriveLessonId } from "../../core/deriveLessonId.js";

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

export function restoreLastLessonToGlobals() {
  let cur = window.__HSK_CURRENT_LESSON || null;

  if (cur?.lessonId || window.__HSK_CURRENT_LESSON_ID) return cur;

  try {
    const last = JSON.parse(localStorage.getItem("hsk_last_lesson") || "null");
    if (!last) return null;

    if (!window.__HSK_CURRENT_LESSON_ID && last.lessonId) {
      window.__HSK_CURRENT_LESSON_ID = last.lessonId;
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
    return cur;
  } catch {
    return null;
  }
}

export function getCurrentLessonIdSafe() {
  const cur = window.__HSK_CURRENT_LESSON || null;
  return window.__HSK_CURRENT_LESSON_ID || cur?.lessonId || cur?.id || "";
}
