/**
 * 平台级 AI 对话训练面板
 * 4 种训练模式 + 上下文 + prompt 预览 + 复制 + 开始练习（mock）
 * 支持 lesson.ai 数组：explain / roleplay 标准化入口
 */

import { i18n } from "../../../i18n.js";
import { buildLessonContext } from "./aiLessonContext.js";
import { buildPrompt, getModes, getModeLabel } from "./aiPromptBuilder.js";
import { getLessonAIConfig, buildPrompt as buildAIPrompt, runTutor, formatTutorResult } from "../../../modules/ai/aiEngine.js";

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
 * 渲染 AI 面板 HTML
 * @param {object} opts - { lesson, lang, containerId, onCopy, onStart }
 */
export function renderAIPanel(opts = {}) {
  const { lesson, lang = "ko", containerId = "hskAIResult" } = opts;
  const context = buildLessonContext(lesson, { lang });
  const modes = getModes();
  const currentMode = opts.mode || "follow";
  const prompt = buildPrompt(context, currentMode);
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";

  const modeLabels = modes.map((m) => {
    const label = getModeLabel(m.key, lang);
    const active = m.key === currentMode ? "bg-green-100 border-green-400" : "";
    return `<button type="button" class="ai-mode-btn px-3 py-2 rounded-xl text-sm border ${active}" data-mode="${m.key}">${escapeHtml(label)}</button>`;
  }).join("");

  const summary = buildLessonSummary(context, langKey);

  return `
    <div class="ai-panel-platform rounded-xl border border-slate-200 p-4 bg-slate-50/50">
      <div class="text-sm font-semibold text-slate-800 mb-2">${escapeHtml(context.lessonTitle || t("hsk.tab.ai"))}</div>
      <div class="text-xs text-slate-600 mb-3">${escapeHtml(summary || t("hsk.empty_dialogue"))}</div>
      <div class="flex flex-wrap gap-2 mb-3">
        ${modeLabels}
      </div>
      <div class="mb-3">
        <div class="text-xs font-semibold text-slate-500 uppercase mb-1">${escapeHtml(t("ai.prompt_preview", "Prompt preview"))}</div>
        <pre class="bg-white border rounded-lg p-3 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">${escapeHtml(prompt.slice(0, 500))}${prompt.length > 500 ? "..." : ""}</pre>
      </div>
      <div class="flex gap-2">
        <button type="button" class="ai-copy-btn px-3 py-2 rounded-xl border text-sm">${escapeHtml(t("ai.copy_lesson", "Copy"))}</button>
        <button type="button" class="ai-start-btn px-3 py-2 rounded-xl border text-sm bg-green-100">${escapeHtml(t("practice.start", "Start"))}</button>
      </div>
      <div class="ai-mock-result mt-3 hidden"></div>
    </div>
  `;
}

/** 渲染 lesson.ai 标准化卡片 */
function renderAICards(lesson, lang) {
  const items = getLessonAIConfig(lesson);
  if (!items.length) return "";

  const explainLabel = t("ai.type_explain", "解释");
  const roleplayLabel = t("ai.type_roleplay", "情景对话");

  return items.map((item) => {
    const type = item.type || "explain";
    const label = type === "explain" ? explainLabel : roleplayLabel;
    const target = item.target ?? item.scenario ?? "";
    const scenario = item.scenario ?? "";
    const btnLabel = type === "explain" && target
      ? t("ai.explain_btn", "解释") + "：" + target.slice(0, 20) + (target.length > 20 ? "…" : "")
      : type === "roleplay"
        ? t("ai.roleplay_btn", "开始") + "：" + (scenario || t("ai.roleplay_scenario", "对话练习"))
        : label;
    return `
      <div class="ai-tutor-card rounded-xl border border-slate-200 p-3 mb-2 bg-white" data-ai-type="${escapeHtml(type)}" data-target="${escapeHtml(target)}" data-scenario="${escapeHtml(scenario)}">
        <span class="ai-tutor-badge text-xs font-medium text-slate-500">${escapeHtml(label)}</span>
        <button type="button" class="ai-tutor-trigger w-full mt-2 px-3 py-2 rounded-lg border text-sm text-left hover:bg-slate-50">
          ${escapeHtml(btnLabel)}
        </button>
        <div class="ai-tutor-result-wrap mt-2 hidden"></div>
      </div>`;
  }).join("");
}

/**
 * 挂载 AI 面板并绑定事件
 * @param {HTMLElement} container
 * @param {object} opts - { lesson, lang, onCopy, onStart }
 */
export function mountAIPanel(container, opts = {}) {
  if (!container) return;
  const { lesson, lang = "ko" } = opts;
  const aiCardsHtml = renderAICards(lesson, lang);
  const mainPanelHtml = renderAIPanel({ ...opts, containerId: container.id });

  container.innerHTML = (aiCardsHtml ? `<div class="ai-tutor-cards mb-4">${aiCardsHtml}</div>` : "") + mainPanelHtml;

  const modeBtns = container.querySelectorAll(".ai-mode-btn");
  const copyBtn = container.querySelector(".ai-copy-btn");
  const startBtn = container.querySelector(".ai-start-btn");
  const mockResult = container.querySelector(".ai-mock-result");

  let currentMode = opts.mode || "follow";
  const prompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMode = btn.dataset.mode || "follow";
      modeBtns.forEach((b) => {
        b.classList.remove("bg-green-100", "border-green-400");
      });
      btn.classList.add("bg-green-100", "border-green-400");
      const newPrompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);
      const pre = container.querySelector("pre");
      if (pre) pre.textContent = newPrompt.slice(0, 500) + (newPrompt.length > 500 ? "..." : "");
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
      mockResult.innerHTML = `
        <div class="p-3 rounded-lg bg-white border border-slate-200 text-sm">
          <div class="font-semibold text-green-700 mb-2">${mockMsg}</div>
          <div class="text-slate-600">${mockMsg}</div>
        </div>
      `;
    }
    if (typeof opts.onStart === "function") opts.onStart(fullPrompt, currentMode);
  });

  // lesson.ai 卡片点击
  container.querySelectorAll(".ai-tutor-trigger").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".ai-tutor-card");
      if (!card) return;
      const type = card.dataset.aiType || "explain";
      const target = card.dataset.target || "";
      const scenario = card.dataset.scenario || "";
      const resultWrap = card.querySelector(".ai-tutor-result-wrap");
      if (!resultWrap) return;

      resultWrap.classList.remove("hidden");
      resultWrap.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(t("common_loading"))}</div>`;

      const context = buildLessonContext(lesson, { lang });
      const prompt = buildAIPrompt({ type, target, scenario, context, lang });
      const res = await runTutor({ prompt, lang, type });
      const formatted = formatTutorResult(res, lang);
      resultWrap.innerHTML = formatted.html || `<div class="text-sm opacity-70">${escapeHtml(t("ai.placeholder"))}</div>`;
    });
  });
}
