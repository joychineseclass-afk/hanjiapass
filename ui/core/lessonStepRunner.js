// /ui/core/lessonStepRunner.js
import { openWordsStep } from "./wordsStep.js";

console.log("[Runner] file loaded:", import.meta.url);

let mounted = false;
let lastKey = "";

/** ============================
 *  ✅ Mode: "modal" | "page"
 *  - modal: 用弹窗学习（孩子更专注）
 *  - page : 在页面区域学习（老师备课更舒服）
 *  ============================ */
const MODE_KEY = "hsk_learn_mode";
function getMode() {
  const v =
    (typeof localStorage !== "undefined" && localStorage.getItem(MODE_KEY)) ||
    window.HSK_LEARN_MODE ||
    "modal";
  return v === "page" ? "page" : "modal";
}
function setMode(mode) {
  const m = mode === "page" ? "page" : "modal";
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {}
  window.HSK_LEARN_MODE = m;
  console.log("[Runner] mode =>", m);
  return m;
}

/** ============================
 *  ✅ Flow Control
 *  - cancel: 立即停止后续 steps 打开
 *  - resume: 取消停止（允许继续）
 *  ============================ */
let cancelled = false;

function cancelFlow(reason = "manual") {
  cancelled = true;
  console.log("[Runner] FLOW CANCELLED:", reason);

  // 可选：同时关闭当前弹窗（如果你的 modalBase 支持）
  // 这里用事件，不强耦合具体组件
  try {
    window.dispatchEvent(new CustomEvent("modal:closeAll"));
  } catch {}
}

function resumeFlow(reason = "manual") {
  cancelled = false;
  console.log("[Runner] FLOW RESUMED:", reason);
}

function resetDedupe() {
  lastKey = "";
}

/** 给外部（modal close / UI按钮）用的全局桥 */
try {
  window.HSK_MODE = window.HSK_MODE || {};
  window.HSK_MODE.get = getMode;
  window.HSK_MODE.set = setMode;

  window.HSK_FLOW = window.HSK_FLOW || {};
  window.HSK_FLOW.cancel = cancelFlow;
  window.HSK_FLOW.resume = resumeFlow;
  window.HSK_FLOW.reset = resetDedupe;
} catch {}

/** ============================
 *  ✅ Helper: open content
 *  ============================ */
function openSimpleModal({ title, body }) {
  const html = `
    <div style="padding:14px; line-height:1.6">
      <h3 style="margin:0 0 10px 0;">${title}</h3>
      <div>${body}</div>
      <div style="margin-top:12px; font-size:12px; opacity:.7;">
        (modal mode) 关闭后不会自动进入下一步（已改为手动/引擎控制）
      </div>
    </div>
  `;
  window.dispatchEvent(
    new CustomEvent("modal:open", { detail: { title, html } })
  );
}

/**
 * page mode 时，把内容渲染到页面区域
 * 你可以在 hskLayout 里准备一个容器：#hskStage / #hskGrid / #hskContent 等
 * 这里默认找 #hskStage，其次 #hskGrid
 */
function openSimplePage({ title, body }) {
  const stage =
    document.getElementById("hskStage") ||
    document.getElementById("hskGrid") ||
    document.getElementById("app");

  if (!stage) return;

  const wrap = document.createElement("div");
  wrap.className = "hsk-page-step";
  wrap.innerHTML = `
    <div style="padding:14px; line-height:1.6; border:1px solid #eee; border-radius:14px; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <h3 style="margin:0;">${title}</h3>
        <div style="display:flex; gap:8px;">
          <button type="button" data-act="close" style="padding:6px 10px; border-radius:10px; border:1px solid #ddd; background:#fafafa; cursor:pointer;">
            닫기
          </button>
        </div>
      </div>
      <div style="margin-top:10px;">${body}</div>
      <div style="margin-top:12px; font-size:12px; opacity:.7;">
        (page mode) 닫기 = 흐름 중지
      </div>
    </div>
  `;

  wrap.querySelector('[data-act="close"]')?.addEventListener("click", () => {
    cancelFlow("page-close");
    wrap.remove();
  });

  // 只保留一个（避免页面堆叠）
  const old = stage.querySelector(".hsk-page-step");
  if (old) old.remove();

  stage.appendChild(wrap);
}

/** ============================
 *  ✅ Main: handleState
 *  ============================ */
async function handleState(st, source = "event") {
  if (!st?.lessonId) return;

  // ✅ 如果用户点了关闭/取消，就彻底不再打开任何 step
  if (cancelled) {
    console.log("[Runner] cancelled => skip handleState", { source });
    return;
  }

  const step = st.steps?.[st.stepIndex] || "words";
  const key = `${st.lessonId}:${st.stepIndex}:${step}:${st.lang || ""}`;

  console.log("[Runner] state:", {
    source,
    lessonId: st.lessonId,
    stepIndex: st.stepIndex,
    step,
    lang: st.lang,
    mode: getMode(),
  });

  // ✅ 去重
  if (key === lastKey) {
    console.log("[Runner] dedup skip:", key);
    return;
  }
  lastKey = key;

  console.log("[Runner] run step:", step, "key=", key);

  // ⭐ 根据 step 决定打开什么
  // words
  if (step === "words") {
    try {
      // page/modal 两种模式都能走 openWordsStep
      // 但 openWordsStep 内部如果现在是 modal-only，你也可以在 opts 里传 mode
      await openWordsStep({
        lessonId: st.lessonId,
        state: st,
        mode: getMode(),
      });
    } catch (e) {
      console.warn("[lessonStepRunner] openWordsStep failed:", e);
    }
    return;
  }

  // dialogue：如果你已有 DIALOGUE_PANEL 监听事件打开，这里先不动
  if (step === "dialogue") return;

  // grammar / practice / ai 先给占位：根据模式走 modal 或 page
  const mode = getMode();

  if (step === "grammar") {
    const payload = {
      title: "Grammar / 语法",
      body: "这里下一步将接入真实语法内容（占位）",
    };
    mode === "page" ? openSimplePage(payload) : openSimpleModal(payload);
    return;
  }

  if (step === "practice") {
    const payload = {
      title: "Practice / 练习",
      body: "这里下一步将接入真实练习题引擎（占位）",
    };
    mode === "page" ? openSimplePage(payload) : openSimpleModal(payload);
    return;
  }

  if (step === "ai") {
    const payload = {
      title: "AI / 口语练习",
      body: "这里下一步将接入 AI 对话模块（占位）",
    };
    mode === "page" ? openSimplePage(payload) : openSimpleModal(payload);
    return;
  }
}

export function mountLessonStepRunner() {
  if (mounted) return;
  mounted = true;

  console.log("[Runner] mounted, mode=", getMode());

  // ✅ 当路由/课程切换时，建议外部调用 window.HSK_FLOW.reset()
  // 但这里也做一个“lessonId变化自动重置 dedupe”的策略
  let lastLessonId = "";

  // 1) 监听后续 emit
  window.addEventListener("lesson:state", async (ev) => {
    const st = ev?.detail;

    // lessonId 变化：重置去重 + 允许继续（避免上一次 cancel 影响下一次）
    if (st?.lessonId && st.lessonId !== lastLessonId) {
      lastLessonId = st.lessonId;
      resetDedupe();
      resumeFlow("lesson-change");
    }

    await handleState(st, "event");
  });

  // 2) catch-up
  try {
    const engine = window.LESSON_ENGINE;
    if (engine?.getState) {
      const st = engine.getState();
      if (st?.lessonId) {
        lastLessonId = st.lessonId;
        resetDedupe();
        resumeFlow("catchup");
        handleState(st, "catchup");
      }
    }
  } catch (e) {
    console.warn("[Runner] catchup failed:", e);
  }

  // 3) ✅ 允许 modal 系统通知“用户主动关闭”
  // 你在 modalBase close 里只要 dispatch "hsk:cancel" 就行
  window.addEventListener("hsk:cancel", () => cancelFlow("event:hsk:cancel"));
}
