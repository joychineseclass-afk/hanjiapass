/**
 * AI Tutor v1 面板
 * 模式切换 + 内容区
 */

import { i18n } from "../../i18n.js";
import { getLessonAIConfig, runTutor, formatTutorOutput } from "./aiTutorEngine.js";
import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { renderModeContent } from "./aiTutorModes.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function t(key, fallback = "") {
  return (i18n && typeof i18n.t === "function" ? i18n.t(key, fallback) : null) || fallback || key;
}

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "kr").toLowerCase();
  const key = l === "zh" || l === "cn" ? "cn" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  return str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.jp ?? obj.en ?? "");
}

function buildLessonSummary(context, lang) {
  const parts = [];
  const sep = lang === "jp" ? "・" : " · ";
  if (context.vocab?.length) {
    const w = t("lesson.summary.words", "語彙");
    const u = lang === "jp" ? "語" : lang === "kr" ? "개" : lang === "cn" ? "个" : "";
    parts.push(u ? `${w} ${context.vocab.length}${u}` : `${context.vocab.length} ${w}`);
  }
  if (context.dialogue?.length) {
    const d = t("lesson.summary.dialogues", "会話");
    const u = lang === "jp" ? "文" : lang === "kr" ? "문" : lang === "cn" ? "句" : "";
    parts.push(u ? `${d} ${context.dialogue.length}${u}` : `${context.dialogue.length} ${d}`);
  }
  if (context.grammar?.length) {
    const g = t("lesson.summary.grammar_points", "文法");
    const u = lang === "jp" ? "項目" : lang === "kr" ? "개" : lang === "cn" ? "点" : "";
    parts.push(u ? `${g} ${context.grammar.length}${u}` : `${context.grammar.length} ${g}`);
  }
  return parts.join(sep);
}

/**
 * 渲染 AI Tutor 完整页面
 */
export function renderAITutorPanel(opts = {}) {
  const { lesson, lang = "kr", containerId = "hskAIResult" } = opts;
  const context = buildLessonContext(lesson, { lang });
  const items = getLessonAIConfig(lesson);
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";

  const summary = buildLessonSummary(context, langKey);
  const tutorTitle = t("ai.tutor_title", "AI Tutor");

  const modeLabels = {
    explain: t("ai.mode_explain", "Explain"),
    roleplay: t("ai.mode_roleplay", "Roleplay"),
    shadowing: t("ai.mode_shadowing", "Shadowing"),
    free_talk: t("ai.mode_free_talk", "Free Talk"),
  };

  const allModes = ["explain", "roleplay", "shadowing", "free_talk"];
  const modeTabs = allModes.map((mode) => {
    const item = items.find((i) => i.mode === mode);
    const label = item ? pickLang(item.title, lang) || modeLabels[mode] : modeLabels[mode];
    const active = mode === "explain" ? " ai-tutor-tab-active" : "";
    return `<button type="button" class="ai-tutor-tab${active}" data-mode="${escapeHtml(mode)}">${escapeHtml(label)}</button>`;
  }).join("");

  const firstItem = items.find((i) => i.mode === "explain") || items[0] || {};
  const firstMode = firstItem?.mode ?? "explain";
  const bodyContent = renderModeContent(firstMode, firstItem, lang);

  return `
<section class="ai-tutor-page">
  <div class="ai-tutor-header">
    <h3 class="ai-tutor-title">${escapeHtml(tutorTitle)}</h3>
    <p class="ai-tutor-lesson-info text-sm opacity-75">${escapeHtml(context.lessonTitle || "")} ${summary ? ` · ${escapeHtml(summary)}` : ""}</p>
  </div>

  <div class="ai-tutor-modes">
    ${modeTabs}
  </div>

  <div class="ai-tutor-body">
    ${bodyContent}
  </div>
</section>
  `;
}

/**
 * 挂载 AI Tutor 面板并绑定事件
 */
export function mountAITutorPanel(container, opts = {}) {
  if (!container) return;
  const { lesson, lang = "kr" } = opts;
  const items = getLessonAIConfig(lesson);

  container.innerHTML = renderAITutorPanel({ ...opts, containerId: container.id });

  const tabs = container.querySelectorAll(".ai-tutor-tab");
  const body = container.querySelector(".ai-tutor-body");

  function switchMode(mode) {
    const item = items.find((i) => i.mode === mode) || {};
    tabs.forEach((tab) => tab.classList.toggle("ai-tutor-tab-active", tab.dataset.mode === mode));
    if (body) {
      body.innerHTML = renderModeContent(mode, item, lang);
      bindModeEvents(body, mode, item, lesson, lang);
    }
  }

  function bindModeEvents(wrap, mode, aiItem, lessonData, currentLang) {
    if (!wrap) return;

    const runBtn = wrap.querySelector(".ai-tutor-run");
    const sendBtn = wrap.querySelector(".ai-tutor-send");
    const resultWrap = wrap.querySelector(".ai-tutor-result-wrap");
    const inputEl = wrap.querySelector(".ai-tutor-input");

    const doRun = async (userInput = "") => {
      if (!resultWrap) return;
      resultWrap.classList.remove("hidden");
      resultWrap.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(t("ai.loading", t("common.loading", "加载中...")))}</div>`;

      const res = await runTutor(mode, aiItem, lessonData, currentLang, userInput);
      const formatted = formatTutorOutput(mode, res, currentLang);
      resultWrap.innerHTML = formatted.html || `<div class="text-sm opacity-70">${escapeHtml(t("ai.result", "Result"))}</div>`;
    };

    if (runBtn) {
      runBtn.addEventListener("click", () => doRun());
    }

    if (sendBtn && inputEl) {
      sendBtn.addEventListener("click", () => {
        const val = str(inputEl.value);
        if (!val) {
          resultWrap?.classList.remove("hidden");
          if (resultWrap) resultWrap.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(t("hsk.ai_empty", "Please enter a question."))}</div>`;
          return;
        }
        doRun(val);
      });
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  bindModeEvents(body, items[0]?.mode ?? "explain", items[0], lesson, lang);
}
