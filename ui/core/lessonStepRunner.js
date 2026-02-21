// /ui/core/lessonStepRunner.js
// ✅ Step Runner: when step changes, open corresponding modal/panel
// 先用占位弹窗验证完整闭环，下一步再替换为真正的 Words/Grammar/Practice UI

function openSimpleModal({ title, body }) {
  // 复用你已有 modalBase 的 DOM（不确定你当前 modalBase 的 open API）
  // 所以这里用最稳的方式：直接触发一个“通用 modal 打开事件”
  // 如果你 modalBase 已经有 window.MODAL.open(...)，我们下一步改成调用它即可

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
  window.addEventListener("lesson:state", (ev) => {
    const st = ev.detail;
    if (!st?.lessonId) return;

    const step = st.steps?.[st.stepIndex] || "words";

    // ⭐ 根据 step 决定打开什么
    if (step === "words") {
      openSimpleModal({
        title: "Words / 单词",
        body: "这里下一步将接入真实的单词卡弹窗内容（HSK words list）"
      });
      return;
    }

    if (step === "dialogue") {
      // dialogue 你已经有 DIALOGUE_PANEL（保持你现有逻辑）
      // 这里不强制打开，避免重复；由你点击会话或系统触发 dialogue:open 来打开
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
