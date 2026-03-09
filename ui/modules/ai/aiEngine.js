/**
 * AI Tutor v1 - 最小接口
 * 统一 explain / roleplay 入口，为后续商务中文、口语、Kids、Travel 复用
 */

import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 构建 AI 提示词
 * @param {object} opts - { type, target?, scenario?, context?, lang }
 */
export function buildPrompt(opts = {}) {
  const { type, target, scenario, context = {}, lang = "ko" } = opts;
  const parts = [];

  if (type === "explain" && target) {
    parts.push(`请解释以下中文内容：${target}`);
    if (context.lessonTitle) parts.push(`\n本课主题：${context.lessonTitle}`);
    const vocab = context.vocab ?? [];
    if (vocab.length) parts.push(`\n相关词汇：${vocab.slice(0, 10).map((v) => v.hanzi || v).join("、")}`);
  }

  if (type === "roleplay" && scenario) {
    parts.push(`请进行以下场景的对话练习：${scenario}`);
    if (context.lessonTitle) parts.push(`\n本课：${context.lessonTitle}`);
  }

  return parts.join("\n") || "请用中文回答。";
}

/**
 * 调用 AI 服务（占位）
 * @param {object} opts - { prompt, lang, type }
 * @returns {Promise<{ text: string }>}
 */
export async function runTutor(opts = {}) {
  const { prompt, lang, type } = opts;
  if (!prompt) return { text: "" };

  // 占位：实际接入 AI API 时在此实现
  if (typeof window !== "undefined" && window.JOY_RUNNER?.askAI) {
    try {
      const res = await window.JOY_RUNNER.askAI({ prompt, context: prompt, lang, mode: type || "explain" });
      return { text: res?.text ?? "" };
    } catch (e) {
      return { text: `[AI 暂未连接] ${e?.message ?? ""}` };
    }
  }

  return { text: str(i18n?.t?.("ai.placeholder") ?? "AI 功能即将上线，敬请期待。") };
}

/**
 * 格式化 AI 返回结果
 * @param {object} result - { text }
 * @param {string} [lang]
 */
export function formatTutorResult(result, lang) {
  const text = result?.text ?? "";
  return { text, html: text ? `<div class="ai-tutor-result">${escapeHtml(text)}</div>` : "" };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br>");
}

/**
 * 获取 lesson 中的 ai 配置数组
 * @param {object} lesson
 * @returns {Array<{ type: string, target?: string, scenario?: string }>}
 */
export function getLessonAIConfig(lesson) {
  const arr = lesson?.ai ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.filter((item) => item && (item.type === "explain" || item.type === "roleplay"));
}
