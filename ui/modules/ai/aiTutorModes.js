/**
 * AI Tutor 四种模式的 UI 渲染
 * 产品化收口：说明文案、结果区、空状态
 */

import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s != null ? s : "")
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
  const v = obj[key] || obj.zh || obj.cn || obj.kr || obj.jp || obj.en;
  return str(v != null ? v : "");
}

function resultAreaHtml(emptyState = true) {
  const emptyText = t("ai.result_empty", "No response yet.");
  return `
    <div class="ai-tutor-result-header">${escapeHtml(t("ai.result_title", "AI Response"))}</div>
    <div class="ai-tutor-result-content ${emptyState ? "ai-tutor-result-empty" : ""}">
      ${emptyState ? `<span class="ai-tutor-result-placeholder">${escapeHtml(emptyText)}</span>` : ""}
    </div>
  `;
}

/**
 * 渲染 Explain 面板
 */
export function renderExplainMode(aiItem, lang) {
  const target = str(aiItem && aiItem.target != null ? aiItem.target : "");
  const hint = pickLang(aiItem && aiItem.hint, lang);
  const desc = t("ai.mode_desc_explain", "Explains the key sentences and expressions in this lesson.");
  const hasContent = !!(aiItem && (aiItem.target || (aiItem.hint && pickLang(aiItem.hint, lang))));

  if (!hasContent) {
    return `<div class="ai-tutor-mode-content ai-tutor-explain">
      <p class="ai-tutor-mode-desc">${escapeHtml(desc)}</p>
      <div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.mode_not_ready", "This mode is not ready yet."))}</div>
      <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
    </div>`;
  }

  return `
    <div class="ai-tutor-mode-content ai-tutor-explain">
      <p class="ai-tutor-mode-desc">${escapeHtml(desc)}</p>
      <div class="ai-tutor-target-block">
        <span class="ai-tutor-label">${escapeHtml(t("ai.target", "Target"))}</span>
        <div class="ai-tutor-target-text">${escapeHtml(target || "—")}</div>
        ${hint ? `<p class="ai-tutor-hint">${escapeHtml(hint)}</p>` : ""}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run">
        ${escapeHtml(t("ai.start_explain", "Start explanation"))}
      </button>
      <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
    </div>
  `;
}

/**
 * 渲染 Roleplay 面板
 */
export function renderRoleplayMode(aiItem, lang) {
  const scenario = str(aiItem && aiItem.scenario != null ? aiItem.scenario : "greeting");
  const promptText = pickLang(aiItem && aiItem.prompt, lang);
  const desc = t("ai.mode_desc_roleplay", "Practice greetings and self-introduction in a real-life style.");
  const classmate = t("ai.role_classmate", "Classmate");
  const me = t("ai.role_me", "Me");

  return `
    <div class="ai-tutor-mode-content ai-tutor-roleplay">
      <p class="ai-tutor-mode-desc">${escapeHtml(desc)}</p>
      <div class="ai-tutor-role-block">
        <div class="ai-tutor-role-row">
          <span class="ai-tutor-role-label">${escapeHtml(t("ai.scenario", "Scenario"))}:</span>
          <span class="ai-tutor-role-value">${escapeHtml(scenario)}</span>
        </div>
        <div class="ai-tutor-role-row">
          <span class="ai-tutor-role-label">${escapeHtml(t("ai.ai_role", "AI"))}:</span>
          <span class="ai-tutor-role-value">${escapeHtml(classmate)}</span>
        </div>
        <div class="ai-tutor-role-row">
          <span class="ai-tutor-role-label">${escapeHtml(t("ai.student_role", "Student"))}:</span>
          <span class="ai-tutor-role-value">${escapeHtml(me)}</span>
        </div>
        ${promptText ? `<p class="ai-tutor-hint mt-2">${escapeHtml(promptText)}</p>` : ""}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run">
        ${escapeHtml(t("ai.start_roleplay", "Start dialogue"))}
      </button>
      <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
    </div>
  `;
}

/**
 * 渲染 Shadowing 面板
 */
export function renderShadowingMode(aiItem, lang) {
  const lines = Array.isArray(aiItem && aiItem.lines) ? aiItem.lines : [];
  const desc = t("ai.mode_desc_shadowing", "Repeat line by line to build speaking rhythm and confidence.");
  const step1 = t("ai.step_see", "See the sentence");
  const step2 = t("ai.step_repeat", "Repeat after");
  const step3 = t("ai.step_say", "Say it yourself");

  const stepsHtml = `
    <div class="ai-tutor-steps">
      <div class="ai-tutor-step-item"><span class="ai-tutor-step-num">1</span> ${escapeHtml(step1)}</div>
      <div class="ai-tutor-step-item"><span class="ai-tutor-step-num">2</span> ${escapeHtml(step2)}</div>
      <div class="ai-tutor-step-item"><span class="ai-tutor-step-num">3</span> ${escapeHtml(step3)}</div>
    </div>
  `;

  const linesHtml = lines.length
    ? `<div class="ai-tutor-lines-list">${lines.map((line, i) => `<div class="ai-tutor-line-item">${i + 1}. ${escapeHtml(line)}</div>`).join("")}</div>`
    : `<div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.mode_not_ready", "This mode is not ready yet."))}</div>`;

  return `
    <div class="ai-tutor-mode-content ai-tutor-shadowing">
      <p class="ai-tutor-mode-desc">${escapeHtml(desc)}</p>
      ${stepsHtml}
      <div class="ai-tutor-lines-block mt-2">
        <span class="ai-tutor-label">${escapeHtml(t("ai.mode_shadowing", "Shadowing"))}</span>
        ${linesHtml}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run mt-2" ${!lines.length ? "disabled" : ""}>
        ${escapeHtml(t("ai.start_shadowing", "Start shadowing"))}
      </button>
      <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
    </div>
  `;
}

/**
 * 渲染 Free Talk 面板
 */
export function renderFreeTalkMode(aiItem, lang) {
  const placeholder = pickLang(aiItem && aiItem.placeholder, lang) || t("ai.placeholder_question", "Type your question");
  const desc = t("ai.mode_desc_free_talk", "Ask freely using the words and sentences from today's lesson.");
  const hint = t("ai.free_talk_hint", "Ask questions about this lesson's content.");

  return `
    <div class="ai-tutor-mode-content ai-tutor-free_talk">
      <p class="ai-tutor-mode-desc">${escapeHtml(desc)}</p>
      <p class="ai-tutor-hint mb-2">${escapeHtml(hint)}</p>
      <div class="ai-tutor-input-group">
        <textarea class="ai-tutor-input" rows="3" placeholder="${escapeHtml(placeholder)}"></textarea>
        <button type="button" class="ai-btn ai-btn-primary ai-tutor-send mt-2">
          ${escapeHtml(t("ai.send", "Send"))}
        </button>
      </div>
      <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
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
      return `<div class="ai-tutor-mode-content">
        <div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.mode_not_ready", "This mode is not ready yet."))}</div>
        <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
      </div>`;
  }
}
