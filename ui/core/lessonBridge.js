// /ui/core/lessonBridge.js
// ✅ Bridge: UI Events <-> Lesson Engine
// - dialogue:open   -> go("dialogue")
// - modal:close     -> markDone(currentStep) + next()
// - keep decoupled from UI components

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
