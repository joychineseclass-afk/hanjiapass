/**
 * AI Tutor v1 面板
 * 模式切换 + 内容区，产品化收口
 */

import { i18n } from "../../i18n.js";
import { getLessonAIConfig, runTutor, formatTutorOutput } from "./aiTutorEngine.js";
import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { renderModeContent } from "./aiTutorModes.js";
import { buildSituationDialoguePlan, mountSituationDialogue } from "./aiSituationDialogue.js";
import { cancelShadowingPlayback } from "./aiShadowingPlayback.js";
import { mountShadowingSpeakingPractice } from "./shadowingSpeakingPractice.js";
import { handleLessonFocusSpeakClick, resetLessonFocusSpeakSession } from "./aiLessonFocusSpeak.js";
import { AUDIO_ENGINE } from "../../platform/index.js";
import { startNewHskSpeakChain } from "../hsk/hskRenderer.js";
import { getCachedAnswer, setCachedAnswer, shouldCacheFreeTalkAnswer } from "./freeTalkCache.js";
import { startFreeTalkLoadingHints } from "./freeTalkLoadingHints.js";
import {
  createFreeTalkSpeechInputSession,
  isFreeTalkSpeechInputSupported,
} from "./freeTalkSpeechInput.js";
import { mountFreeTalkAnswerSpeakButton, stopFreeTalkAnswerTts } from "./freeTalkAnswerTts.js";

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
        stopFreeTalkAnswerTts();
        if (typeof card._freeTalkCleanup === "function") {
          try {
            card._freeTalkCleanup();
          } catch (_) {}
          card._freeTalkCleanup = null;
        }
        if (typeof card._shadowingCleanup === "function") {
          try {
            card._shadowingCleanup();
          } catch (_) {}
          card._shadowingCleanup = null;
        }
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

    let freeTalkAnswerPlain = "";
    let refreshFreeTalkAnswerSpeak = () => {};
    /** @type {null | ReturnType<typeof createFreeTalkSpeechInputSession>} */
    let freeTalkSpeechSession = null;

    const runBtn = wrap.querySelector(".ai-tutor-run");
    const sendBtn = wrap.querySelector(".ai-tutor-send");
    const resultWrap = wrap.querySelector(".ai-tutor-result-wrap");
    const inputEl = wrap.querySelector(".ai-tutor-input");
    const voiceBtn = wrap.querySelector(".ai-free-talk-voice-btn");

    const doRun = async (userInput = "") => {
      if (!resultWrap) return;
      resultWrap.classList.remove("hidden");
      const content = resultWrap.querySelector(".ai-tutor-result-content");

      if (mode === "free_talk") {
        stopFreeTalkAnswerTts();

        const courseId = lessonData?.courseId != null ? String(lessonData.courseId) : "";
        const lessonId =
          lessonData?.id != null
            ? String(lessonData.id)
            : lessonData?.lessonId != null
              ? String(lessonData.lessonId)
              : "";
        const uiLang = currentLang;

        const cached = getCachedAnswer(courseId, lessonId, uiLang, userInput);
        if (cached?.answerText) {
          if (content) {
            content.classList.remove("ai-tutor-result-empty");
            const formatted = formatTutorOutput(mode, { text: cached.answerText }, currentLang);
            content.innerHTML = formatted.html || `<span class="ai-tutor-result-placeholder">${escapeHtml(t("ai.result_empty", "No response yet."))}</span>`;
            freeTalkAnswerPlain = formatted.text || "";
            refreshFreeTalkAnswerSpeak();
          }
          return;
        }

        console.info("[HANJIPASS freeTalk] ask start", { courseId, lessonId, uiLang });

        if (freeTalkSpeechSession?.isListening?.()) {
          freeTalkSpeechSession.abort();
        }

        freeTalkAnswerPlain = "";
        refreshFreeTalkAnswerSpeak();

        let stopHints = () => {};
        if (sendBtn) sendBtn.disabled = true;
        if (voiceBtn) voiceBtn.disabled = true;
        try {
          if (content) {
            content.classList.remove("ai-tutor-result-empty");
            const loadingWrap = document.createElement("div");
            loadingWrap.className = "ai-free-talk-loading-root";
            content.innerHTML = "";
            content.appendChild(loadingWrap);
            stopHints = startFreeTalkLoadingHints(loadingWrap, t);
          }

          const res = await runTutor(mode, aiItem, lessonData, currentLang, userInput);

          const formatted = formatTutorOutput(mode, res, currentLang);
          if (shouldCacheFreeTalkAnswer(res) && formatted.text) {
            setCachedAnswer(courseId, lessonId, uiLang, userInput, formatted.text, "gemini");
          } else {
            console.info("[HANJIPASS freeTalk] skip cache");
          }

          if (content) {
            content.classList.remove("ai-tutor-result-empty");
            content.innerHTML =
              formatted.html || `<span class="ai-tutor-result-placeholder">${escapeHtml(t("ai.result_empty", "No response yet."))}</span>`;
            freeTalkAnswerPlain = formatted.text || "";
            refreshFreeTalkAnswerSpeak();
          }
        } finally {
          stopHints();
          if (sendBtn) sendBtn.disabled = false;
          if (voiceBtn) voiceBtn.disabled = !isFreeTalkSpeechInputSupported();
        }
        return;
      }

      if (content) {
        content.classList.remove("ai-tutor-result-empty");
        const loadingMsg = t("ai.loading", t("common.loading", "Loading..."));
        content.innerHTML = `<div class="ai-tutor-loading">${escapeHtml(loadingMsg)}</div>`;
      }

      const res = await runTutor(mode, aiItem, lessonData, currentLang, userInput);
      const formatted = formatTutorOutput(mode, res, currentLang);
      if (content) {
        content.classList.remove("ai-tutor-result-empty");
        content.innerHTML = formatted.html || `<span class="ai-tutor-result-placeholder">${escapeHtml(t("ai.result_empty", "No response yet."))}</span>`;
      }
    };

    if (mode === "shadowing") {
      try {
        if (typeof wrap._shadowingCleanup === "function") wrap._shadowingCleanup();
      } catch (_) {}
      wrap._shadowingCleanup = mountShadowingSpeakingPractice(wrap, t);
    }

    if (runBtn && mode !== "explain") {
      if (mode === "roleplay") {
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
        if (wrap.classList.contains("ai-tutor-free_talk") && val) {
          stopFreeTalkAnswerTts();
        }
        if (!val) {
          if (wrap.classList.contains("ai-tutor-free_talk")) {
            freeTalkAnswerPlain = "";
            refreshFreeTalkAnswerSpeak();
          }
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

    if (mode === "free_talk") {
      const voiceHint = wrap.querySelector(".ai-free-talk-voice-hint");
      const answerSpeakBtn = wrap.querySelector(".ai-free-talk-answer-speak");

      refreshFreeTalkAnswerSpeak = mountFreeTalkAnswerSpeakButton(
        answerSpeakBtn,
        () => freeTalkAnswerPlain,
        currentLang,
        t,
      );

      const speechSession = createFreeTalkSpeechInputSession({ uiLang: currentLang });
      freeTalkSpeechSession = speechSession;

      function showVoiceHintMessage(msg) {
        if (!voiceHint) return;
        voiceHint.textContent = msg || "";
        voiceHint.hidden = !msg;
        if (msg) {
          window.setTimeout(() => {
            if (voiceHint.textContent === msg) {
              voiceHint.textContent = "";
              voiceHint.hidden = true;
            }
          }, 4200);
        }
      }

      if (voiceBtn) {
        const voiceOk = isFreeTalkSpeechInputSupported();
        if (!voiceOk) {
          voiceBtn.disabled = true;
          voiceBtn.classList.add("is-disabled");
        }
        voiceBtn.addEventListener("click", () => {
          if (!voiceOk) {
            showVoiceHintMessage(t("ai.free_talk_voice_not_supported", ""));
            return;
          }
          stopFreeTalkAnswerTts();
          speechSession.toggle({
            onResult: (text) => {
              if (inputEl) inputEl.value = text;
              voiceBtn.classList.remove("is-listening");
            },
            onError: (code) => {
              voiceBtn.classList.remove("is-listening");
              if (code === "permission_denied") {
                showVoiceHintMessage(t("ai.free_talk_voice_permission_denied", ""));
              } else if (code === "not_supported") {
                showVoiceHintMessage(t("ai.free_talk_voice_not_supported", ""));
              } else {
                showVoiceHintMessage(t("ai.free_talk_voice_retry", ""));
              }
            },
            onListeningChange: (listening) => {
              voiceBtn.classList.toggle("is-listening", listening);
              if (voiceHint) {
                if (listening) {
                  voiceHint.textContent = t("ai.free_talk_voice_listening", "");
                  voiceHint.hidden = false;
                } else if (!voiceHint.textContent || voiceHint.textContent === t("ai.free_talk_voice_listening", "")) {
                  voiceHint.textContent = "";
                  voiceHint.hidden = true;
                }
              }
            },
          });
        });
      }

      wrap._freeTalkCleanup = () => {
        speechSession.abort();
        freeTalkSpeechSession = null;
        stopFreeTalkAnswerTts();
      };

      if (inputEl) {
        wrap.querySelectorAll(".ai-free-talk-example-chip").forEach((chip) => {
          chip.addEventListener("click", () => {
            stopFreeTalkAnswerTts();
            const idx = chip.getAttribute("data-example-index");
            if (!idx) return;
            const text = str(t(`ai.free_question_example_${idx}`, ""));
            if (!text) return;
            inputEl.value = text;
            try {
              inputEl.focus();
            } catch (_) {}
          });
        });
      }
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
