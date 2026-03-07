/**
 * 平台级 Step 渲染器
 * 统一接收标准 lesson 数据，不按课程类型分叉
 */

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
 * 渲染 vocab step
 * @param {{ lesson: object, lang: string, scope?: string }} opts
 * @returns {string} HTML
 */
export function renderVocabStep({ lesson, lang = "ko", scope = "" } = {}) {
  const words = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  if (!words.length) return `<div class="lesson-empty text-sm opacity-70">(暂无词汇)</div>`;

  const useRenderer = typeof window.HSK_RENDER?.renderWordCards === "function";
  if (useRenderer) {
    const grid = document.createElement("div");
    grid.className = "word-grid-wrap";
    window.HSK_RENDER.renderWordCards(grid, words, undefined, { lang, scope });
    return grid.innerHTML;
  }

  const blocks = words.map((w) => {
    const han = str(w.hanzi);
    const py = str(w.pinyin);
    const mean = pickLang(w.meaning, lang) || pickLang(w, lang);
    return `<div class="word-item p-3 rounded-lg border border-slate-200">${escapeHtml(han)} ${py ? `(${escapeHtml(py)})` : ""} — ${escapeHtml(mean)}</div>`;
  });
  return `<div class="vocab-list space-y-2">${blocks.join("")}</div>`;
}

/**
 * 渲染 dialogue step
 */
export function renderDialogueStep({ lesson, lang = "ko" } = {}) {
  const lines = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  if (!lines.length) return `<div class="lesson-empty text-sm opacity-70">(暂无对话)</div>`;

  const blocks = lines.map((line) => {
    const spk = str(line.speaker);
    const zh = str(line.zh);
    const py = str(line.pinyin);
    const trans = pickLang({ zh: line.zh, kr: line.kr, en: line.en }, lang);
    if (zh === trans) return "";
    return `
      <article class="dialogue-line rounded-xl border border-slate-200 p-4 mb-3">
        ${spk ? `<div class="text-xs font-semibold text-slate-500 uppercase mb-2">${escapeHtml(spk)}</div>` : ""}
        <div class="text-lg font-semibold text-slate-800">${escapeHtml(zh)}</div>
        ${py ? `<div class="text-sm italic text-slate-600 mt-1">${escapeHtml(py)}</div>` : ""}
        ${trans && trans !== zh ? `<div class="text-sm text-slate-600 mt-2">${escapeHtml(trans)}</div>` : ""}
      </article>`;
  }).filter(Boolean);
  return `<div class="dialogue-list">${blocks.join("") || "(暂无翻译)"}</div>`;
}

/**
 * 渲染 grammar step
 */
export function renderGrammarStep({ lesson, lang = "ko" } = {}) {
  const items = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  if (!items.length) return `<div class="lesson-empty text-sm opacity-70">(暂无语法)</div>`;

  const blocks = items.map((g, i) => {
    const title = pickLang(g.title, lang) || `#${i + 1}`;
    const expl = pickLang(g.explanation, lang);
    const ex = g.example && typeof g.example === "object" ? pickLang(g.example, lang) : "";
    return `
      <article class="grammar-item border border-slate-200 rounded-xl p-5 mb-4">
        <div class="font-bold text-slate-800 mb-1">${i + 1}. ${escapeHtml(title)}</div>
        ${expl ? `<div class="text-sm text-slate-700 mb-3">${escapeHtml(expl)}</div>` : ""}
        ${ex ? `<div class="text-sm bg-slate-50 rounded-lg p-3 mt-2">${escapeHtml(ex)}</div>` : ""}
      </article>`;
  });
  return `<div class="grammar-list">${blocks.join("")}</div>`;
}

/**
 * 渲染 practice step
 */
export function renderPracticeStep({ lesson, lang = "ko" } = {}) {
  const items = Array.isArray(lesson?.practice) ? lesson.practice : [];
  if (!items.length) return `<div class="lesson-empty text-sm opacity-70">(暂无练习)</div>`;

  const blocks = items.map((p, i) => {
    const q = typeof p.question === "object" ? pickLang(p.question, lang) : str(p.question);
    const opts = Array.isArray(p.options) ? p.options : [];
    const optsHtml = opts.length ? `<ul class="list-disc ml-4 mt-2">${opts.map((o) => `<li>${escapeHtml(String(o))}</li>`).join("")}</ul>` : "";
    return `
      <div class="practice-item p-4 rounded-xl border border-slate-200 mb-3">
        <div class="font-medium text-slate-800">${i + 1}. ${escapeHtml(q)}</div>
        ${optsHtml}
        ${p.answer ? `<div class="text-sm text-green-600 mt-2">✓ ${escapeHtml(str(p.answer))}</div>` : ""}
      </div>`;
  });
  return `<div class="practice-list">${blocks.join("")}</div>`;
}

/**
 * 渲染 aiPractice step（占位）
 */
export function renderAIPracticeStep({ lesson, lang = "ko" } = {}) {
  const ai = lesson?.aiPractice;
  const prompt = ai?.prompt && typeof ai.prompt === "object" ? pickLang(ai.prompt, lang) : str(ai?.chatPrompt ?? ai?.prompt ?? "");
  const speaking = Array.isArray(ai?.speaking) ? ai.speaking : [];
  return `
    <div class="ai-practice-placeholder p-4 rounded-xl border border-slate-200 bg-slate-50">
      <div class="text-sm text-slate-700 mb-2">${escapeHtml(prompt || "(AI 练习占位)")}</div>
      ${speaking.length ? `<div class="text-xs text-slate-500">建议短语: ${speaking.map((s) => escapeHtml(s)).join(", ")}</div>` : ""}
      <div class="mt-3 text-xs opacity-70">AI 功能接入中…</div>
    </div>`;
}

/**
 * 渲染 review step
 */
export function renderReviewStep({ lesson, lang = "ko" } = {}) {
  const review = lesson?.review;
  const range = Array.isArray(review?.lessonRange) ? review.lessonRange : [];
  const [from, to] = range;
  const rangeText = from != null && to != null ? `第 ${from}–${to} 课` : "";
  const focus = review?.focusAreas ? (typeof review.focusAreas === "string" ? review.focusAreas : Array.isArray(review.focusAreas) ? review.focusAreas.join(", ") : "") : "";
  return `
    <div class="review-step p-4 rounded-xl border border-slate-200 bg-slate-50">
      <div class="font-semibold text-slate-800 mb-2">${escapeHtml(rangeText || "复习")}</div>
      ${focus ? `<div class="text-sm text-slate-600">${escapeHtml(focus)}</div>` : ""}
      <div class="text-sm opacity-70 mt-2">请回顾前面学过的词汇和对话。</div>
    </div>`;
}
