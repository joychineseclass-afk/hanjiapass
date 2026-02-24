// /ui/core/lessonBridge.js
// ✅ Bridge: UI Events <-> Lesson Engine
// - dialogue:open   -> go("dialogue")
// - modal:close     -> markDone(currentStep) + next()
// - keep decoupled from UI components

// core/lessonBridge.js
import { deriveLessonId } from "./deriveLessonId.js";

export async function openLesson(lesson, opts = {}) {

  const { lv, version } = opts;

  // ✅ 1. 生成 lessonId
  const lessonId = deriveLessonId(lesson, { lv, version });

  // ✅ 2. 回写到 lesson
  lesson.lessonId = lessonId;

  // ✅ 3. 写入全局
  window.__HSK_CURRENT_LESSON_ID = lessonId;

  window.__HSK_CURRENT_LESSON = {
    ...(lesson || {}),
    lessonId,
    lv,
    version,
    openedAt: Date.now()
  };

  console.log("[lessonBridge] current lesson:", window.__HSK_CURRENT_LESSON);

  // 原本的逻辑继续执行

export function mountLessonBridge() {
  const engine = () => window.LESSON_ENGINE;

  // 1) 打开会话弹窗：切到 dialogue 步骤
  window.addEventListener("dialogue:open", () => {
    try {
      engine()?.go("dialogue");
    } catch (e) {
      console.warn("[lessonBridge] go(dialogue) failed:", e);
    }
  });

  // 2) 任何弹窗关闭：标记当前步骤完成并进入下一步
  window.addEventListener("modal:close", () => {
    try {
      const e = engine();
      if (!e) return;

      // 如果还没 start（lessonId 为空），先不推进，避免误触
      const st = e.getState?.();
      if (!st?.lessonId) return;

      const step = e.currentStep?.();
      if (step) e.markDone(step);
      e.next();
    } catch (err) {
      console.warn("[lessonBridge] modal close advance failed:", err);
    }
  });
}
