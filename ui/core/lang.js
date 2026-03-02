// /ui/core/lang.js
// ✅ Single Source of Truth for language in Joy Chinese

const LS_KEY = "joy_lang"; // 统一只用这个 key

export function normalizeLang(input) {
  const L = String(input || "").trim().toLowerCase();
  if (!L) return "ko";

  if (L === "kr") return "ko";
  if (L === "cn") return "zh";
  if (L === "zh-cn") return "zh";
  if (L === "zh-tw") return "zh";
  if (L.startsWith("zh")) return "zh";
  if (L.startsWith("ko")) return "ko";
  if (L.startsWith("en")) return "en";

  // fallback
  return "ko";
}

export function getLang() {
  // 统一读取顺序：window → localStorage → 默认
  const w =
    window.APP_LANG ||
    window.JOY_LANG ||
    window.siteLang ||
    window.lang;

  const ls =
    localStorage.getItem(LS_KEY) ||
    localStorage.getItem("site_lang") || // 兼容旧的
    localStorage.getItem("lang");

  return normalizeLang(w || ls || "ko");
}

export function setLang(next) {
  const lang = normalizeLang(next);

  // 统一写入
  localStorage.setItem(LS_KEY, lang);

  // 兼容旧字段（可保留一段时间，后续再删）
  localStorage.setItem("site_lang", lang);

  // 给全局一个规范值（让旧代码也能用）
  window.APP_LANG = lang;
  window.JOY_LANG = lang;

  // 统一事件：全站监听这一种即可
  window.dispatchEvent(new CustomEvent("joy:lang", { detail: { lang } }));
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
  window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang } }));

  return lang;
}
