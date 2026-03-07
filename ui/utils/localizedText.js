/**
 * 全站统一：按系统语言取翻译
 * 除中文、拼音外，所有翻译/释义/说明均跟随系统语言
 * 支持 KR / CN / EN / JP
 * JP 模式 fallback 顺序：jp -> cn -> en -> kr（不得先出韩语）
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 各语言的 fallback 顺序（优先当前语言，其次按顺序兜底）
 *  JP 模式：jp -> cn -> en -> kr（不得先出韩语）
 */
const ORDER_MAP = {
  kr: ["kr", "ko", "cn", "zh", "en", "jp", "ja"],
  ko: ["kr", "ko", "cn", "zh", "en", "jp", "ja"],
  cn: ["cn", "zh", "en", "kr", "ko", "jp", "ja"],
  zh: ["cn", "zh", "en", "kr", "ko", "jp", "ja"],
  en: ["en", "cn", "zh", "kr", "ko", "jp", "ja"],
  jp: ["jp", "ja", "cn", "zh", "en", "kr", "ko"],
  ja: ["jp", "ja", "cn", "zh", "en", "kr", "ko"],
};

/**
 * 按系统语言取多语言对象中的文本
 * @param {object} item - { kr, cn, zh, en, jp, ko } 或 string
 * @param {string} lang - 当前系统语言 ko|kr|zh|cn|en|jp
 * @param {string} fallback - 无匹配时的兜底
 * @returns {string}
 */
export function getLocalizedText(item, lang, fallback = "") {
  if (!item) return fallback;
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (typeof item !== "object") return fallback;

  const l = String(lang || "").toLowerCase();
  const order = ORDER_MAP[l] || ORDER_MAP.en;
  for (const k of order) {
    const v = item[k];
    if (v != null && str(v)) return str(v);
  }
  return fallback;
}

/**
 * 将 i18n.getLang() 归一化为内容用 lang：kr|cn|en|jp
 */
export function toContentLang(uiLang) {
  const l = String(uiLang ?? "").toLowerCase();
  if (l === "kr" || l === "ko") return "kr";
  if (l === "cn" || l === "zh") return "cn";
  if (l === "jp" || l === "ja") return "jp";
  if (l === "en") return "en";
  return "kr";
}
