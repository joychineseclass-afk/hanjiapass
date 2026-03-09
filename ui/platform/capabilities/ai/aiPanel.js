/**
 * 平台级 AI 对话训练面板
 * 4 卡片布局：Ask AI / Explain / Roleplay / Practice
 * 支持 lesson.ai 数组：explain / roleplay 标准化入口
 */

import { i18n } from "../../../i18n.js";
import { buildLessonContext } from "./aiLessonContext.js";
import { buildPrompt, getModes, getModeLabel } from "./aiPromptBuilder.js";
import { getLessonAIConfig, runTutor, formatTutorResult } from "../../../modules/ai/aiEngine.js";

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

/** 从多语言对象中按 lang 取值 */
function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "kr").toLowerCase();
  const key = l === "zh" || l === "cn" ? "cn" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  return str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.jp ?? obj.en ?? "");
}

/** 多语言 lesson summary：語彙 10語・会話 10文・文法 2項目 */
function buildLessonSummary(context, lang) {
  const parts = [];
  const sep = lang === "jp" ? "・" : " · ";
  if (context.vocab?.length) {
    const w = t("lesson.summary.words", "語彙");
    const u = lang === "jp" ? "語" : lang === "kr" ? "개" : lang === "cn" ? "个" : "";
    parts.push(u ? `${w} ${context.vocab.length}${u}` : `${context.vocab.length} ${w}`);
  }
  if (context.dialogue?.length) {
    const d = t("lesson.summary.dialogues", "会話");
    const u = lang === "jp" ? "文" : lang === "kr" ? "문" : lang === "cn" ? "句" : "";
    parts.push(u ? `${d} ${context.dialogue.length}${u}` : `${context.dialogue.length} ${d}`);
  }
  if (context.grammar?.length) {
    const g = t("lesson.summary.grammar_points", "文法");
    const u = lang === "jp" ? "項目" : lang === "kr" ? "개" : lang === "cn" ? "点" : "";
    parts.push(u ? `${g} ${context.grammar.length}${u}` : `${context.grammar.length} ${g}`);
  }
  return parts.join(sep);
}

/**
 * 渲染 AI 面板 HTML（4 卡片布局）
 * @param {object} opts - { lesson, lang, containerId, onCopy, onStart }
 */
export function renderAIPanel(opts = {}) {
  const { lesson, lang = "ko", containerId = "hskAIResult" } = opts;
  const context = buildLessonContext(lesson, { lang });
  const modes = getModes();
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";

  const items = getLessonAIConfig(lesson);
  const firstExplain = items.find((i) => i.type === "explain");
  const firstRoleplay = items.find((i) => i.type === "roleplay");

  const targetSentence = firstExplain ? str(firstExplain.target ?? "") : "";
  const scenarioGreeting = firstRoleplay ? (str(firstRoleplay.scenario ?? "") || pickLang(firstRoleplay.prompt, lang) || "greeting") : "greeting";

  const summary = buildLessonSummary(context, langKey);
  const vocabCount = context.vocab?.length ?? 0;
  const dialogueCount = context.dialogue?.length ?? 0;
  const grammarCount = context.grammar?.length ?? 0;

  const followLabel = getModeLabel("follow", lang);
  const roleplayLabel = getModeLabel("roleplay", lang);
  const freeLabel = getModeLabel("free", lang);

  const askTitle = t("ai.ask");
  const explainTitle = t("ai.explain");
  const roleplayTitle = t("ai.roleplay");
  const practiceTitle = t("ai.practice");

  const sendLabel = t("ai.send", "Send");
  const copyLabel = t("ai.copy_lesson", "Copy lesson content");
  const startExplainLabel = t("ai.start_explain", "Start explanation");
  const startRoleplayLabel = t("ai.start_roleplay", "Start practice");

  const placeholder = t("hsk.ai_placeholder", "e.g. What's the difference between 你好 and 您好?");

  return `
<section class="ai-learning">
  <div class="ai-card ai-ask">
    <div class="ai-card__title">${escapeHtml(askTitle)}</div>
    <textarea id="hskAIInput" class="ai-textarea" rows="4" placeholder="${escapeHtml(placeholder)}"></textarea>
    <div class="ai-card__actions">
      <button type="button" id="hskAISend" class="ai-btn ai-btn-primary">${escapeHtml(sendLabel)}</button>
      <button type="button" id="hskAICopyContext" class="ai-btn">${escapeHtml(copyLabel)}</button>
    </div>
    <div id="hskAIResponse" class="ai-response"></div>
  </div>

  <div class="ai-card ai-explain">
    <div class="ai-card__title">${escapeHtml(explainTitle)}</div>
    <div class="ai-card__target">${escapeHtml(targetSentence || "—")}</div>
    <button type="button" class="ai-btn ai-btn-primary ai-tutor-trigger" data-ai-index="${firstExplain ? items.indexOf(firstExplain) : -1}" data-ai-type="explain">${escapeHtml(startExplainLabel)}</button>
    <div class="ai-tutor-result-wrap mt-2 hidden"></div>
  </div>

  <div class="ai-card ai-roleplay">
    <div class="ai-card__title">${escapeHtml(roleplayTitle)}</div>
    <div class="ai-card__scenario">${escapeHtml(scenarioGreeting)}</div>
    <button type="button" class="ai-btn ai-btn-primary ai-tutor-trigger" data-ai-index="${firstRoleplay ? items.indexOf(firstRoleplay) : -1}" data-ai-type="roleplay">${escapeHtml(startRoleplayLabel)}</button>
    <div class="ai-tutor-result-wrap mt-2 hidden"></div>
  </div>

  <div class="ai-card ai-practice">
    <div class="ai-card__title">${escapeHtml(practiceTitle)}</div>
    <div class="ai-card__summary">${escapeHtml(summary || t("hsk.empty_dialogue"))}</div>
    <div class="ai-card__mode-btns">
      ${modes.map((m) => `<button type="button" class="ai-mode-btn ai-btn" data-mode="${m.key}">${escapeHtml(getModeLabel(m.key, lang))}</button>`).join("")}
    </div>
    <div class="ai-card__actions">
      <button type="button" class="ai-copy-btn ai-btn">${escapeHtml(copyLabel)}</button>
      <button type="button" class="ai-start-btn ai-btn ai-btn-primary">${escapeHtml(t("practice.start", "Start"))}</button>
    </div>
    <div class="ai-mock-result mt-2 hidden"></div>
  </div>
</section>
  `;
}

/**
 * 挂载 AI 面板并绑定事件
 * @param {HTMLElement} container
 * @param {object} opts - { lesson, lang, onCopy, onStart }
 */
export function mountAIPanel(container, opts = {}) {
  if (!container) return;
  const { lesson, lang = "ko" } = opts;
  const items = getLessonAIConfig(lesson);

  container.innerHTML = renderAIPanel({ ...opts, containerId: container.id });

  let currentMode = opts.mode || "follow";
  const prompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);

  const modeBtns = container.querySelectorAll(".ai-mode-btn");
  const copyBtn = container.querySelector(".ai-copy-btn");
  const startBtn = container.querySelector(".ai-start-btn");
  const mockResult = container.querySelector(".ai-mock-result");

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMode = btn.dataset.mode || "follow";
      modeBtns.forEach((b) => b.classList.remove("ai-btn-active"));
      btn.classList.add("ai-btn-active");
    });
  });

  const copyLabel = (i18n && i18n.t) ? i18n.t("ai.copy_lesson", "Copy") : "Copy";
  const copiedLabel = (i18n && i18n.t) ? i18n.t("common.ok", "Copied") : "Copied";

  copyBtn?.addEventListener("click", async () => {
    const fullPrompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);
    try {
      await navigator.clipboard.writeText(fullPrompt);
      copyBtn.textContent = copiedLabel;
      setTimeout(() => { copyBtn.textContent = copyLabel; }, 1500);
    } catch (e) {
      console.warn("[aiPanel] copy failed:", e);
    }
    if (typeof opts.onCopy === "function") opts.onCopy(fullPrompt);
  });

  startBtn?.addEventListener("click", () => {
    const fullPrompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);
    if (mockResult) {
      mockResult.classList.remove("hidden");
      const mockMsg = (i18n && i18n.t) ? i18n.t("ai.prompt_preview", "AI mock mode ready.") : "AI mock mode ready.";
      mockResult.innerHTML = `<div class="p-3 rounded-lg bg-white border border-slate-200 text-sm">${escapeHtml(mockMsg)}</div>`;
    }
    if (typeof opts.onStart === "function") opts.onStart(fullPrompt, currentMode);
  });

  container.querySelectorAll(".ai-tutor-trigger").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = parseInt(btn.dataset.aiIndex, 10);
      if (index < 0) return;
      const aiItem = Array.isArray(lesson?.ai) ? lesson.ai[index] : null;
      if (!aiItem) return;
      const card = btn.closest(".ai-card");
      const resultWrap = card?.querySelector(".ai-tutor-result-wrap");
      if (!resultWrap) return;

      resultWrap.classList.remove("hidden");
      resultWrap.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(t("ai.loading", t("common.loading", "加载中...")))}</div>`;

      const res = await runTutor(aiItem, lesson, lang);
      const formatted = formatTutorResult(res, lang);
      resultWrap.innerHTML = formatted.html || `<div class="text-sm opacity-70">${escapeHtml(t("ai.placeholder", "AI 功能即将上线"))}</div>`;
    });
  });
}
