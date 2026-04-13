/**
 * 자유 질문 답변朗读：唯一控制器 — 分段 zh-CN（汉字）/ UI 语言，统一 stop / pause / resume
 */

import * as AUDIO_ENGINE from "../../platform/audio/audioEngine.js";
import { stripParenPinyinForSpeak } from "./aiLessonFocus.js";
import { applySlashTtsForSpeak } from "./aiLessonFocusSpeak.js";

const ZH_BCP = "zh-CN";

/** 递增后旧链路的 onEnd 不再推进 */
let speakGen = 0;

/** 本模块是否占用「自由提问答案」播放会话 */
let freeTalkTtsSession = false;

/** 队列尚未播完（含句间间隙） */
let chainPending = false;

function bumpGen() {
  speakGen += 1;
}

/** @param {string} uiLang */
export function uiLangToTtsBcp47(uiLang) {
  const l = String(uiLang || "kr").toLowerCase();
  if (l === "kr" || l === "ko") return "ko-KR";
  if (l === "cn" || l === "zh") return "zh-CN";
  if (l === "jp" || l === "ja") return "ja-JP";
  return "en-US";
}

const PINYIN_SYLLABLE =
  "[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ·]+";

const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "is",
  "are",
  "was",
  "to",
  "of",
  "in",
  "it",
  "as",
  "at",
  "by",
  "for",
  "with",
  "from",
  "a",
  "an",
  "on",
  "be",
  "not",
  "this",
  "that",
  "you",
  "we",
  "they",
  "he",
  "she",
  "hello",
  "lesson",
  "there",
  "what",
  "when",
  "where",
  "which",
  "would",
  "could",
  "should",
  "click",
  "about",
  "after",
  "before",
]);

/**
 * 去掉「汉字后同一位置的拼音」（含空格分隔、无括号）
 */
function stripSpaceSeparatedPinyinAfterHanzi(s) {
  const syll = PINYIN_SYLLABLE;
  let out = s;
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out.replace(
      new RegExp(`([\\u4e00-\\u9fff]+)\\s+(${syll}(?:\\s+${syll})*)`, "gi"),
      (full, han, latin) => {
        const L = String(latin || "").trim();
        if (!L) return full;
        const tokens = L.split(/\s+/).filter(Boolean);
        if (!tokens.length) return full;
        if (tokens.some((w) => ENGLISH_STOPWORDS.has(w.toLowerCase()))) return full;
        if (/[āáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]/.test(L)) return han;
        const looksPinyinLike = tokens.every((t) => /^[a-z·]{1,8}$/i.test(t) && t.length <= 8);
        if (looksPinyinLike && tokens.length <= 8) {
          if (!/[āáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]/.test(L) && tokens.some((w) => w.length > 5)) return full;
          return han;
        }
        return full;
      },
    );
  }
  return out;
}

/**
 * 朗读专用：markdown / 括号拼音 / 同行拼音 / 空白
 * @param {string} raw
 * @param {string} uiLang
 */
export function buildFreeTalkSpeakText(raw, uiLang) {
  let s = String(raw ?? "");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/^#{1,6}\s*/gm, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/^\s*[-*]\s+/gm, "");
  s = stripParenPinyinForSpeak(s);
  s = stripSpaceSeparatedPinyinAfterHanzi(s);
  s = applySlashTtsForSpeak(s, uiLang);
  s = s.replace(/\n+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * 拆成汉字段（zh-CN）与其余（UI 语言），避免整段交给韩语/英语 TTS 读中文
 * @param {string} cleaned — buildFreeTalkSpeakText 输出
 * @param {string} uiLang
 * @returns {{ text: string, lang: string }[]}
 */
export function segmentFreeTalkSpeakParts(cleaned, uiLang) {
  const uiBcp = uiLangToTtsBcp47(uiLang);
  const s = String(cleaned || "").trim();
  if (!s) return [];

  if (uiBcp === ZH_BCP) {
    return [{ text: s, lang: ZH_BCP }];
  }

  const parts = [];
  const re = /([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1]) {
      const t = m[1].trim();
      if (t) parts.push({ text: t, lang: ZH_BCP });
    } else if (m[2]) {
      const t = m[2].replace(/\s+/g, " ").trim();
      if (t) parts.push({ text: t, lang: uiBcp });
    }
  }

  const merged = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && last.lang === p.lang) last.text = `${last.text} ${p.text}`.replace(/\s+/g, " ").trim();
    else merged.push({ ...p });
  }
  return merged;
}

export function isFreeTalkAnswerSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  if (!freeTalkTtsSession) return false;
  const syn = window.speechSynthesis;
  if (syn.speaking || syn.paused) return true;
  return chainPending;
}

export function getFreeTalkAnswerPlaybackState() {
  if (typeof window === "undefined" || !window.speechSynthesis) return "idle";
  if (!freeTalkTtsSession) return "idle";
  const syn = window.speechSynthesis;
  if (syn.paused) return "paused";
  if (syn.speaking || chainPending) return "playing";
  return "idle";
}

/**
 * @param {string} plainAnswerText
 * @param {string} uiLang
 * @param {{ onStateChange?: (state: "playing" | "paused" | "idle") => void }} [opts]
 */
export function playFreeTalkAnswerTts(plainAnswerText, uiLang, opts = {}) {
  const { onStateChange } = opts;
  stopFreeTalkAnswerTts();

  const cleaned = buildFreeTalkSpeakText(plainAnswerText, uiLang);
  const segments = segmentFreeTalkSpeakParts(cleaned, uiLang).filter((x) => x.text && x.text.trim());
  if (!segments.length) {
    freeTalkTtsSession = false;
    chainPending = false;
    onStateChange?.("idle");
    return;
  }

  const myGen = speakGen;
  freeTalkTtsSession = true;
  chainPending = true;

  let idx = 0;

  function finishIdle() {
    if (myGen !== speakGen) return;
    chainPending = false;
    freeTalkTtsSession = false;
    onStateChange?.("idle");
  }

  function speakNext() {
    if (myGen !== speakGen) return;
    if (idx >= segments.length) {
      finishIdle();
      return;
    }
    const seg = segments[idx++];
    const text = String(seg.text || "").trim();
    if (!text) {
      speakNext();
      return;
    }

    AUDIO_ENGINE.playText(text, {
      lang: seg.lang || ZH_BCP,
      rate: 0.95,
      onStart: () => {
        if (myGen !== speakGen) return;
        onStateChange?.("playing");
      },
      onEnd: () => {
        if (myGen !== speakGen) return;
        speakNext();
      },
      onError: () => {
        if (myGen !== speakGen) return;
        speakNext();
      },
    });
  }

  onStateChange?.("playing");
  speakNext();
}

export function pauseFreeTalkAnswerTts() {
  AUDIO_ENGINE.pauseSpeech();
}

export function resumeFreeTalkAnswerTts() {
  AUDIO_ENGINE.resumeSpeech();
}

export function stopFreeTalkAnswerTts() {
  bumpGen();
  chainPending = false;
  freeTalkTtsSession = false;
  AUDIO_ENGINE.stop();
}

/** @deprecated 使用 stopFreeTalkAnswerTts */
export function resetFreeTalkAnswerTts() {
  stopFreeTalkAnswerTts();
}

export function isBrowserTtsAvailable() {
  return AUDIO_ENGINE.isSpeechSupported();
}

/**
 * 绑定「답변」旁朗读按钮
 * @param {(key: string, fb?: string) => string} t
 * @returns {() => void} refresh
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
      playFreeTalkAnswerTts(text, uiLang, { onStateChange: () => refreshUi() });
      setTimeout(refreshUi, 30);
    } else if (st === "playing") {
      pauseFreeTalkAnswerTts();
      refreshUi();
    } else if (st === "paused") {
      resumeFreeTalkAnswerTts();
      setTimeout(refreshUi, 50);
    }
  }

  buttonEl.addEventListener("click", onClick);
  refreshUi();
  return refreshUi;
}

if (typeof window !== "undefined" && !window.__HANJIPASS_FREE_TALK_TTS_UNLOAD__) {
  window.__HANJIPASS_FREE_TALK_TTS_UNLOAD__ = true;
  window.addEventListener(
    "pagehide",
    () => {
      stopFreeTalkAnswerTts();
    },
    { capture: true },
  );
}
