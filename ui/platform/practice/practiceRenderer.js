/**
 * Practice Engine v1 - 渲染器
 * 支持 choice / fill / order / typing
 */

import * as PracticeEngine from "./practiceEngine.js";
import * as PracticeState from "./practiceState.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** 按 lang 取多语言文本 */
function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn);
  return str(obj.en) || str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn);
}

/**
 * 渲染选择题
 */
export function renderChoiceQuestion(q, { lang = "ko", disabled = false } = {}) {
  const questionText = typeof q.question === "object" ? pickLang(q.question, lang) : str(q.question);
  const options = Array.isArray(q.options) ? q.options : [];
  const optsHtml = options
    .map(
      (o, i) =>
        `<button type="button" class="practice-option w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-green-400 transition-colors ${disabled ? "opacity-60 cursor-default" : ""}" data-answer="${escapeHtml(String(o))}">${escapeHtml(String(o))}</button>`
    )
    .join("");
  return `
    <div class="practice-question choice" data-question-id="${escapeHtml(q.id)}">
      <div class="practice-question-text text-lg font-medium text-slate-800 mb-4">${escapeHtml(questionText)}</div>
      <div class="practice-options space-y-2">${optsHtml}</div>
    </div>`;
}

/**
 * 渲染填空题
 */
export function renderFillQuestion(q, { lang = "ko", disabled = false } = {}) {
  const questionText = typeof q.question === "object" ? pickLang(q.question, lang) : str(q.question);
  return `
    <div class="practice-question fill" data-question-id="${escapeHtml(q.id)}">
      <div class="practice-question-text text-lg font-medium text-slate-800 mb-4">${escapeHtml(questionText)}</div>
      <input type="text" class="practice-fill-input w-full px-4 py-3 border border-slate-200 rounded-xl text-lg" placeholder="" ${disabled ? "disabled" : ""} />
    </div>`;
}

/**
 * 渲染排序题（点击芯片按顺序放入答案区）
 */
export function renderOrderQuestion(q, { lang = "ko", disabled = false } = {}) {
  const questionText = typeof q.question === "object" ? pickLang(q.question, lang) : str(q.question);
  const pieces = Array.isArray(q.question) ? q.question : (Array.isArray(q.options) ? q.options : []);
  const items = pieces.length ? pieces : (typeof q.question === "string" ? [q.question] : []);
  const chipsHtml = items
    .map(
      (item, i) =>
        `<span class="practice-order-chip px-4 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-green-400" data-value="${escapeHtml(String(item))}">${escapeHtml(String(item))}</span>`
    )
    .join("");
  return `
    <div class="practice-question order" data-question-id="${escapeHtml(q.id)}">
      <div class="practice-question-text text-lg font-medium text-slate-800 mb-4">${escapeHtml(questionText || "请按正确顺序排列")}</div>
      <div class="text-sm text-slate-500 mb-2">点击词语按顺序排列：</div>
      <div class="practice-order-options flex flex-wrap gap-2 mb-2">${chipsHtml}</div>
      <div class="practice-order-answer min-h-[48px] p-3 rounded-xl border border-dashed border-slate-300 flex flex-wrap gap-2 items-center"></div>
    </div>`;
}

/**
 * 渲染输入题
 */
export function renderTypingQuestion(q, { lang = "ko", disabled = false } = {}) {
  const questionText = typeof q.question === "object" ? pickLang(q.question, lang) : str(q.question);
  return `
    <div class="practice-question typing" data-question-id="${escapeHtml(q.id)}">
      <div class="practice-question-text text-lg font-medium text-slate-800 mb-4">${escapeHtml(questionText)}</div>
      <input type="text" class="practice-typing-input w-full px-4 py-3 border border-slate-200 rounded-xl text-lg" placeholder="" ${disabled ? "disabled" : ""} />
    </div>`;
}

const RENDER_MAP = {
  choice: renderChoiceQuestion,
  fill: renderFillQuestion,
  order: renderOrderQuestion,
  typing: renderTypingQuestion,
};

/**
 * 渲染单题（按题型分发）
 */
function renderQuestion(q, opts) {
  const fn = RENDER_MAP[q.type];
  return fn ? fn(q, opts) : `<div class="text-sm opacity-70">(不支持的题型: ${q.type})</div>`;
}

/**
 * 统一入口：挂载互动练习到容器
 * @param {HTMLElement} container
 * @param {{ lesson: object, lang?: string, onComplete?: (opts) => void }} opts
 */
export function mountPractice(container, { lesson, lang = "ko", onComplete } = {}) {
  if (!container) return;

  const { questions, totalScore } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) {
    container.innerHTML = `<div class="lesson-empty text-sm opacity-70">(暂无练习)</div>`;
    return;
  }

  let submitted = false;

  function render() {
    const progress = PracticeState.getProgress();
    const q = PracticeState.getCurrentQuestion();

    if (!q) {
      submitted = false;
      if (onComplete && !container.dataset.progressRecorded) {
        container.dataset.progressRecorded = "1";
        onComplete({
          total: questions.length,
          correct: PracticeState.getCorrectCount?.() ?? 0,
          score: PracticeState.getScore(),
          lesson,
        });
      }
      container.innerHTML = `
        <div class="practice-done p-6 rounded-xl border border-green-200 bg-green-50">
          <div class="font-semibold text-green-800 mb-2">练习完成</div>
          <div class="text-sm text-green-700">得分: ${PracticeState.getScore()} / ${PracticeState.getTotalScore()}</div>
        </div>`;
      return;
    }

    submitted = false;
    const questionHtml = renderQuestion(q, { lang, disabled: false });
    const expl = q.explanation && typeof q.explanation === "object" ? pickLang(q.explanation, lang) : str(q.explanation);
    const explHtml = expl ? `<div class="practice-explanation mt-4 p-4 rounded-xl bg-slate-50 text-sm text-slate-700 hidden">${escapeHtml(expl)}</div>` : "";

    container.innerHTML = `
      <div class="practice-panel">
        <div class="practice-progress text-sm text-slate-500 mb-4">第 ${progress.current} / ${progress.total} 题 · 得分 ${PracticeState.getScore()} / ${totalScore}</div>
        ${questionHtml}
        <div class="practice-actions mt-6 flex gap-2">
          <button type="button" class="practice-submit px-4 py-2 rounded-xl border border-green-500 bg-green-500 text-white hover:bg-green-600">提交</button>
          <button type="button" class="practice-next px-4 py-2 rounded-xl border border-slate-300 hidden">下一题</button>
        </div>
        <div class="practice-feedback mt-4 hidden"></div>
        ${explHtml}
      </div>`;
  }

  /** 事件委托：在 container 上统一处理点击，避免 render 替换 DOM 后事件丢失 */
  container.addEventListener("click", (e) => {
    const submitBtn = e.target.closest(".practice-submit");
    const nextBtn = e.target.closest(".practice-next");
    const optionBtn = e.target.closest(".practice-option");

    if (submitBtn && !submitted) {
      const q = PracticeState.getCurrentQuestion();
      if (!q) return;
      const questionEl = container.querySelector(`[data-question-id="${q.id}"]`);
      let answer = null;
      if (questionEl && q.type === "choice") {
        const sel = questionEl.querySelector(".practice-option.selected");
        answer = sel ? sel.dataset.answer : null;
      }
      const { correct, score } = PracticeEngine.submitAnswer(q.id, answer);
      submitted = true;
      const feedbackEl = container.querySelector(".practice-feedback");
      const explEl = container.querySelector(".practice-explanation");
      if (feedbackEl) {
        feedbackEl.classList.remove("hidden");
        feedbackEl.className = `practice-feedback mt-4 p-4 rounded-xl ${correct ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`;
        feedbackEl.textContent = correct ? `✓ 正确！+${score} 分` : "✗ 错误";
      }
      if (explEl) explEl.classList.remove("hidden");
      submitBtn.classList.add("hidden");
      const nextEl = container.querySelector(".practice-next");
      if (nextEl) nextEl.classList.remove("hidden");
      return;
    }

    if (nextBtn) {
      PracticeState.goToNext();
      render();
      return;
    }

    if (optionBtn && !submitted) {
      const panel = container.querySelector(".practice-panel");
      if (!panel) return;
      panel.querySelectorAll(".practice-option").forEach((b) => b.classList.remove("selected", "border-green-500"));
      optionBtn.classList.add("selected", "border-green-500");
    }
  });

  render();
}

/**
 * 供 stepRenderers 使用的入口：返回 HTML 字符串（含挂载点）
 * 插入 DOM 后由 MutationObserver 自动调用 mountPractice
 */
export function renderPracticeStep({ lesson, lang = "ko" } = {}) {
  const { questions } = PracticeEngine.loadPractice(lesson);
  if (!questions.length) return `<div class="lesson-empty text-sm opacity-70">(暂无练习)</div>`;

  const mountId = "practice-mount-" + Date.now();
  if (typeof window !== "undefined") {
    window.__PRACTICE_PENDING = { lesson, lang };
    _scheduleMountCheck();
  }
  return `<div id="${mountId}" class="practice-mount-point"></div>`;
}

function _scheduleMountCheck() {
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    const el = document.querySelector(".practice-mount-point");
    const opts = window.__PRACTICE_PENDING;
    if (el && opts) {
      mountPractice(el, opts);
      window.__PRACTICE_PENDING = null;
    }
  });
}
