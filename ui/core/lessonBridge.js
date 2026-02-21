// /ui/core/lessonBridge.js
// ✅ 把“现有弹窗系统”接入 lesson engine（不改 hsk.js）

export function mountLessonBridge() {
  // 打开对话弹窗时：切到 dialogue 步骤
  window.addEventListener("dialogue:open", () => {
    window.LESSON_ENGINE?.go("dialogue");
  });

  // 你如果 modalBase 有 close 事件（示例名）：dialogue:close
  // 没有的话我们下一步给 modalBase 加一个“关闭广播”，一次搞定所有弹窗
  window.addEventListener("dialogue:close", () => {
    window.LESSON_ENGINE?.markDone("dialogue");
    window.LESSON_ENGINE?.next();
  });
}
