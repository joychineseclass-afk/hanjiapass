/**
 * AI Tutor 四种模式的 UI 渲染
 * 产品化收口：说明文案、结果区、空状态
 */

import { i18n } from "../../i18n.js";
import { renderLessonFocusHtml } from "./aiLessonFocus.js";
import { buildSituationDialoguePlan, renderSituationDialogueShell } from "./aiSituationDialogue.js";
import { buildShadowingPracticeData } from "./aiShadowingPracticeData.js";
import { pickFreeAskExampleList, pickLessonLang } from "./aiLearningShared.js";

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
 * 渲染 Shadowing 面板：口语训练（单词 / 表达 / 句子，条状 + 话筒为主）
 */
export function renderShadowingMode(_aiItem, lang, lesson) {
  const sessionTitle = t("ai.shadowing_speaking_title", "말하기 연습");
  const sessionLead = t(
    "ai.shadowing_speaking_lead",
    "한 줄씩 듣고 따라 말해 보세요. 마이크를 눌러 말하면 간단한 피드백과 점수를 드려요.",
  );

  const data = lesson ? buildShadowingPracticeData(lesson, lang, t) : { words: [], sentences: [] };
  const total = data.words.length + data.sentences.length;

  function trainRowHtml(item) {
    const zh = String(item?.zh != null ? item.zh : "").trim();
    const safeAttr = escapeHtml(zh);
    const id = String(item?.id != null ? item.id : "").trim();
    const typ = String(item?.type != null ? item.type : "").trim();
    const py = String(item?.pinyin != null ? item.pinyin : "").trim();
    const mean = String(item?.meaning != null ? item.meaning : "").trim();
    let rowParts = `<span class="ai-shadowing-train-z">${escapeHtml(zh)}</span>`;
    if (py) {
      rowParts += `<span class="ai-shadowing-train-slash" aria-hidden="true"> / </span><span class="ai-shadowing-train-p">${escapeHtml(py)}</span>`;
    }
    if (mean) {
      rowParts += `<span class="ai-shadowing-train-slash" aria-hidden="true"> / </span><span class="ai-shadowing-train-m">${escapeHtml(mean)}</span>`;
    }
    return `<li class="ai-tutor-line-item ai-shadowing-line-item ai-shadowing-train-item"${id ? ` id="${escapeHtml(id)}"` : ""} data-item-type="${escapeHtml(typ)}" data-shadow-zh="${safeAttr}">
      <div class="ai-shadowing-train-cols">
        <div class="ai-shadowing-train-text">
          <div class="ai-shadowing-train-rowline">${rowParts}</div>
        </div>
        <div class="ai-shadowing-train-side">
          <button type="button" class="ai-btn ai-shadowing-train-listen" title="${escapeHtml(t("ai.shadowing_train_listen_hint", "听示范（仅中文）"))}" aria-label="${escapeHtml(t("ai.shadowing_train_listen_hint", "听示范"))}">🔊</button>
          <button type="button" class="ai-btn ai-btn-primary ai-shadowing-train-mic" title="${escapeHtml(t("ai.shadowing_speak_mic", "点击录音，再说一次结束"))}" aria-label="${escapeHtml(t("ai.shadowing_speak_mic", "开口说"))}">🎤</button>
        </div>
      </div>
      <div class="ai-shadowing-train-status" hidden aria-live="polite"></div>
      <div class="ai-shadowing-train-feedback" hidden aria-live="polite"></div>
    </li>`;
  }

  function sectionBlock(sectionTitle, items) {
    if (!items.length) return "";
    return `<section class="ai-shadowing-section" aria-label="${escapeHtml(sectionTitle)}">
      <h4 class="ai-shadowing-section-title">${escapeHtml(sectionTitle)}</h4>
      <ul class="ai-shadowing-train-list" role="list">${items.map(trainRowHtml).join("")}</ul>
    </section>`;
  }

  const secWords = t("ai.shadowing_section_words_speak", "단어 말하기");
  const secSent = t("ai.shadowing_section_sent_speak", "문장 말하기");

  const bodyHtml = total
    ? `${sectionBlock(secWords, data.words)}${sectionBlock(secSent, data.sentences)}`
    : `<div class="ai-tutor-mode-not-ready ai-shadowing-empty">${escapeHtml(t("ai.shadowing_no_content", "本课暂无可跟读内容。请先确认教材对话与词汇已加载。"))}</div>`;

  return `
    <div class="ai-tutor-mode-content ai-tutor-shadowing ai-tutor-shadowing--speaking">
      <div class="ai-shadowing-session-head">
        <h3 class="ai-shadowing-session-title">${escapeHtml(sessionTitle)}</h3>
        <p class="ai-shadowing-session-lead">${escapeHtml(sessionLead)}</p>
      </div>
      <div class="ai-shadowing-practice-body mt-2">
        ${bodyHtml}
      </div>
    </div>
  `;
}

/**
 * 渲染 Free Talk 面板（本课范围内自由问答）
 * 文案走 lang：ai.free_question_*；课程 JSON 的 placeholder 可覆盖默认占位提示
 */
export function renderFreeTalkMode(aiItem, lang) {
  const phObj = aiItem?.freeAskPlaceholder;
  const placeholder =
    (phObj && typeof phObj === "object" ? pickLessonLang(phObj, lang) : "") ||
    str(pickLang(aiItem && aiItem.placeholder, lang)) ||
    t("ai.free_question_placeholder", 'e.g. What\'s the difference between 「你」 and 「您」?');
  const intro = t("ai.free_question_intro", "Ask about words, phrases, and dialogue from this lesson.");
  const scope = t(
    "ai.free_question_scope",
    "Answers focus on meanings, differences, usage, this lesson’s dialogue, and short examples—within this lesson."
  );
  const examplesLabel = t("ai.free_question_examples_label", "Example questions");
  const exampleList = pickFreeAskExampleList(aiItem?.freeAskExamples, lang);
  const chipCount = exampleList.length > 0 ? Math.min(8, exampleList.length) : 4;
  const chips = Array.from({ length: chipCount }, (_, i) => i + 1)
    .map((n) => {
      const label = str(exampleList[n - 1]) || t(`ai.free_question_example_${n}`, "");
      return `
      <button type="button" class="ai-free-talk-example-chip" data-example-index="${n}" data-example-text="${escapeHtml(label)}">
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
      return renderShadowingMode(aiItem, lang, lesson);
    case "free_talk":
      return renderFreeTalkMode(aiItem, lang);
    default:
      return `<div class="ai-tutor-mode-content">
        <div class="ai-tutor-mode-not-ready">${escapeHtml(t("ai.mode_not_ready", "This mode is not ready yet."))}</div>
        <div class="ai-tutor-result-wrap mt-3">${resultAreaHtml(true)}</div>
      </div>`;
  }
}
