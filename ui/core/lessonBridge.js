// /ui/core/lessonBridge.js
// ✅ Bridge: UI Events <-> Lesson Engine
// - dialogue:open   -> go("dialogue")
// - modal:close     -> markDone(currentStep) + next()
// - keep decoupled from UI components

// core/lessonBridge.js
import { deriveLessonId } from "./deriveLessonId.js";

export async function openLesson(lesson, opts = {}) {
  const version =
    opts.version ||
    lesson?.version ||
    localStorage.getItem("hsk_vocab_version") ||
    "hsk2.0";

  const lv = opts.lv ?? lesson?.lv ?? lesson?.level;

  // ✅ 生成带版本 lessonId（强制非空）
  const lessonId = deriveLessonId(lesson, { lv, version });

  // ✅ 回写 + 全局注入
  lesson.lessonId = lessonId;
  lesson.version = version;

  window.__HSK_CURRENT_LESSON_ID = lessonId;
  window.__HSK_CURRENT_LESSON = { ...(lesson || {}), lessonId, version, lv, openedAt: Date.now() };

  // 可加一条验证日志（改完就能立刻确认）
  console.log("[lessonBridge] openLesson =>", { lessonId, version, lv, lesson });
  
}

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
