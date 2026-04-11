/**
 * 本课说明区全文朗读：复用 HSK3.0 speakHsk30ZhUiSegmentChain（中文 / 系统语言 / 夹杂拼音映射）
 */

import { buildLessonFocusSpeakSegments } from "./aiLessonFocus.js";

/**
 * 朗读本课说明全部段落；再次点击正在朗读时停止。
 * @param {object} lesson
 * @param {string} lang
 * @param {HTMLElement | null} highlightEl — 通常为 .ai-lesson-focus
 * @param {HTMLButtonElement | null} btn
 */
export async function runLessonFocusSpeakAll(lesson, lang, highlightEl, btn) {
  const { AUDIO_ENGINE } = await import("../../platform/index.js");
  const { startNewHskSpeakChain, speakHsk30ZhUiSegmentChain } = await import("../hsk/hskRenderer.js");

  if (btn?.classList?.contains("is-speaking")) {
    AUDIO_ENGINE.stop();
    startNewHskSpeakChain();
    btn.classList.remove("is-speaking");
    return;
  }

  const segments = buildLessonFocusSpeakSegments(lesson, lang);
  if (!segments.length) return;

  startNewHskSpeakChain();
  AUDIO_ENGINE.stop();
  btn?.classList?.add("is-speaking");
  try {
    await speakHsk30ZhUiSegmentChain(segments, highlightEl, { lessonForPinyinMap: lesson });
  } finally {
    btn?.classList?.remove("is-speaking");
  }
}
