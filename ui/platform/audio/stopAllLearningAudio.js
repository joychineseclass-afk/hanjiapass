/**
 * 全站学习区 TTS / 朗读统一停止：切换内容、路由、课次时只保留一个音频任务。
 * - 浏览器 TTS（含队列）
 * - HSK 整体朗读条（bulk）
 * - HSK 分段链 / 🔁 单条循环状态
 * - AI 自由问答答案朗读
 * - 高亮 .is-speaking
 */
import * as AUDIO_ENGINE from "./audioEngine.js";
import { closeBulkSpeakPlayer } from "../../modules/hsk/hskBulkSpeakPlayer.js";
import { clearHsk30SingleItemLoopState, startNewHskSpeakChain } from "../../modules/hsk/hskRenderer.js";
import { stopFreeTalkAnswerTts } from "../../modules/ai/freeTalkAnswerTts.js";

export function stopAllLearningAudio() {
  try {
    closeBulkSpeakPlayer();
  } catch (_) {}

  try {
    clearHsk30SingleItemLoopState();
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
}
