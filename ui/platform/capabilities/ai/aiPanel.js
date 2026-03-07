/**
 * 平台级 AI 对话训练面板
 * 4 种训练模式 + 上下文 + prompt 预览 + 复制 + 开始练习（mock）
 */

import { buildLessonContext } from "./aiLessonContext.js";
import { buildPrompt, getModes, getModeLabel } from "./aiPromptBuilder.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  const modeLabels = modes.map((m) => {
    const label = getModeLabel(m.key, lang);
    const active = m.key === currentMode ? "bg-green-100 border-green-400" : "";
    return `<button type="button" class="ai-mode-btn px-3 py-2 rounded-xl text-sm border ${active}" data-mode="${m.key}">${escapeHtml(label)}</button>`;
  }).join("");

  const summary = [
    context.vocab?.length ? `词汇 ${context.vocab.length} 个` : "",
    context.dialogue?.length ? `对话 ${context.dialogue.length} 句` : "",
    context.grammar?.length ? `语法 ${context.grammar.length} 点` : "",
  ].filter(Boolean).join(" · ");

  return `
    <div class="ai-panel-platform rounded-xl border border-slate-200 p-4 bg-slate-50/50">
      <div class="text-sm font-semibold text-slate-800 mb-2">${escapeHtml(context.lessonTitle || "本课")}</div>
      <div class="text-xs text-slate-600 mb-3">${escapeHtml(summary || "(暂无内容)")}</div>
      <div class="flex flex-wrap gap-2 mb-3">
        ${modeLabels}
      </div>
      <div class="mb-3">
        <div class="text-xs font-semibold text-slate-500 uppercase mb-1">Prompt 预览</div>
        <pre class="bg-white border rounded-lg p-3 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">${escapeHtml(prompt.slice(0, 500))}${prompt.length > 500 ? "..." : ""}</pre>
      </div>
      <div class="flex gap-2">
        <button type="button" class="ai-copy-btn px-3 py-2 rounded-xl border text-sm">复制训练内容</button>
        <button type="button" class="ai-start-btn px-3 py-2 rounded-xl border text-sm bg-green-100">开始练习</button>
      </div>
      <div class="ai-mock-result mt-3 hidden"></div>
    </div>
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
  container.innerHTML = renderAIPanel({ ...opts, containerId: container.id });

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

  copyBtn?.addEventListener("click", async () => {
    const fullPrompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);
    try {
      await navigator.clipboard.writeText(fullPrompt);
      copyBtn.textContent = "已复制";
      setTimeout(() => { copyBtn.textContent = "复制训练内容"; }, 1500);
    } catch (e) {
      console.warn("[aiPanel] copy failed:", e);
    }
    if (typeof opts.onCopy === "function") opts.onCopy(fullPrompt);
  });

  startBtn?.addEventListener("click", () => {
    const fullPrompt = buildPrompt(buildLessonContext(lesson, { lang }), currentMode);
    if (mockResult) {
      mockResult.classList.remove("hidden");
      mockResult.innerHTML = `
        <div class="p-3 rounded-lg bg-white border border-slate-200 text-sm">
          <div class="font-semibold text-green-700 mb-2">AI 对话功能接口预留完成。</div>
          <div class="text-slate-600">当前为本地 mock 模式。</div>
          <div class="text-xs mt-2 opacity-75">Prompt 已生成，可点击「复制训练内容」后接入真实 API。</div>
        </div>
      `;
    }
    if (typeof opts.onStart === "function") opts.onStart(fullPrompt, currentMode);
  });
}
