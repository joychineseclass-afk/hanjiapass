/**
 * 자유 질문：渐进式等待文案轮换（非流式）
 */

const DEFAULT_INTERVAL_MS = 1400;
const JITTER_MS = 200;

/**
 * @param {HTMLElement} parentEl — 清空并放入等待块
 * @param {(key: string, fb?: string) => string} t — i18n.t
 * @returns {() => void} stop
 */
export function startFreeTalkLoadingHints(parentEl, t) {
  if (!parentEl) return () => {};

  const messages = [1, 2, 3, 4]
    .map((i) => str(t(`ai.free_talk_loading_step_${i}`, "")))
    .filter(Boolean);
  const list = messages.length ? messages : [str(t("ai.lesson_qa_loading", t("ai.loading", "…")))];

  parentEl.innerHTML = `
    <div class="ai-free-talk-loading-hint" role="status" aria-live="polite">
      <span class="ai-free-talk-loading-spinner" aria-hidden="true"></span>
      <span class="ai-free-talk-loading-text"></span>
    </div>`;
  const textEl = parentEl.querySelector(".ai-free-talk-loading-text");
  if (!textEl) return () => {};

  let idx = 0;
  textEl.textContent = list[0];

  const intervalMs = DEFAULT_INTERVAL_MS + Math.floor(Math.random() * (JITTER_MS * 2 + 1)) - JITTER_MS;
  const timer = setInterval(() => {
    idx = (idx + 1) % list.length;
    textEl.style.opacity = "0";
    requestAnimationFrame(() => {
      textEl.textContent = list[idx];
      textEl.style.opacity = "1";
    });
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}
