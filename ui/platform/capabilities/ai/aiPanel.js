/**
 * 平台级 AI 对话训练面板
 * AI Tutor v1：Explain / Roleplay / Shadowing / Free Talk 四种模式
 */

import { mountAITutorPanel } from "../../../modules/ai/aiTutorPanel.js";
import { stopFreeTalkAnswerTts } from "../../../modules/ai/freeTalkAnswerTts.js";

/**
 * 渲染 AI 面板 HTML（委托给 AI Tutor 面板，由 mountAIPanel 填充）
 */
export function renderAIPanel(opts = {}) {
  return "";
}

/**
 * 挂载 AI 面板（AI Tutor v1）
 * @param {HTMLElement} container
 * @param {object} opts - { lesson, lang, wordsWithMeaning, onCopy, onStart }
 */
export function mountAIPanel(container, opts = {}) {
  if (!container) return;
  stopFreeTalkAnswerTts();
  mountAITutorPanel(container, opts);
}
