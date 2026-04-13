/**
 * AI Tutor 四种模式的 UI 渲染
 * 产品化收口：说明文案、结果区、空状态
 */

import { i18n } from "../../i18n.js";
import { renderLessonFocusHtml } from "./aiLessonFocus.js";
import { buildSituationDialoguePlan, renderSituationDialogueShell } from "./aiSituationDialogue.js";

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

function resultAreaHtml(emptyState = true, resultTitleKey = "ai.result_title") {
  const emptyText = t("ai.result_empty", "No response yet.");
  const titleFallback = resultTitleKey === "ai.free_question_answer_title" ? "Answer" : "AI Response";
  return `
    <div class="ai-tutor-result-header">${escapeHtml(t(resultTitleKey, titleFallback))}</div>
    <div class="ai-tutor-result-content ${emptyState ? "ai-tutor-result-empty" : ""}">
      ${emptyState ? `<span class="ai-tutor-result-placeholder">${escapeHtml(emptyText)}</span>` : ""}
    </div>
  `;
}

/** 自由提问：답변 标题左侧朗读按钮 */
function freeTalkResultAreaHtml() {
  const emptyText = t("ai.result_empty", "No response yet.");
  const titleText = t("ai.free_question_answer_title", "Answer");
  const playLbl = t("ai.free_talk_play_answer", "Listen to answer");
  return `
    <div class="ai-tutor-result-header ai-tutor-result-header--free-talk">
      <button type="button" class="ai-free-talk-answer-speak" disabled aria-label="${escapeHtml(playLbl)}" title="${escapeHtml(playLbl)}">
        <span class="ai-free-talk-answer-speak-ic" aria-hidden="true">🔊</span>
      </button>
      <span class="ai-tutor-result-title-text">${escapeHtml(titleText)}</span>
    </div>
    <div class="ai-tutor-result-content ai-tutor-result-empty">
      <span class="ai-tutor-result-placeholder">${escapeHtml(emptyText)}</span>
    </div>
  `;
}

/**
 * 渲染 Explain 面板：本课重点讲解区（固定模板，非 AI 聊天/按钮触发）
 */
export function renderExplainMode(_aiItem, lang, lesson) {
  if (!lesson) {
    return `<div class="ai-tutor-mode-content ai-tutor-explain ai-lesson-focus-empty">
      <div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.mode_not_ready", "This mode is not ready yet."))}</div>
    </div>`;
  }
  return `
    <div class="ai-tutor-mode-content ai-tutor-explain">
      ${renderLessonFocusHtml(lesson, lang)}
    </div>
  `;
}

/**
 * 渲染 Roleplay 面板（상황 대화）：固定场景卡 + 逐轮练习器（无 AI 长文回复区）
 */
export function renderRoleplayMode(aiItem, lang, lesson) {
  const plan = lesson ? buildSituationDialoguePlan(lesson, lang) : null;
  if (plan) return renderSituationDialogueShell(plan, lang);

  const scenarioKey = str(aiItem && aiItem.scenario != null ? aiItem.scenario : "greeting");
  const scenarioLabel = getScenarioLabel(scenarioKey);
  const promptText = pickLang(aiItem && aiItem.prompt, lang);
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
      </div>
      <div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.situation_no_lesson_data", "이 과의 회화 데이터가 없어 상황 대화를 준비할 수 없습니다."))}</div>
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
    ? `<ol class="ai-tutor-lines-list ai-shadowing-preview-lines" role="list">${lines.map((line) => `<li class="ai-tutor-line-item ai-shadowing-line-item">${escapeHtml(typeof line === "string" ? line : (line && (line.cn || line.zh || line.text)) || "")}</li>`).join("")}</ol>`
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
      <div class="ai-shadowing-controls-row">
        <button type="button" class="ai-btn ai-btn-primary ai-tutor-run ai-shadowing-run" ${!lines.length ? "disabled" : ""}>
          ${escapeHtml(t("ai.shadowing_btn_start", "따라 읽기 시작"))}
        </button>
        <div class="ai-shadowing-secondary-btns">
          <button type="button" class="ai-btn ai-btn-secondary ai-shadowing-replay" disabled>
            ${escapeHtml(t("ai.shadowing_replay", "이 문장 다시"))}
          </button>
          <button type="button" class="ai-btn ai-btn-secondary ai-shadowing-next" disabled>
            ${escapeHtml(t("ai.shadowing_next", "다음 문장"))}
          </button>
        </div>
      </div>
      <div class="ai-shadowing-playback-bar hidden" aria-live="polite">
        <span class="ai-shadowing-playback-status"></span>
      </div>
    </div>
  `;
}

/**
 * 渲染 Free Talk 面板（本课范围内自由问答）
 * 文案走 lang：ai.free_question_*；课程 JSON 的 placeholder 可覆盖默认占位提示
 */
export function renderFreeTalkMode(aiItem, lang) {
  const placeholder =
    str(pickLang(aiItem && aiItem.placeholder, lang)) ||
    t("ai.free_question_placeholder", 'e.g. What\'s the difference between 「你」 and 「您」?');
  const intro = t("ai.free_question_intro", "Ask about words, phrases, and dialogue from this lesson.");
  const scope = t(
    "ai.free_question_scope",
    "Answers focus on meanings, differences, usage, this lesson’s dialogue, and short examples—within this lesson."
  );
  const examplesLabel = t("ai.free_question_examples_label", "Example questions");
  const chips = [1, 2, 3, 4]
    .map((n) => {
      const label = t(`ai.free_question_example_${n}`, "");
      return `
      <button type="button" class="ai-free-talk-example-chip" data-example-index="${n}">
        ${escapeHtml(label)}
      </button>`;
    })
    .join("");

  const voiceLbl = t("ai.free_talk_voice_input", "Voice question");

  return `
    <div class="ai-tutor-mode-content ai-tutor-free_talk">
      <p class="ai-tutor-mode-desc ai-tutor-free-talk-intro">${escapeHtml(intro)}</p>
      <p class="ai-tutor-free-talk-scope">${escapeHtml(scope)}</p>
      <div class="ai-free-talk-examples" role="group" aria-label="${escapeHtml(examplesLabel)}">
        <span class="ai-free-talk-examples-label">${escapeHtml(examplesLabel)}</span>
        <div class="ai-free-talk-chips">${chips}</div>
      </div>
      <div class="ai-tutor-input-group">
        <div class="ai-free-talk-input-row">
          <button type="button" class="ai-free-talk-voice-btn" aria-label="${escapeHtml(voiceLbl)}" title="${escapeHtml(voiceLbl)}">
            <span class="ai-free-talk-voice-ic" aria-hidden="true">🎤</span>
          </button>
          <textarea class="ai-tutor-input" rows="3" placeholder="${escapeHtml(placeholder)}"></textarea>
        </div>
        <p class="ai-free-talk-voice-hint" hidden aria-live="polite"></p>
        <button type="button" class="ai-btn ai-btn-primary ai-tutor-send mt-2">
          ${escapeHtml(t("ai.free_question_submit", "Ask"))}
        </button>
      </div>
      <div class="ai-tutor-result-wrap mt-3">${freeTalkResultAreaHtml()}</div>
    </div>
  `;
}

/**
 * 根据 mode 渲染对应面板
 */
export function renderModeContent(mode, aiItem, lang, lesson) {
  switch (mode) {
    case "explain":
      return renderExplainMode(aiItem, lang, lesson);
    case "roleplay":
      return renderRoleplayMode(aiItem, lang, lesson);
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
