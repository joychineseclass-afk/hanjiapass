// /ui/core/lessonStepRunner.js
// step keys: vocab | dialogue | grammar | practice | review | aiPractice
import { openWordsStep, loadLessonRaw } from "./wordsStep.js";
import { stepKey } from "./lessonSteps.js";
import { i18n } from "../i18n.js";

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

  const stepKeyNorm = stepKey(step);
  console.log("[Runner] run step:", stepKeyNorm, "key=", key);

  // ---- vocab (词汇) ----
  if (stepKeyNorm === "vocab") {
    try {
      await openWordsStep({ lessonId: st.lessonId, state: st, mode });
    } catch (e) {
      console.warn("[lessonStepRunner] openWordsStep failed:", e);
    }
    return;
  }

  // ---- review: 显示 lessonRange ----
  if (stepKeyNorm === "review") {
    try {
      const raw = await loadLessonRaw(st.lessonId);
      const r = raw?.review;
      const range = Array.isArray(r?.lessonRange) ? r.lessonRange : [];
      const [a, b] = range;
      const rangeText = a != null && b != null ? `第 ${a}–${b} 课 / 1–${b}과` : "";
      const titleRaw = i18n?.t?.("hsk_review_range");
      const title = (titleRaw && titleRaw !== "hsk_review_range") ? titleRaw : "복습 범위";
      const descRaw = i18n?.t?.("hsk_review_desc");
      const desc = (descRaw && descRaw !== "hsk_review_desc") ? descRaw : "请回顾前面学过的词汇和对话。";
      const body = `<p class="mb-2">${rangeText || title}</p><p class="text-sm opacity-80">${desc}</p>`;
      if (mode === "page") renderPagePanel({ title, body });
      else openSimpleModal({ title, body });
    } catch (e) {
      console.warn("[Runner] review step failed:", e);
      const t = i18n?.t?.("hsk_review_range");
      openSimpleModal({ title: (t && t !== "hsk_review_range") ? t : "복습 범위", body: "복습 범위를 불러올 수 없습니다." });
    }
    return;
  }

  // ---- dialogue / grammar / practice / aiPractice ----
  const titleMap = {
    dialogue: "Dialogue / 회화",
    grammar: "Grammar / 문법",
    practice: "Practice / 연습",
    aiPractice: "AI / 말하기",
  };
  const bodyMap = {
    dialogue: "회화 콘텐츠를 표시합니다.",
    grammar: "문법 콘텐츠를 표시합니다.",
    practice: "연습 문제를 표시합니다.",
    aiPractice: "AI 대화 모듈을 연결할 예정입니다.",
  };
  const title = titleMap[stepKeyNorm] || stepKeyNorm;
  const body = bodyMap[stepKeyNorm] || "";

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
  const stepRaw = st.steps?.[st.stepIndex];
  const keys = st.stepKeys;
  const step = stepRaw != null
    ? (typeof stepRaw === "string" ? stepRaw : stepRaw?.key)
    : (Array.isArray(keys) && keys[st.stepIndex] != null ? keys[st.stepIndex] : "vocab");
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
// ✅ Expose a small stable API for other pages (like HSK) to call AI
(function exposeRunnerAPI() {
  const api = window.JOY_RUNNER || {};

  function toExplainLang(langCode) {
    const l = String(langCode || "ko").toLowerCase();
    if (l === "zh" || l === "cn") return "zh";
    if (l === "jp" || l === "ja") return "ja";
    if (l === "en") return "en";
    return "ko";
  }

  /** Tutor / 面板 mode → /api/gemini body.mode */
  function toGeminiMode(mode) {
    const m = String(mode || "").toLowerCase();
    if (m === "free_talk") return "ask";
    return "teach";
  }

  /** Lumina Tutor 正式唯一入口：POST /api/gemini（失败抛错，由 runTutor 回退 mock） */
  api.askAI = async function askAI({ prompt, context = "", lang = "ko", mode = "Kids", contextObj } = {}) {
    const fullPrompt =
      (typeof prompt === "string" && prompt.trim())
        ? prompt.trim()
        : String(context || "").trim();

    try {
      const r = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          explainLang: toExplainLang(lang),
          mode: toGeminiMode(mode),
          context: contextObj != null ? contextObj : undefined,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        return normalizeAIResult(data);
      }
      console.warn("[JOY_RUNNER.askAI] /api/gemini HTTP", r.status);
    } catch (e) {
      console.warn("[JOY_RUNNER.askAI] /api/gemini failed:", e);
    }

    throw new Error("AI not connected: /api/gemini unavailable.");
  };

  function normalizeAIResult(out) {
    // Accept: string | {text} | {answer} | {content} | {message}
    if (typeof out === "string") return { text: out };
    if (out && typeof out === "object") {
      return {
        text:
          out.text ??
          out.answer ??
          out.content ??
          out.message ??
          JSON.stringify(out),
        raw: out,
      };
    }
    return { text: String(out) };
  }

  window.JOY_RUNNER = api;
})();
