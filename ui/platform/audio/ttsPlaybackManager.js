/**
 * 全站统一 TTS / 浏览器朗读播放管理：单一路径停止、互斥、与 bulk 条暂停/继续对齐。
 * 业务模块应调用此处 API，避免分散操作 speechSynthesis。
 */
import * as AUDIO_ENGINE from "./audioEngine.js";
import { closeBulkSpeakPlayer, getBulkTtsPlayer } from "../../modules/hsk/hskBulkSpeakPlayer.js";
import {
  clearHsk30SingleItemLoopState,
  startNewHskSpeakChain,
} from "../../modules/hsk/hskSpeakState.js";
import { stopFreeTalkAnswerTts } from "../../modules/ai/freeTalkAnswerTts.js";
import {
  clearPlaybackRegistration,
  registerBulkPlayback as _registerBulkPlayback,
  registerChainPlayback as _registerChainPlayback,
  registerSinglePlayback as _registerSinglePlayback,
  getTtsPlaybackFlags,
} from "./ttsPlaybackFlags.js";

/** @typedef {'word'|'dialogue'|'grammar'|'extension'|'reading'|'practice'|'ai'|'review'|'other'} TtsScope */

export const TTS_SCOPE = {
  WORD: "word",
  DIALOGUE: "dialogue",
  GRAMMAR: "grammar",
  EXTENSION: "extension",
  READING: "reading",
  PRACTICE: "practice",
  AI: "ai",
  REVIEW: "review",
  OTHER: "other",
};

export function getPlaybackSnapshot() {
  const bulk = getBulkTtsPlayer();
  const flags = getTtsPlaybackFlags();
  return {
    ...flags,
    bulkPlaying: bulk.isOutputActive(),
    bulkPausedByUser: bulk.isPausedByUser(),
    bulkLoop: !!bulk.bulkLoop,
    bulkLoopKind: bulk.loopKind,
  };
}

export function registerBulkPlayback(scope) {
  _registerBulkPlayback(scope || TTS_SCOPE.OTHER);
}

export function registerSinglePlayback(scope) {
  _registerSinglePlayback(scope || TTS_SCOPE.OTHER);
}

export function registerChainPlayback(scope) {
  _registerChainPlayback(scope || TTS_SCOPE.OTHER);
}

export { clearPlaybackRegistration };

/**
 * 全站停止：bulk 条、单条循环、异步朗读链、自由问答 TTS、底层引擎、高亮 class。
 * 切换课次/路由/模块前应调用。
 */
export function stopAllPlayback() {
  try {
    closeBulkSpeakPlayer();
  } catch (_) {}

  try {
    clearHsk30SingleItemLoopState();
  } catch (_) {}

  try {
    startNewHskSpeakChain();
  } catch (_) {}

  try {
    stopFreeTalkAnswerTts();
  } catch (_) {}

  try {
    AUDIO_ENGINE.stop();
  } catch (_) {}

  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch (_) {}

  try {
    document.querySelectorAll(".is-speaking").forEach((el) => el.classList.remove("is-speaking"));
  } catch (_) {}

  clearPlaybackRegistration();
}

/**
 * 开始新的单句点读（会先 stopAll，符合「先停旧再播新」）。
 * @param {string} text
 * @param {{ lang?: string, rate?: number, audioUrl?: string, scope?: TtsScope|string, onStart?: () => void, onEnd?: () => void, onError?: (e: unknown) => void }} [opts]
 */
export function playSingleText(text, opts = {}) {
  const t = String(text ?? "").trim();
  if (!t) return;

  stopAllPlayback();
  try {
    opts.beforePlay?.();
  } catch (_) {}
  _registerSinglePlayback(opts.scope || TTS_SCOPE.OTHER);

  const finish = () => {
    clearPlaybackRegistration();
    try {
      opts.onEnd?.();
    } catch (_) {}
  };
  const onErr = (e) => {
    try {
      opts.onError?.(e);
    } catch (_) {}
    finish();
  };

  AUDIO_ENGINE.playText(t, {
    lang: opts.lang || "zh-CN",
    rate: typeof opts.rate === "number" ? opts.rate : 0.95,
    audioUrl: opts.audioUrl,
    onStart: opts.onStart,
    onEnd: finish,
    onError: onErr,
  });
}

/**
 * 多段 zh/ui 链（语法/扩展/练习等），实现见 hskRenderer.speakHsk30ZhUiSegmentChain。
 */
export async function playSequence(segments, highlightEl, chainOpts = {}) {
  const { speakHsk30ZhUiSegmentChain } = await import("../../modules/hsk/hskRenderer.js");
  return speakHsk30ZhUiSegmentChain(segments, highlightEl, chainOpts);
}

export function pauseCurrentPlayback() {
  const bulk = getBulkTtsPlayer();
  if (bulk.isOutputActive() || bulk.isPausedByUser()) {
    bulk.pausePlayback();
    return true;
  }
  try {
    AUDIO_ENGINE.pauseSpeech();
  } catch (_) {}
  return true;
}

export function resumeCurrentPlayback() {
  const bulk = getBulkTtsPlayer();
  if (bulk.isPausedByUser()) {
    bulk.resumePlayback();
    return true;
  }
  try {
    AUDIO_ENGINE.resumeSpeech();
  } catch (_) {}
  return true;
}

/**
 * 设置整体朗读条循环（仅当 bulk 时间线已加载时有效）。
 * @param {boolean} enabled
 * @param {'words'|'dialogue'|null} [kind]
 */
export function setLoopMode(enabled, kind = null) {
  const p = getBulkTtsPlayer();
  if (!p.timeline.length) {
    p.bulkLoop = false;
    p.loopKind = null;
    return;
  }
  p.bulkLoop = !!enabled;
  p.loopKind = enabled ? kind || p.loopKind : null;
}
