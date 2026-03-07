/**
 * 全站统一：按系统语言取翻译
 * 除中文、拼音外，所有翻译/释义/说明均跟随系统语言
 * 支持 KR / CN / EN / JP
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** UI 语言 → 课程 JSON 字段名 */
const LANG_TO_KEY = {
  ko: "kr",
  kr: "kr",
  zh: "cn",
  cn: "cn",
  en: "en",
  jp: "jp",
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

  const key = LANG_TO_KEY[String(lang || "").toLowerCase()] || lang;
  const order = [key, "kr", "ko", "cn", "zh", "en", "jp"];
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
