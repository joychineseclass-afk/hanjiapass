// /ui/core/lessonStepRunner.js
import { openWordsStep } from "./wordsStep.js";

// ✅ Step Runner: when lesson state changes, open corresponding modal/panel
// - Listen to "lesson:state" emitted by LESSON_ENGINE
// - Dedup to avoid opening modal repeatedly
// - async/await to ensure modal DOM is ready for words rendering

let mounted = false;
let lastKey = "";

function openSimpleModal({ title, body }) {
  const html = `
    <div style="padding:14px; line-height:1.6">
      <h3 style="margin:0 0 10px 0;">${title}</h3>
      <div>${body}</div>
      <div style="margin-top:12px; font-size:12px; opacity:.7;">
        关闭弹窗将自动进入下一步
      </div>
    </div>
  `;

  window.dispatchEvent(
    new CustomEvent("modal:open", {
      detail: { title, html }
    })
  );
}

export function mountLessonStepRunner() {
  if (mounted) return;
  mounted = true;

  window.addEventListener("lesson:state", async (ev) => {
  const st = ev.detail;
  if (!st?.lessonId) return;

  const step = st.steps?.[st.stepIndex] || "words";
  const key = `${st.lessonId}:${st.stepIndex}:${step}:${st.lang || ""}`;

  // ✅ 去重：同一个 state 重复 emit 不要重复开弹窗
  if (key === lastKey) return;
  lastKey = key;

  // ⭐ 根据 step 决定打开什么
  if (step === "words") {
    try {
      await openWordsStep({ lessonId: st.lessonId, state: st });
    } catch (e) {
      console.warn("[lessonStepRunner] openWordsStep failed:", e);
    }
    return;
  }

  if (step === "dialogue") {
    return;
  }

  if (step === "grammar") {
    openSimpleModal({
      title: "Grammar / 语法",
      body: "这里下一步将接入真实语法弹窗内容"
    });
    return;
  }

  if (step === "practice") {
    openSimpleModal({
      title: "Practice / 练习",
      body: "这里下一步将接入真实练习题引擎"
    });
    return;
  }

  if (step === "ai") {
    openSimpleModal({
      title: "AI / 口语练习",
      body: "这里下一步将接入 AI 对话模块"
    });
    return;
  }
});
}
