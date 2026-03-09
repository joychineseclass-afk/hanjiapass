/**
 * AI Tutor 四种模式的 UI 渲染
 * explain / roleplay / shadowing / free_talk
 */

import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s ?? "")
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
  return str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.jp ?? obj.en ?? "");
}

/**
 * 渲染 Explain 面板
 */
export function renderExplainMode(aiItem, lang) {
  const target = str(aiItem?.target ?? "");
  const hint = pickLang(aiItem?.hint, lang);
  const startLabel = t("ai.start", "Start");
  const explainLabel = t("ai.mode_explain", "Explain");

  return `
    <div class="ai-tutor-mode-content ai-tutor-explain">
      <div class="ai-tutor-target">
        <span class="ai-tutor-label">${escapeHtml(explainLabel)}</span>
        <div class="ai-tutor-target-text">${escapeHtml(target || "—")}</div>
        ${hint ? `<p class="ai-tutor-hint text-sm opacity-75 mt-1">${escapeHtml(hint)}</p>` : ""}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run" data-mode="explain">
        ${escapeHtml(t("ai.start_explain", startLabel))}
      </button>
      <div class="ai-tutor-result-wrap mt-3 hidden"></div>
    </div>
  `;
}

/**
 * 渲染 Roleplay 面板
 */
export function renderRoleplayMode(aiItem, lang) {
  const scenario = str(aiItem?.scenario ?? "greeting");
  const promptText = pickLang(aiItem?.prompt, lang);
  const aiRole = t("ai.ai_role", "AI");
  const studentRole = t("ai.student_role", "Student");

  return `
    <div class="ai-tutor-mode-content ai-tutor-roleplay">
      <div class="ai-tutor-scenario">
        <span class="ai-tutor-label">${escapeHtml(t("ai.scenario", "Scenario"))}</span>
        <div class="ai-tutor-target-text">${escapeHtml(scenario)}</div>
        ${promptText ? `<p class="ai-tutor-hint text-sm opacity-75 mt-1">${escapeHtml(promptText)}</p>` : ""}
      </div>
      <div class="ai-tutor-roles text-sm opacity-75 mb-2">
        ${escapeHtml(aiRole)} / ${escapeHtml(studentRole)}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run" data-mode="roleplay">
        ${escapeHtml(t("ai.start_roleplay", "Start dialogue"))}
      </button>
      <div class="ai-tutor-result-wrap mt-3 hidden"></div>
    </div>
  `;
}

/**
 * 渲染 Shadowing 面板
 */
export function renderShadowingMode(aiItem, lang) {
  const lines = Array.isArray(aiItem?.lines) ? aiItem.lines : [];
  const linesHtml = lines.length
    ? lines.map((line, i) => `<div class="ai-tutor-line-item">${i + 1}. ${escapeHtml(line)}</div>`).join("")
    : `<div class="text-sm opacity-70">${escapeHtml(t("ai.no_tasks", "No lines configured."))}</div>`;

  return `
    <div class="ai-tutor-mode-content ai-tutor-shadowing">
      <div class="ai-tutor-lines">
        <span class="ai-tutor-label">${escapeHtml(t("ai.mode_shadowing", "Shadowing"))}</span>
        <div class="ai-tutor-lines-list mt-2">${linesHtml}</div>
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run mt-2" data-mode="shadowing">
        ${escapeHtml(t("ai.start_shadowing", "Start shadowing"))}
      </button>
      <div class="ai-tutor-result-wrap mt-3 hidden"></div>
    </div>
  `;
}

/**
 * 渲染 Free Talk 面板
 */
export function renderFreeTalkMode(aiItem, lang) {
  const placeholder = pickLang(aiItem?.placeholder, lang) || t("ai.placeholder_question", "Type your question");
  const sendLabel = t("ai.send", "Send");

  return `
    <div class="ai-tutor-mode-content ai-tutor-free_talk">
      <textarea class="ai-tutor-input w-full border rounded-lg p-3 text-sm" rows="3" placeholder="${escapeHtml(placeholder)}"></textarea>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-send mt-2" data-mode="free_talk">
        ${escapeHtml(sendLabel)}
      </button>
      <div class="ai-tutor-result-wrap mt-3 hidden"></div>
    </div>
  `;
}

/**
 * 根据 mode 渲染对应面板
 */
export function renderModeContent(mode, aiItem, lang) {
  switch (mode) {
    case "explain":
      return renderExplainMode(aiItem, lang);
    case "roleplay":
      return renderRoleplayMode(aiItem, lang);
    case "shadowing":
      return renderShadowingMode(aiItem, lang);
    case "free_talk":
      return renderFreeTalkMode(aiItem, lang);
    default:
      return `<div class="text-sm opacity-70">${escapeHtml(t("ai.no_tasks", "No tasks for this mode."))}</div>`;
  }
}
