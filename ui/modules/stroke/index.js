// ui/modules/stroke/index.js
// 统一入口：导出 openStrokePlayer、resolveStrokeSvgPath、loadStrokeSvgByChar
// 为 HSK 词卡自动打开笔顺等场景提供能力

/**
 * 解析单个汉字的 stroke SVG 路径
 * @param {string} char - 汉字（取首个字符）
 * @returns {string} 例如 /data/strokes/22909.svg（好 -> 22909）
 */
export function resolveStrokeSvgPath(char) {
  const ch = String(char ?? "").trim().charAt(0);
  if (!ch) return "";
  const cp = ch.codePointAt(0);
  if (!cp) return "";
  if (typeof window !== "undefined" && window.DATA_PATHS?.strokeUrl) {
    const url = window.DATA_PATHS.strokeUrl(ch);
    return url ? url.replace(/\?.*$/, "") : "";
  }
  return `/data/strokes/${cp}.svg`;
}

/**
 * 按汉字加载 stroke SVG 文本
 * @param {string} char - 汉字
 * @param {object} opts - { bust: boolean } 可选缓存破坏
 * @returns {Promise<string>} SVG 文本
 */
export async function loadStrokeSvgByChar(char, opts = {}) {
  const url = typeof window !== "undefined" && window.DATA_PATHS?.strokeUrl
    ? window.DATA_PATHS.strokeUrl(char)
    : resolveStrokeSvgPath(char);
  if (!url) throw new Error("stroke path not found");
  const finalUrl = opts.bust ? (url.includes("?") ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`) : url;
  const res = await fetch(finalUrl, { cache: opts.bust ? "no-store" : "default" });
  if (!res.ok) throw new Error(`stroke load failed: HTTP ${res.status}`);
  return res.text();
}

/**
 * 打开 stroke 笔顺弹窗
 * @param {string} char - 汉字
 * @param {object} options - { ctx: { from, lessonId, wordId, ... } } 可选上下文
 */
export async function openStrokePlayer(char, options = {}) {
  const ch = String(char ?? "").trim().charAt(0);
  if (!ch) return;

  try {
    const { openStrokeInModal } = await import("../hsk/strokeModal.js");
    await openStrokeInModal(ch, options.ctx || {});
  } catch (e) {
    console.warn("[stroke] openStrokePlayer fallback:", e);
    const url = `/pages/stroke.html?ch=${encodeURIComponent(ch)}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
  }
}

// 导出子模块（供需要细粒度引用的场景）
export { mountStrokeSwitcher } from "./strokePlayer.main.js";
export { renderStrokePlayerTpl } from "./strokePlayer.tpl.js";
export { playAll, playOne, stop } from "./strokeDemo.js";
export { initTraceMode } from "./strokeTrace.js";
export {
  addStrokeNumbers,
  setNumberLayerVisible,
  resetTraceState,
  setProgress,
  removeNumberLayer,
  getOrCreateNumberLayer,
} from "./strokePlayer.canvas.js";
