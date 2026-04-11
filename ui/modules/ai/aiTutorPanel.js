/**
 * AI Tutor v1 面板
 * 模式切换 + 内容区，产品化收口
 */

import { i18n } from "../../i18n.js";
import { getLessonAIConfig, runTutor, formatTutorOutput } from "./aiTutorEngine.js";
import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { renderModeContent } from "./aiTutorModes.js";
import { buildSituationDialoguePlan, mountSituationDialogue } from "./aiSituationDialogue.js";
import {
  toggleShadowingPlayback,
  cancelShadowingPlayback,
  replayShadowingSentence,
  skipShadowingNext,
} from "./aiShadowingPlayback.js";
import { handleLessonFocusSpeakClick, resetLessonFocusSpeakSession } from "./aiLessonFocusSpeak.js";
import { AUDIO_ENGINE } from "../../platform/index.js";
import { startNewHskSpeakChain } from "../hsk/hskRenderer.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s != null ? s : "")
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
  const v = obj[key] || obj.zh || obj.cn || obj.kr || obj.jp || obj.en;
  return str(v != null ? v : "");
}

function buildLessonSummaryBadges(context, lang) {
  const badges = [];
  const topic = context.lessonTitle || "";
  if (topic) badges.push(`<span class="ai-tutor-badge ai-tutor-badge-topic">${escapeHtml(topic)}</span>`);
  if (context.vocab?.length) badges.push(`<span class="ai-tutor-badge">${escapeHtml(t("ai.words_count", "Words"))} ${context.vocab.length}</span>`);
  if (context.dialogue?.length) badges.push(`<span class="ai-tutor-badge">${escapeHtml(t("ai.dialogue_count", "Dialogue"))} ${context.dialogue.length}</span>`);
  if (context.grammar?.length) badges.push(`<span class="ai-tutor-badge">${escapeHtml(t("ai.grammar_count", "Grammar"))} ${context.grammar.length}</span>`);
  return badges.join("");
}

/**
 * 渲染 AI Tutor 完整页面
 */
export function renderAITutorPanel(opts = {}) {
  const { lesson, lang = "kr", containerId = "hskAIResult" } = opts;
  const context = buildLessonContext(lesson, { lang });
  const items = getLessonAIConfig(lesson);
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";

  const badges = buildLessonSummaryBadges(context, langKey);
  const tutorTitle = t("ai.tutor_title", "AI Tutor");
  const tutorSubtitle = t("ai.tutor_subtitle", "Practice with AI using this lesson's content.");

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
  const firstMode = firstItem && firstItem.mode != null ? firstItem.mode : "explain";
  const bodyContent = renderModeContent(firstMode, firstItem, lang, lesson);

  return `
<section class="ai-tutor-page">
  <div class="ai-tutor-header">
    <h3 class="ai-tutor-title">${escapeHtml(tutorTitle)}</h3>
    <p class="ai-tutor-subtitle">${escapeHtml(tutorSubtitle)}</p>
    <div class="ai-tutor-badges">${badges}</div>
  </div>

  <div class="ai-tutor-modes">
    ${modeTabs}
  </div>

  <div class="ai-tutor-body">
    <div class="ai-tutor-mode-card">
      ${bodyContent}
    </div>
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
      const card = body.querySelector(".ai-tutor-mode-card");
      if (card) {
        cancelShadowingPlayback(card);
        resetLessonFocusSpeakSession();
        try {
          AUDIO_ENGINE.stop();
          startNewHskSpeakChain();
        } catch (_) {}
        card.innerHTML = renderModeContent(mode, item, lang, lesson);
        bindModeEvents(card, mode, item, lesson, lang);
      }
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
      const content = resultWrap.querySelector(".ai-tutor-result-content");
      if (content) {
        content.classList.remove("ai-tutor-result-empty");
        content.innerHTML = `<div class="ai-tutor-loading">${escapeHtml(t("ai.loading", t("common.loading", "Loading...")))}</div>`;
      }

      const res = await runTutor(mode, aiItem, lessonData, currentLang, userInput);
      const formatted = formatTutorOutput(mode, res, currentLang);
      if (content) {
        content.classList.remove("ai-tutor-result-empty");
        content.innerHTML = formatted.html || `<span class="ai-tutor-result-placeholder">${escapeHtml(t("ai.result_empty", "No response yet."))}</span>`;
      }
    };

    if (runBtn && mode !== "explain") {
      if (mode === "shadowing") {
        runBtn.addEventListener("click", () => toggleShadowingPlayback(wrap, aiItem));
        const rep = wrap.querySelector(".ai-shadowing-replay");
        const nxt = wrap.querySelector(".ai-shadowing-next");
        if (rep) rep.addEventListener("click", () => replayShadowingSentence(wrap, aiItem));
        if (nxt) nxt.addEventListener("click", () => skipShadowingNext(wrap, aiItem));
      } else if (mode === "roleplay") {
        const plan = buildSituationDialoguePlan(lessonData, currentLang);
        if (plan) mountSituationDialogue(wrap, plan, currentLang);
        else runBtn.addEventListener("click", () => doRun());
      } else {
        runBtn.addEventListener("click", () => doRun());
      }
    }

    if (sendBtn && inputEl) {
      sendBtn.addEventListener("click", () => {
        const val = str(inputEl.value);
        if (!val) {
          if (resultWrap) {
            resultWrap.classList.remove("hidden");
            const content = resultWrap.querySelector(".ai-tutor-result-content");
            if (content) {
              content.classList.add("ai-tutor-result-empty");
              content.innerHTML = `<span class="ai-tutor-result-placeholder">${escapeHtml(t("hsk.ai_empty", "Please enter a question."))}</span>`;
            }
          }
          return;
        }
        doRun(val);
      });
    }

    const speakAllBtn = wrap.querySelector(".ai-lesson-focus-speak-all");
    if (speakAllBtn && mode === "explain") {
      const focusRoot = wrap.querySelector(".ai-lesson-focus");
      speakAllBtn.addEventListener("click", () => {
        handleLessonFocusSpeakClick(lessonData, currentLang, focusRoot, speakAllBtn);
      });
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  const card = body && body.querySelector(".ai-tutor-mode-card");
  const firstItem = items.find((i) => i.mode === "explain") || items[0] || {};
  const firstMode = firstItem && firstItem.mode != null ? firstItem.mode : "explain";
  bindModeEvents(card, firstMode, firstItem, lesson, lang);
}
