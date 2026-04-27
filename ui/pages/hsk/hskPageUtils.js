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

/** 从对象上取第一个非空字符串值（用于缺译兜底；键名排序稳定）。 */
function firstStringValueFromObject(obj) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (typeof v === "string") {
      const t = trimStr(v);
      if (t) return t;
    }
  }
  return "";
}

/**
 * Controlled text getter
 * Rule: current UI lang → en → cn/zh → 其它已知键 → 任意非空字符串
 * JP/ja 缺译时不应出现空白或孤立 "-"。
 */
export function getControlledLangText(obj, langKey, context = "text") {
  if (!obj || typeof obj !== "object") return "";

  const key = normalizePracticeLangAliases(langKey);
  const primary =
    key === "kr" ? ["kr", "ko"] :
    key === "jp" ? ["jp", "ja"] :
    key === "cn" ? ["cn", "zh"] :
    ["en"];

  const secondary = ["en", "cn", "zh", "kr", "ko", "jp", "ja"];
  const order = [...new Set([...primary, ...secondary])];
  const tried = [];
  const primarySet = new Set(primary);

  for (const k of order) {
    tried.push(k);
    const value = trimStr(obj[k]);
    if (value) {
      if (!primarySet.has(k) && typeof console !== "undefined" && console.warn) {
        console.warn(`[HSK Language] Fallback triggered for ${context}: ${key} -> ${k}`);
      }
      return value;
    }
  }

  const any = firstStringValueFromObject(obj);
  if (any) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[HSK Language] Fallback to any field for ${context} (lang=${key})`);
    }
    return any;
  }

  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[HSK Language] No available text for ${context}; tried=${tried.join(",")}`);
  }
  return "";
}

/**
 * Strict getter with stable fallbacks — JP 缺译：jp/ja → en → cn/zh → kr/ko → 任意字符串字段
 */
export function getStrictLangText(obj, langKey) {
  if (!obj || typeof obj !== "object") return "";
  const key = normalizePracticeLangAliases(langKey);

  if (key === "kr") {
    return (
      trimStr(obj.kr) ||
      trimStr(obj.ko) ||
      trimStr(obj.en) ||
      trimStr(obj.cn) ||
      trimStr(obj.zh) ||
      trimStr(obj.jp) ||
      trimStr(obj.ja) ||
      firstStringValueFromObject(obj)
    );
  }
  if (key === "jp") {
    return (
      trimStr(obj.jp) ||
      trimStr(obj.ja) ||
      trimStr(obj.en) ||
      trimStr(obj.cn) ||
      trimStr(obj.zh) ||
      trimStr(obj.kr) ||
      trimStr(obj.ko) ||
      firstStringValueFromObject(obj)
    );
  }
  if (key === "cn") {
    return (
      trimStr(obj.cn) ||
      trimStr(obj.zh) ||
      trimStr(obj.en) ||
      trimStr(obj.kr) ||
      trimStr(obj.ko) ||
      trimStr(obj.jp) ||
      trimStr(obj.ja) ||
      firstStringValueFromObject(obj)
    );
  }
  return (
    trimStr(obj.en) ||
    trimStr(obj.cn) ||
    trimStr(obj.zh) ||
    trimStr(obj.kr) ||
    trimStr(obj.ko) ||
    trimStr(obj.jp) ||
    trimStr(obj.ja) ||
    firstStringValueFromObject(obj)
  );
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

/**
 * 练习题日志缩略（数据层与练习 tab 共用，避免 lesson 模块依赖 practice 模块）。
 */
export function abbrPracticeItemForLog(q) {
  if (!q || typeof q !== "object") return q;
  const prompt = q.prompt;
  const question = q.question;
  return {
    id: q.id,
    type: q.type,
    subtype: q.subtype,
    optionsLen: Array.isArray(q.options) ? q.options.length : null,
    optionsHead: Array.isArray(q.options)
      ? q.options.slice(0, 2).map((o) =>
          typeof o === "string" ? o.slice(0, 40) : JSON.stringify(o).slice(0, 80)
        )
      : q.options,
    prompt:
      prompt && typeof prompt === "object"
        ? Object.keys(prompt)
        : typeof prompt === "string"
          ? prompt.slice(0, 60)
          : prompt,
    question:
      question && typeof question === "object"
        ? Object.keys(question)
        : typeof question === "string"
          ? question.slice(0, 60)
          : question,
    zh_options: q.zh_options,
  };
}
