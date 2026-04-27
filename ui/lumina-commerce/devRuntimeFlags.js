/**
 * Lumina 开发/预览态与 dev UI 开关（#teacher 救援入口、console 诊断等共用）。
 * 正式生产域默认关闭；可用 localStorage lumina_dev_ui=1 在任意环境临时开启。
 */

const LS_DEV_UI = "lumina_dev_ui";

/**
 * localhost / file / .local / Vercel 预览域等视为预览态，与生产主域区分。
 * @returns {boolean}
 */
export function isDevOrPreviewHost() {
  if (typeof location === "undefined") return false;
  if (String(location.protocol || "") === "file:") return true;
  const h = String(location.hostname || "");
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local")) return true;
  if (h.endsWith(".vercel.app") || h.endsWith(".vercel.dev")) return true;
  return false;
}

/**
 * 手动强制开启 dev UI（接管 demo、强制批准、#teacher debug 日志）。
 * @returns {boolean}
 */
export function isDevUiForceEnabled() {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(LS_DEV_UI) === "1";
  } catch {
    return false;
  }
}

/**
 * 是否应展示/打印教师模块开发态入口与诊断信息。
 * @returns {boolean}
 */
export function shouldEnableLuminaDevUi() {
  return isDevOrPreviewHost() || isDevUiForceEnabled();
}
