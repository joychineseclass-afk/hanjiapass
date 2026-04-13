/**
 * 자유 질문 답변朗读：复用 AUDIO_ENGINE（speechSynthesis）+ 与「本课说明」对齐的轻量清洗
 */

import * as AUDIO_ENGINE from "../../platform/audio/audioEngine.js";
import { stripParenPinyinForSpeak } from "./aiLessonFocus.js";
import { applySlashTtsForSpeak } from "./aiLessonFocusSpeak.js";

/** 当前是否由本模块发起的 TTS（用于 pause/resume 状态与全局 synthesis 区分） */
let freeTalkTtsActive = false;

/** @param {string} uiLang */
export function uiLangToTtsBcp47(uiLang) {
  const l = String(uiLang || "kr").toLowerCase();
  if (l === "kr" || l === "ko") return "ko-KR";
  if (l === "cn" || l === "zh") return "zh-CN";
  if (l === "jp" || l === "ja") return "ja-JP";
  return "en-US";
}

/**
 * 朗读用文本：去 markdown、括号拼音、/ 连接词、多余空白
 * @param {string} raw
 * @param {string} uiLang
 */
export function prepareFreeTalkAnswerForTts(raw, uiLang) {
  let s = String(raw ?? "");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/^#{1,6}\s*/gm, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/^\s*[-*]\s+/gm, "");
  s = stripParenPinyinForSpeak(s);
  s = applySlashTtsForSpeak(s, uiLang);
  s = s.replace(/\n+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function getFreeTalkAnswerPlaybackState() {
  if (typeof window === "undefined" || !window.speechSynthesis) return "idle";
  if (!freeTalkTtsActive) return "idle";
  const syn = window.speechSynthesis;
  if (syn.paused) return "paused";
  if (syn.speaking) return "playing";
  return "idle";
}

/**
 * @param {string} plainAnswerText — formatTutorOutput 的纯文本
 * @param {string} uiLang
 * @param {{ onStateChange?: (state: "playing" | "paused" | "idle") => void }} [opts]
 */
export function playFreeTalkAnswer(plainAnswerText, uiLang, opts = {}) {
  const { onStateChange } = opts;
  const cleaned = prepareFreeTalkAnswerForTts(plainAnswerText, uiLang);
  if (!cleaned) {
    freeTalkTtsActive = false;
    onStateChange?.("idle");
    return;
  }
  const lang = uiLangToTtsBcp47(uiLang);
  AUDIO_ENGINE.stop();
  freeTalkTtsActive = true;
  AUDIO_ENGINE.playText(cleaned, {
    lang,
    rate: 0.95,
    onStart: () => {
      freeTalkTtsActive = true;
      onStateChange?.("playing");
    },
    onEnd: () => {
      freeTalkTtsActive = false;
      onStateChange?.("idle");
    },
    onError: () => {
      freeTalkTtsActive = false;
      onStateChange?.("idle");
    },
  });
}

export function pauseFreeTalkAnswer() {
  AUDIO_ENGINE.pauseSpeech();
}

export function resumeFreeTalkAnswer() {
  AUDIO_ENGINE.resumeSpeech();
}

export function stopFreeTalkAnswer() {
  freeTalkTtsActive = false;
  AUDIO_ENGINE.stop();
}

export function resetFreeTalkAnswerTts() {
  stopFreeTalkAnswer();
}

export function isBrowserTtsAvailable() {
  return AUDIO_ENGINE.isSpeechSupported();
}

/**
 * 绑定「답변」旁朗读按钮：播放 / 暂停 / 继续
 * @param {(key: string, fb?: string) => string} t
 * @returns {() => void} refresh — 答案变化或需同步 UI 时调用
 */
export function mountFreeTalkAnswerSpeakButton(buttonEl, getPlainText, uiLang, t) {
  if (!buttonEl) return () => {};

  function refreshUi() {
    const raw = getPlainText();
    const has = !!(raw && String(raw).trim());
    const speechOk = isBrowserTtsAvailable();
    const st = getFreeTalkAnswerPlaybackState();
    buttonEl.disabled = !has || !speechOk;

    let label = t("ai.free_talk_play_answer", "Listen to answer");
    if (has && speechOk) {
      if (st === "playing") label = t("ai.free_talk_pause_answer", "Pause");
      else if (st === "paused") label = t("ai.free_talk_resume_answer", "Resume");
    }
    buttonEl.setAttribute("aria-label", label);
    buttonEl.title = label;
    buttonEl.classList.toggle("is-playing", st === "playing");
    buttonEl.classList.toggle("is-paused", st === "paused");
  }

  function onClick() {
    const text = getPlainText();
    if (!text || !String(text).trim()) return;
    if (!isBrowserTtsAvailable()) return;
    const st = getFreeTalkAnswerPlaybackState();
    if (st === "idle") {
      playFreeTalkAnswer(text, uiLang, { onStateChange: () => refreshUi() });
      setTimeout(refreshUi, 30);
    } else if (st === "playing") {
      pauseFreeTalkAnswer();
      refreshUi();
    } else if (st === "paused") {
      resumeFreeTalkAnswer();
      setTimeout(refreshUi, 50);
    }
  }

  buttonEl.addEventListener("click", onClick);
  refreshUi();
  return refreshUi;
}
