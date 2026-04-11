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

/**
 * scenario 多语言映射（可扩展：HSK2/HSK3/Kids/Business 复用）
 * 使用 i18n ai.scenario_{key}，无匹配时回退原始 key
 */
function getScenarioLabel(scenarioKey) {
  const key = str(scenarioKey || "greeting").replace(/-/g, "_").toLowerCase();
  const i18nKey = "ai.scenario_" + key;
  return t(i18nKey, key);
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

/** Shadowing 结果区：学习模块标题，非「AI 回复」 */
function shadowingResultAreaHtml(emptyState = true) {
  const emptyText = t("ai.result_empty", "No response yet.");
  const header = t("ai.shadowing_guide_header", "연습 가이드");
  return `
    <div class="ai-tutor-result-header ai-tutor-result-header--shadowing">${escapeHtml(header)}</div>
    <div class="ai-tutor-result-content ai-tutor-result-content--shadowing ${emptyState ? "ai-tutor-result-empty" : ""}">
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
 * 渲染 Roleplay 面板（情境对话 / substitute）
 * 支持 aiItem.prompt、aiItem.sampleAnswer
 */
export function renderRoleplayMode(aiItem, lang) {
  const scenarioKey = str(aiItem && aiItem.scenario != null ? aiItem.scenario : "greeting");
  const scenarioLabel = getScenarioLabel(scenarioKey);
  const promptText = pickLang(aiItem && aiItem.prompt, lang);
  const sampleAnswer = typeof (aiItem && aiItem.sampleAnswer) === "string"
    ? aiItem.sampleAnswer
    : (aiItem && aiItem.sampleAnswer && (aiItem.sampleAnswer.cn || aiItem.sampleAnswer.zh)) || "";
  const desc = promptText || t("ai.mode_desc_roleplay", "Practice greetings and self-introduction in a real-life style.");
  const classmate = t("ai.role_classmate", "Classmate");
  const me = t("ai.role_me", "Me");

  return `
    <div class="ai-tutor-mode-content ai-tutor-roleplay">
      <p class="ai-tutor-mode-desc">${escapeHtml(desc)}</p>
      <div class="ai-tutor-role-block">
        <div class="ai-tutor-role-row">
          <span class="ai-tutor-role-label">${escapeHtml(t("ai.scenario", "Scenario"))}:</span>
          <span class="ai-tutor-role-value">${escapeHtml(scenarioLabel)}</span>
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
        ${sampleAnswer ? `<div class="ai-tutor-sample-answer mt-2"><span class="ai-tutor-label">${escapeHtml(t("ai.sample_answer", "Sample"))}:</span> <span class="ai-tutor-sample-text">${escapeHtml(sampleAnswer)}</span></div>` : ""}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run">
        ${escapeHtml(t("ai.start_roleplay", "Start dialogue"))}
      </button>
      <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
    </div>
  `;
}

/**
 * 渲染 Shadowing 面板（跟读 / repeat）
 * 支持 aiItem.lines、aiItem.sampleAnswer、对话句
 */
export function renderShadowingMode(aiItem, lang) {
  let lines = Array.isArray(aiItem && aiItem.lines) ? aiItem.lines : [];
  if (!lines.length && aiItem && aiItem.sampleAnswer) {
    const sa = typeof aiItem.sampleAnswer === "string" ? aiItem.sampleAnswer : (aiItem.sampleAnswer && (aiItem.sampleAnswer.cn || aiItem.sampleAnswer.zh)) || "";
    if (sa.trim()) lines = [sa.trim()];
  }
  const promptText = pickLang(aiItem && aiItem.prompt, lang);
  const sessionTitle = t("ai.shadowing_card_title", "따라 말하기");
  const sessionLead = t("ai.shadowing_card_lead", "문장을 듣고, 따라 읽고, 직접 말해 보세요.");
  const howTitle = t("ai.shadowing_how_title", "따라 말하기 방법");
  const stepListen = t("ai.shadowing_step_listen", "먼저 들어보세요");
  const stepRepeat = t("ai.shadowing_step_repeat", "따라 읽어보세요");
  const stepSay = t("ai.shadowing_step_say", "직접 말해보세요");
  const sentencesLabel = t("ai.shadowing_sentences_label", "연습 문장");

  const stepsHtml = `
    <div class="ai-shadowing-how-inline">
      <div class="ai-shadowing-guide-how-title">${escapeHtml(howTitle)}</div>
      <ol class="ai-shadowing-guide-steps ai-shadowing-guide-steps--inline" aria-label="${escapeHtml(howTitle)}">
        <li>${escapeHtml(stepListen)}</li>
        <li>${escapeHtml(stepRepeat)}</li>
        <li>${escapeHtml(stepSay)}</li>
      </ol>
    </div>
  `;

  const linesHtml = lines.length
    ? `<ol class="ai-tutor-lines-list ai-shadowing-preview-lines">${lines.map((line) => `<li class="ai-tutor-line-item">${escapeHtml(typeof line === "string" ? line : (line && (line.cn || line.zh || line.text)) || "")}</li>`).join("")}</ol>`
    : `<div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.mode_not_ready", "This mode is not ready yet."))}</div>`;

  return `
    <div class="ai-tutor-mode-content ai-tutor-shadowing">
      <div class="ai-shadowing-session-head">
        <h3 class="ai-shadowing-session-title">${escapeHtml(sessionTitle)}</h3>
        <p class="ai-shadowing-session-lead">${escapeHtml(sessionLead)}</p>
        ${promptText ? `<p class="ai-shadowing-extra-desc">${escapeHtml(promptText)}</p>` : ""}
      </div>
      ${stepsHtml}
      <div class="ai-tutor-lines-block mt-2">
        <span class="ai-tutor-label">${escapeHtml(sentencesLabel)}</span>
        ${linesHtml}
      </div>
      <button type="button" class="ai-btn ai-btn-primary ai-tutor-run mt-2" ${!lines.length ? "disabled" : ""}>
        ${escapeHtml(t("ai.start_shadowing", "Start shadowing"))}
      </button>
      <div class="ai-tutor-result-wrap ai-tutor-result-wrap--shadowing mt-3">${shadowingResultAreaHtml(true)}</div>
    </div>
  `;
}

/**
 * 渲染 Free Talk 面板（自由对话）
 * 支持 aiItem.prompt 作为情境说明
 */
export function renderFreeTalkMode(aiItem, lang) {
  const placeholder = pickLang(aiItem && aiItem.placeholder, lang) || t("ai.placeholder_question", "Type your question");
  const promptText = pickLang(aiItem && aiItem.prompt, lang);
  const desc = promptText || t("ai.mode_desc_free_talk", "Ask freely using the words and sentences from today's lesson.");
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
