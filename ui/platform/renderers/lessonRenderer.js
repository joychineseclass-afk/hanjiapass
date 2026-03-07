/**
 * 平台级 Lesson 渲染器
 * 统一渲染 lesson 各 step，不按课程类型分叉
 */

import * as StepRenderers from "./stepRenderers.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn);
  return str(obj.en) || str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn);
}

const STEP_RENDER_MAP = {
  vocab: StepRenderers.renderVocabStep,
  dialogue: StepRenderers.renderDialogueStep,
  grammar: StepRenderers.renderGrammarStep,
  practice: StepRenderers.renderPracticeStep,
  aiPractice: StepRenderers.renderAIPracticeStep,
  review: StepRenderers.renderReviewStep,
};

/**
 * 渲染单个 step
 * @param {string} stepKey - vocab | dialogue | grammar | practice | aiPractice | review
 * @param {{ lesson, steps, lang, scope }} opts
 * @returns {string} HTML
 */
export function renderStep(stepKey, { lesson, steps, lang = "ko", scope = "" } = {}) {
  const fn = STEP_RENDER_MAP[stepKey];
  if (!fn) return `<div class="lesson-unknown-step">(未知步骤: ${stepKey})</div>`;
  return fn({ lesson, lang, scope });
}

/**
 * 渲染完整 lesson 的 tab 内容区
 * @param {{ lesson, steps, currentStepKey, lang, scope }} opts
 * @returns {{ tabBarHtml: string, panelHtml: string }}
 */
export function renderLessonTabs({ lesson, steps = [], currentStepKey = "vocab", lang = "ko", scope = "" } = {}) {
  const tabBarHtml = steps.map((s) => {
    const key = s?.key ?? "";
    const label = pickLang(s?.label, lang) || key;
    const active = key === currentStepKey;
    return `<button type="button" class="lesson-tab px-3 py-2 rounded-xl text-sm ${active ? "bg-green-100 border-green-400" : "bg-slate-100"}" data-step="${key}">${label}</button>`;
  }).join("");

  const panelHtml = renderStep(currentStepKey, { lesson, steps, lang, scope });
  return { tabBarHtml, panelHtml };
}

/**
 * 渲染 lesson 标题区
 */
export function renderLessonHeader({ lesson, lang = "ko" } = {}) {
  const title = pickLang(lesson?.title, lang);
  const summary = pickLang(lesson?.summary, lang);
  return `
    <div class="lesson-header mb-4">
      <h2 class="text-xl font-bold text-slate-800">${title || "课程"}</h2>
      ${summary ? `<p class="text-sm text-slate-600 mt-1">${summary}</p>` : ""}
    </div>`;
}
