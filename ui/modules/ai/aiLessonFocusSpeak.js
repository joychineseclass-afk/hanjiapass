/**
 * 本课说明区全文朗读：分段队列 + 暂停/继续（speechSynthesis.pause/resume）
 * TTS 预处理：/ → 连接词（两侧均为汉字时用「和」，否则按系统语言）；保留 stripParenPinyin 与 mixed 拼音规则
 */

import * as LE from "../../core/i18n.js";
import { getLang } from "../../core/languageEngine.js";
import { buildLessonFocusSpeakSegments, stripParenPinyinForSpeak } from "./aiLessonFocus.js";
import { collectLessonPinyinToHanziMap } from "../../utils/hsk30UiMeaningMixedTts.js";

/** @type {{ active: boolean, paused: boolean, highlightEl: HTMLElement | null, btn: HTMLButtonElement | null }} */
let lfSession = {
  active: false,
  paused: false,
  highlightEl: null,
  btn: null,
};

function t(key, fb) {
  return LE.t(key, fb) || fb || key;
}

/** 片段是否含至少一个汉字（CJK 统一表意区），用于判定「中文 / 中文」 */
function segmentHasHanzi(s) {
  const t = String(s ?? "").trim();
  if (!t) return false;
  return /[\u4e00-\u9fff]/.test(t);
}

/** 系统语言下 / 的朗读连接（仅 TTS，不改页面）；不含「两侧均汉字」场景 */
function slashConnector(uiLang) {
  const l = String(uiLang || "kr").toLowerCase();
  if (l === "kr" || l === "ko") return " 와 ";
  if (l === "cn" || l === "zh") return " 和 ";
  if (l === "en") return " and ";
  if (l === "jp" || l === "ja") return "と";
  return "和";
}

/**
 * 将 / 换为朗读用连接词：两侧均为汉字短语时一律「和」（与 UI 语言无关），否则按系统语言。
 * 应在 stripParenPinyinForSpeak 之后调用，避免干扰汉字+拼音去重。
 */
export function applySlashTtsForSpeak(text, uiLang) {
  if (text == null || text === "") return "";
  const str = String(text);
  if (!str.includes("/")) return str;
  const parts = str.split(/\s*\/\s*/);
  if (parts.length < 2) return str;
  const fallback = slashConnector(uiLang);
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const left = parts[i - 1];
    const right = parts[i];
    const conn = segmentHasHanzi(left) && segmentHasHanzi(right) ? "和" : fallback;
    out += conn + right;
  }
  return out;
}

function preprocessSegmentsForTts(segments, uiLang) {
  return segments
    .map((s) => {
      const zhRaw = String(s?.zh ?? "").trim();
      const uiRaw = String(s?.ui ?? "").trim();
      const zh = zhRaw ? applySlashTtsForSpeak(stripParenPinyinForSpeak(zhRaw), uiLang) : "";
      const ui = uiRaw ? applySlashTtsForSpeak(stripParenPinyinForSpeak(uiRaw), uiLang) : "";
      return { zh, ui };
    })
    .filter((s) => s.zh || s.ui);
}

function refreshSpeakButton() {
  const btn = lfSession.btn;
  if (!btn) return;
  const tx = btn.querySelector(".ai-lesson-focus-speak-txt");
  const ic = btn.querySelector(".ai-lesson-focus-speak-ic");
  let label = t("ai.lesson_focus_speak_all", "全文朗读");
  btn.classList.remove("is-speaking", "is-paused");
  if (lfSession.active && !lfSession.paused) {
    label = t("ai.lesson_focus_speak_pause", "暂停");
    btn.classList.add("is-speaking");
  } else if (lfSession.active && lfSession.paused) {
    label = t("ai.lesson_focus_speak_continue", "继续");
    btn.classList.add("is-paused");
  }
  if (tx) tx.textContent = label;
  btn.setAttribute("aria-label", label);
  if (ic) ic.setAttribute("aria-hidden", "true");
}

/**
 * 切换 Tab 或重挂载时复位（不依赖旧 DOM）
 */
export function resetLessonFocusSpeakSession() {
  lfSession = { active: false, paused: false, highlightEl: null, btn: null };
}

async function runSpeakLoop(lesson, langParam, highlightEl, btn) {
  const { AUDIO_ENGINE } = await import("../../platform/index.js");
  const {
    startNewHskSpeakChain,
    getHskSpeakGeneration,
    speakZhThenMeaningPromise,
    speakUiLangTextOnce,
    speakMixedUiMeaningText,
    batchPauseBetweenSegments,
  } = await import("../hsk/hskRenderer.js");

  const raw = buildLessonFocusSpeakSegments(lesson, langParam);
  const uiLang = getLang();
  const list = preprocessSegmentsForTts(raw, uiLang);
  if (!list.length) return;

  const gen = startNewHskSpeakChain();
  AUDIO_ENGINE.stop();

  lfSession.active = true;
  lfSession.paused = false;
  lfSession.highlightEl = highlightEl;
  lfSession.btn = btn;
  refreshSpeakButton();

  if (highlightEl) {
    try {
      highlightEl.classList.add("is-speaking");
    } catch (_) {}
  }

  const useMixed = lesson != null;
  const pinyinMap = useMixed ? collectLessonPinyinToHanziMap(lesson) : new Map();

  const waitWhilePaused = async () => {
    while (lfSession.paused && lfSession.active) {
      if (gen !== getHskSpeakGeneration()) return;
      await new Promise((r) => setTimeout(r, 80));
    }
  };

  const meaningOpts = useMixed
    ? { mixedUiMeaning: true, pinyinMap, waitWhilePaused }
    : { waitWhilePaused };

  try {
    for (let i = 0; i < list.length; i++) {
      while (lfSession.paused && lfSession.active) {
        await new Promise((r) => setTimeout(r, 80));
      }
      if (!lfSession.active || gen !== getHskSpeakGeneration()) break;

      if (i > 0) {
        await batchPauseBetweenSegments(gen);
        while (lfSession.paused && lfSession.active) {
          if (gen !== getHskSpeakGeneration()) break;
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      if (!lfSession.active || gen !== getHskSpeakGeneration()) break;

      const seg = list[i];
      if (seg.zh && seg.ui) {
        await speakZhThenMeaningPromise(seg.zh, seg.ui, gen, meaningOpts);
      } else if (seg.zh) {
        await speakZhThenMeaningPromise(seg.zh, "", gen, { waitWhilePaused });
      } else if (seg.ui) {
        if (useMixed) await speakMixedUiMeaningText(seg.ui, gen, pinyinMap, meaningOpts);
        else await speakUiLangTextOnce(seg.ui, gen);
      }
    }
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) console.warn("[lessonFocusSpeak]", err);
  } finally {
    lfSession.active = false;
    lfSession.paused = false;
    try {
      highlightEl?.classList.remove("is-speaking");
    } catch (_) {}
    refreshSpeakButton();
  }
}

/**
 * 全文朗读：idle → 播放；playing → pause；paused → resume。支持多次暂停/继续。
 */
export async function handleLessonFocusSpeakClick(lesson, langParam, highlightEl, btn) {
  const { AUDIO_ENGINE } = await import("../../platform/index.js");

  if (lfSession.active && !lfSession.paused) {
    lfSession.paused = true;
    try {
      if (typeof AUDIO_ENGINE.pauseSpeech === "function") {
        AUDIO_ENGINE.pauseSpeech();
      } else if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.pause === "function") {
        window.speechSynthesis.pause();
      }
    } catch (_) {}
    refreshSpeakButton();
    return;
  }

  if (lfSession.active && lfSession.paused) {
    lfSession.paused = false;
    try {
      if (typeof AUDIO_ENGINE.resumeSpeech === "function") {
        AUDIO_ENGINE.resumeSpeech();
      } else if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.resume === "function") {
        window.speechSynthesis.resume();
      }
    } catch (_) {}
    refreshSpeakButton();
    return;
  }

  await runSpeakLoop(lesson, langParam, highlightEl, btn);
}

/**
 * @deprecated 使用 handleLessonFocusSpeakClick
 */
export async function runLessonFocusSpeakAll(lesson, lang, highlightEl, btn) {
  await handleLessonFocusSpeakClick(lesson, lang, highlightEl, btn);
}
