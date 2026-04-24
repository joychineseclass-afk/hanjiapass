// /ui/pages/hsk/hskPageUtils.js
// HSK Page - shared lightweight helpers (split from page.hsk.js Step 1).
// NOTE: Only pure helpers. No DOM access, no state.* reads.
//       Large business logic must NOT live here.

/** HTML escape for safe inline interpolation. */
export function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Trim a value only if it's a non-empty string; otherwise empty string. */
export function trimStr(v) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Stringify maybe-object values (used by light logging / fallback render). */
export function stringifyMaybe(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Practice / display language-key aliases (kr/jp/cn/en). */
export function normalizePracticeLangAliases(langKey) {
  const k = String(langKey || "").toLowerCase();
  if (k === "ko") return "kr";
  if (k === "ja") return "jp";
  if (k === "zh") return "cn";
  return k || "kr";
}

/** Practice-side language key derived from UI lang. */
export function practiceLangKeyFromUiLang(lang) {
  const l = String(lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "en") return "en";
  if (l === "jp" || l === "ja") return "jp";
  return "kr";
}

/**
 * Controlled text getter
 * Rule: current UI lang -> English -> Chinese
 * Never jump randomly into unrelated languages.
 */
export function getControlledLangText(obj, langKey, context = "text") {
  if (!obj || typeof obj !== "object") return "";

  const key = normalizePracticeLangAliases(langKey);
  const primary =
    key === "kr" ? ["kr", "ko"] :
    key === "jp" ? ["jp", "ja"] :
    key === "cn" ? ["cn", "zh"] :
    ["en"];

  const order = [...primary, "en", "cn", "zh"];
  const tried = [];

  for (const k of order) {
    tried.push(k);
    const value = trimStr(obj[k]);
    if (value) {
      if (!primary.includes(k) && typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Fallback triggered for ${context}: ${key} -> ${k}`);
      }
      return value;
    }
  }

  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No available text for ${context}; tried=${tried.join(",")}`);
  }
  return "";
}

/**
 * Strict direct getter — current language family only. No fallback.
 */
export function getStrictLangText(obj, langKey) {
  if (!obj || typeof obj !== "object") return "";
  const key = normalizePracticeLangAliases(langKey);

  if (key === "kr") return trimStr(obj.kr) || trimStr(obj.ko) || "";
  if (key === "jp") return trimStr(obj.jp) || trimStr(obj.ja) || "";
  if (key === "cn") return trimStr(obj.cn) || trimStr(obj.zh) || "";
  return trimStr(obj.en) || "";
}

/**
 * Short meaning detector — only for compact option text (not sentence
 * translation). Heuristic: short-ish, no explanation punctuation, ≤ 2 commas.
 */
export function isShortMeaning(text) {
  const t = trimStr(text);
  if (!t) return false;
  if (t.length > 40) return false;
  if (/；|;|：/.test(t)) return false;
  if (/(例如|用法|同义词|反义词|词性)/.test(t)) return false;
  if (((t.match(/,/g) || []).length) > 2) return false;
  return true;
}

/** Safe getter with warning (used for light assertions). */
export function safeGetTextWithFallback(text, context = "text") {
  const out = trimStr(text);
  if (out) return out;
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Safety] Missing ${context}`);
  }
  return "";
}

/** Legacy safety helpers retained for compatibility. */
export function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}
export function safeObject(obj) {
  return obj && typeof obj === "object" ? obj : {};
}
export function safeString(v) {
  return typeof v === "string" ? v : "";
}
