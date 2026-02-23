// /ui/core/lessonStepRunner.js
import { openWordsStep } from "./wordsStep.js";

console.log("[Runner] file loaded:", import.meta.url);

let mounted = false;
let lastKey = "";

// 统一处理 state（事件/主动catch-up都走这里）
async function handleState(st, source = "event") {
  if (!st?.lessonId) return;

  const step = st.steps?.[st.stepIndex] || "words";
  const key = `${st.lessonId}:${st.stepIndex}:${step}:${st.lang || ""}`;

  // ✅ StepA log #1：收到 state（核心字段）
  console.log("[Runner] state:", {
    source,
    lessonId: st.lessonId,
    stepIndex: st.stepIndex,
    step,
    lang: st.lang,
  });

  // ✅ 去重（但调试时也要看得见）
  if (key === lastKey) {
    // ✅ StepA log #2：被去重（告诉你为什么没开）
    console.log("[Runner] dedup skip:", key);
    return;
  }
  lastKey = key;

  // ✅ StepA log #3：准备执行哪个分支
  console.log("[Runner] run step:", step, "key=", key);

  // ⭐ 根据 step 决定打开什么
  if (step === "words") {
    try {
      await openWordsStep({ lessonId: st.lessonId, state: st });
    } catch (e) {
      console.warn("[lessonStepRunner] openWordsStep failed:", e);
    }
    return;
  }

  // dialogue：你说你已经用 DIALOGUE_PANEL 接了事件打开，这里先不动
  if (step === "dialogue") return;

  // 下面是占位（你后续会替换成真实模块）
  const openSimpleModal = ({ title, body }) => {
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
      new CustomEvent("modal:open", { detail: { title, html } })
    );
  };

  if (step === "grammar") {
    openSimpleModal({
      title: "Grammar / 语法",
      body: "这里下一步将接入真实语法弹窗内容",
    });
    return;
  }

  if (step === "practice") {
    openSimpleModal({
      title: "Practice / 练习",
      body: "这里下一步将接入真实练习题引擎",
    });
    return;
  }

  if (step === "ai") {
    openSimpleModal({
      title: "AI / 口语练习",
      body: "这里下一步将接入 AI 对话模块",
    });
    return;
  }
}

export function mountLessonStepRunner() {
  // ✅ 真正只 mount 一次（log 不误导）
  if (mounted) return;
  mounted = true;

  console.log("[Runner] mounted");

  // 1) 监听后续 emit
  window.addEventListener("lesson:state", async (ev) => {
    const st = ev?.detail;
    await handleState(st, "event");
  });

  // 2) ✅ catch-up：防止错过第一次 emit（最大关键点）
  //    如果 engine 已经 start 并 emit 过，Runner 也能立即补上
  try {
    const engine = window.LESSON_ENGINE;
    if (engine?.getState) {
      const st = engine.getState();
      // 注意：只有 lessonId 存在才处理
      if (st?.lessonId) {
        handleState(st, "catchup");
      }
    }
  } catch (e) {
    console.warn("[Runner] catchup failed:", e);
  }
}
