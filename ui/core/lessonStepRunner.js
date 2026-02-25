// /ui/core/lessonStepRunner.js
import { openWordsStep } from "./wordsStep.js";

console.log("[Runner] file loaded:", import.meta.url);

let mounted = false;
let lastKey = "";

/* -----------------------------
  helpers
----------------------------- */
function getMode() {
  const el = document.getElementById("hskMode");
  const v = (el?.value || localStorage.getItem("hsk_mode") || "modal").toLowerCase();
  return v === "page" ? "page" : "modal";
}

function setActiveTab(step) {
  const wrap = document.getElementById("hskStepTabs");
  if (!wrap) return;
  wrap.querySelectorAll("[data-step]").forEach((btn) => {
    const isOn = btn.getAttribute("data-step") === step;
    btn.classList.toggle("bg-blue-50", isOn);
    btn.classList.toggle("border-blue-200", isOn);
    btn.classList.toggle("text-blue-700", isOn);
    btn.classList.toggle("font-bold", isOn);

    btn.classList.toggle("bg-white", !isOn);
    btn.classList.toggle("border-gray-200", !isOn);
    btn.classList.toggle("text-gray-700", !isOn);
  });
}

function openSimpleModal({ title, body }) {
  const html = `
    <div style="padding:14px; line-height:1.6">
      <h3 style="margin:0 0 10px 0;">${title}</h3>
      <div>${body}</div>
      <div style="margin-top:12px; font-size:12px; opacity:.7;">
        (modal mode) 닫기 버튼을 누르면 종료됩니다.
      </div>
    </div>
  `;
  window.dispatchEvent(new CustomEvent("modal:open", { detail: { title, html } }));
}

function renderPagePanel({ title, body }) {
  const panel = document.getElementById("hskPagePanel");
  const box = document.getElementById("hskPageBody");
  if (!panel || !box) return false;
  panel.classList.remove("hidden");
  box.innerHTML = `
    <div style="padding:6px 2px">
      <div style="font-weight:800; margin-bottom:10px">${title}</div>
      <div>${body}</div>
    </div>
  `;
  return true;
}

/* -----------------------------
  unified open by step
----------------------------- */
async function openStep(step, st, { force = false, source = "event" } = {}) {
  if (!st?.lessonId) return;

  const mode = getMode();
  setActiveTab(step);

  const key = `${st.lessonId}:${st.stepIndex}:${step}:${st.lang || ""}:${mode}`;

  console.log("[Runner] state:", {
    source,
    lessonId: st.lessonId,
    stepIndex: st.stepIndex,
    step,
    lang: st.lang,
    mode,
    force,
  });

  if (!force && key === lastKey) {
    console.log("[Runner] dedup skip:", key);
    return;
  }
  lastKey = key;

  console.log("[Runner] run step:", step, "key=", key);

  // ---- words (real module) ----
  if (step === "words") {
    try {
      await openWordsStep({ lessonId: st.lessonId, state: st, mode });
    } catch (e) {
      console.warn("[lessonStepRunner] openWordsStep failed:", e);
    }
    return;
  }

  // ---- placeholders for now ----
  const titleMap = {
    dialogue: "Dialogue / 회화",
    grammar: "Grammar / 문법",
    practice: "Practice / 연습",
    ai: "AI / 말하기",
  };

  const bodyMap = {
    dialogue: "여기에 다음 단계로 회화 콘텐츠를 연결할 예정입니다. (placeholder)",
    grammar: "여기에 다음 단계로 문법 콘텐츠를 연결할 예정입니다. (placeholder)",
    practice: "여기에 다음 단계로 연습 문제 엔진을 연결할 예정입니다. (placeholder)",
    ai: "여기에 다음 단계로 AI 대화 모듈을 연결할 예정입니다. (placeholder)",
  };

  const title = titleMap[step] || step;
  const body = bodyMap[step] || "";

  if (mode === "page") {
    // teacher mode: render into page panel
    renderPagePanel({ title, body });
  } else {
    // kids mode: open modal
    openSimpleModal({ title, body });
  }
}

/* -----------------------------
  handle state from engine
----------------------------- */
async function handleState(st, source = "event") {
  if (!st?.lessonId) return;
  const step = st.steps?.[st.stepIndex] || "words";
  await openStep(step, st, { source });
}

/* -----------------------------
  mount once
----------------------------- */
export function mountLessonStepRunner() {
  if (mounted) return;
  mounted = true;

  console.log("[Runner] mounted");

  // 1) engine emit
  window.addEventListener("lesson:state", async (ev) => {
    const st = ev?.detail;
    await handleState(st, "event");
  });

  // 2) catch-up
  try {
    const engine = window.LESSON_ENGINE;
    if (engine?.getState) {
      const st = engine.getState();
      if (st?.lessonId) handleState(st, "catchup");
    }
  } catch (e) {
    console.warn("[Runner] catchup failed:", e);
  }

  // 3) ✅ IMPORTANT: modal close → allow reopening same lesson/step
  window.addEventListener("modal:close", () => {
    console.log("[Runner] modal closed -> reset dedup");
    lastKey = "";
  });

  // 4) mode persistence
  const modeSel = document.getElementById("hskMode");
  if (modeSel) {
    modeSel.value = getMode();
    modeSel.addEventListener("change", () => {
      localStorage.setItem("hsk_mode", modeSel.value || "modal");
      lastKey = ""; // switching mode should reopen
    });
  }

  // 5) tabs: force open chosen step
  const tabs = document.getElementById("hskStepTabs");
  if (tabs) {
    tabs.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("[data-step]");
      if (!btn) return;
      const step = btn.getAttribute("data-step");
      const engine = window.LESSON_ENGINE;
      const st = engine?.getState?.();
      if (!st?.lessonId) return;
      await openStep(step, st, { force: true, source: "tab" });
    });
  }
}
