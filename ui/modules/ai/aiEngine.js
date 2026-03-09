/**
 * AI Tutor v1 - 最小接口
 * 统一 explain / roleplay 入口，为后续商务中文、口语、Kids、Travel 复用
 */

import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 从多语言对象中按 lang 取值 */
function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "kr").toLowerCase();
  const key = l === "zh" || l === "cn" ? "cn" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  return str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.jp ?? obj.en ?? "");
}

/**
 * 构建 AI 提示词
 * @param {object} aiItem - lesson.ai 中的单项 { type, target?, scenario?, hint?, prompt?, title? }
 * @param {object} lessonData - 完整 lesson 对象
 * @param {string} lang - kr | cn | en | jp
 */
export function buildPrompt(aiItem, lessonData, lang) {
  if (!aiItem || !aiItem.type) return "请用中文回答。";
  const type = aiItem.type;
  const target = str(aiItem.target);
  const scenario = str(aiItem.scenario);
  const hint = pickLang(aiItem.hint, lang);
  const promptText = pickLang(aiItem.prompt, lang);
  const lessonTitle = pickLang(lessonData?.title, lang) || "";
  const vocab = Array.isArray(lessonData?.vocab) ? lessonData.vocab : (lessonData?.words ?? []);
  const vocabStr = vocab.slice(0, 10).map((v) => (v && (v.hanzi ?? v.word ?? v)) || "").filter(Boolean).join("、");

  const parts = [];

  if (type === "explain" && target) {
    parts.push(`请解释以下中文内容：${target}`);
    if (hint) parts.push(`\n提示：${hint}`);
    if (lessonTitle) parts.push(`\n本课主题：${lessonTitle}`);
    if (vocabStr) parts.push(`\n相关词汇：${vocabStr}`);
  }

  if (type === "roleplay") {
    parts.push(`请进行以下场景的对话练习：${scenario || "greeting"}`);
    if (promptText) parts.push(`\n任务：${promptText}`);
    if (lessonTitle) parts.push(`\n本课：${lessonTitle}`);
  }

  return parts.join("\n") || "请用中文回答。";
}

/**
 * 调用 AI 服务（占位）
 * @param {object} aiItem - lesson.ai 中的单项
 * @param {object} lessonData - 完整 lesson 对象
 * @param {string} lang - kr | cn | en | jp
 * @returns {Promise<{ text: string }>}
 */
export async function runTutor(aiItem, lessonData, lang) {
  const type = aiItem?.type || "explain";
  const prompt = buildPrompt(aiItem, lessonData, lang);

  // 实际接入 AI API 时在此实现
  if (typeof window !== "undefined" && window.JOY_RUNNER?.askAI) {
    try {
      const res = await window.JOY_RUNNER.askAI({ prompt, context: prompt, lang, mode: type });
      return { text: res?.text ?? "" };
    } catch (e) {
      return { text: `[AI 暂未连接] ${e?.message ?? ""}` };
    }
  }

  // 占位：按类型返回可见反馈
  const placeholderExplain = str(i18n?.t?.("ai.placeholder_explain") ?? "正在准备讲解…");
  const placeholderRoleplay = str(i18n?.t?.("ai.placeholder_roleplay") ?? "现在进入练习场景…");
  const target = str(aiItem?.target);
  const scenario = str(aiItem?.scenario);

  if (type === "explain") {
    const line = target ? `「${target}」` : "";
    return { text: `${placeholderExplain} ${line}\n\n（接入 AI 后将在此显示详细讲解）` };
  }
  if (type === "roleplay") {
    const scene = scenario ? `「${scenario}」` : "";
    return { text: `${placeholderRoleplay} ${scene}\n\n（接入 AI 后将在此进行情景对话）` };
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
