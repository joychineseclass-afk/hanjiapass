/**
 * Lumina Language Engine v1
 * 平台级统一语言底座：UI 文案 + 课程内容多语言
 * 支持 kr / cn / en / jp，可扩展 fr / es / vi / th 等
 */

import { loadLanguagePack, clearLanguagePackCache } from "./languagePack.js";

const STORAGE_KEY = "joy_lang";

/** 支持的语言 code */
export const SUPPORTED_LANGS = ["kr", "cn", "en", "jp"];

/** fallback 顺序：当前 lang -> en -> kr -> cn -> jp -> "" */
const FALLBACK_ORDER = ["en", "kr", "cn", "jp"];

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

/** 归一化语言 code：kr/cn/en/jp */
export function normalizeLang(input, fallback = "kr") {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "kr" || raw === "ko" || raw.startsWith("ko")) return "kr";
  if (raw === "cn" || raw === "zh" || raw.startsWith("zh")) return "cn";
  if (raw === "en" || raw.startsWith("en")) return "en";
  if (raw === "jp" || raw === "ja" || raw.startsWith("ja")) return "jp";
  return fallback;
}

/** 用于 loadLanguagePack 的文件名 */
function toPackLang(canon) {
  if (canon === "zh") return "cn";
  if (canon === "ko") return "kr";
  return canon;
}

let currentLang = "kr";
let languagePack = {};

/** key -> dot path 映射 */
const KEY_ALIAS = {
  hsk_empty_lessons: "hsk.empty_lessons",
  hsk_meaning_empty: "hsk.meaning_empty",
  hsk_tab_words: "hsk.tab.words",
  hsk_tab_dialogue: "hsk.tab.dialogue",
  hsk_tab_grammar: "hsk.tab.grammar",
  hsk_tab_extension: "hsk.tab.extension",
  hsk_tab_ai: "hsk.tab.ai",
  vocab_subtitle: "hsk.vocab_subtitle",
  vocab_count: "hsk.vocab_count",
  dialogue_subtitle: "hsk.dialogue_subtitle",
  grammar_subtitle: "hsk.grammar_subtitle",
  extension_subtitle: "hsk.extension_subtitle",
  extension_speak: "hsk.extension_speak",
  extension_badge: "hsk.extension_badge",
  extension_tip: "extension.tip",
  hsk_empty_dialogue: "hsk.empty_dialogue",
  hsk_empty_grammar: "hsk.empty_grammar",
  hsk_extension_empty: "hsk.extension_empty",
  hsk_review_range: "hsk.review_range",
  hsk_review_desc: "hsk.review_desc",
  hsk_review_range_format: "hsk.review_range_format",
  review_no_wrong_questions: "review.no_wrong_questions",
  review_mode: "hsk.review_mode",
  review_current_lesson: "hsk.review_this_lesson",
  review_current_level: "hsk.review_this_level",
  review_all_wrong: "hsk.review_all_wrong",
  review_start: "review.start",
  hsk_title: "hsk.title",
  hsk_level: "hsk.level",
  hsk_tip: "hsk.tip",
  hsk_directory_title: "hsk.directory_title",
  hsk_tab_words: "hsk.tab.words",
  hsk_tab_dialogue: "hsk.tab.dialogue",
  hsk_tab_grammar: "hsk.tab.grammar",
  hsk_tab_extension: "hsk.tab.extension",
  hsk_tab_practice: "hsk.tab.practice",
  hsk_tab_ai: "hsk.tab.ai",
  hsk_ai_tip: "hsk.ai_tip",
  hsk_ai_placeholder: "hsk.ai_placeholder",
  hsk_ai_send: "hsk.ai_send",
  hsk_ai_copy: "hsk.ai_copy",
  hsk_ai_empty: "hsk.ai_empty",
  practice_load_failed: "practice.load_failed",
  practice_empty: "practice.empty",
  common_loading: "common.loading",
  common_back: "common.back",
  stroke_btn_trace: "stroke.btn_trace",
  lesson_learn: "lesson.learn",
  action_learn: "action.learn",
  action_trace: "action.trace",
  action_speak: "action.speak",
  action_listen: "action.listen",
  hsk_section_practice: "hsk.section.practice",
  hsk_section_ai: "hsk.section.ai",
  hsk_desc_practice: "hsk.desc.practice",
  hsk_desc_ai: "hsk.desc.ai",
  practice_question: "practice.question",
  practice_submit: "practice.submit",
  practice_correct: "practice.correct",
  practice_incorrect: "practice.incorrect",
  practice_explanation: "practice.explanation",
};

function keyToPath(key) {
  if (!key || typeof key !== "string") return key;
  if (KEY_ALIAS[key]) return KEY_ALIAS[key];
  if (key.includes(".")) return key;
  const parts = key.split("_");
  if (parts.length < 2) return key;
  return parts.join(".");
}

function getByPath(obj, path) {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = path.split(".");
  let v = obj;
  for (const k of keys) {
    v = v?.[k];
    if (v === undefined) return undefined;
  }
  return typeof v === "string" ? v : undefined;
}

function interpolate(str, params) {
  if (!str || typeof str !== "string") return str;
  if (!params || typeof params !== "object") return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return (v === 0 || v) ? String(v) : "";
  });
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 1. getLang()
 * 优先级：localStorage -> html[data-lang] -> 默认 kr
 */
export function getLang() {
  const fromStorage = safeGet(STORAGE_KEY);
  if (fromStorage) return normalizeLang(fromStorage, "kr");
  if (typeof document !== "undefined" && document.documentElement) {
    const fromHtml = document.documentElement.getAttribute("data-lang");
    if (fromHtml) return normalizeLang(fromHtml, "kr");
  }
  return "kr";
}

/**
 * 2. setLang(lang)
 * 保存、更新 DOM、分发 joy:langChanged（统一事件名，仅此一个）
 */
export async function setLang(lang) {
  const next = normalizeLang(lang, "kr");
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[LanguageEngine] setLang ->", next);
  }
  if (next === currentLang) return currentLang;

  currentLang = next;
  safeSet(STORAGE_KEY, next);

  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("data-lang", next);
  }

  clearLanguagePackCache();
  enPackCache = null;
  const packLang = toPackLang(next);
  languagePack = await loadLanguagePack(packLang);
  if (next !== "en") getEnPack().catch(() => {});

  try {
    window.dispatchEvent(new CustomEvent("joy:langChanged", { detail: { lang: next } }));
  } catch {}

  return currentLang;
}

/** 缓存 en 包用于 fallback */
let enPackCache = null;
async function getEnPack() {
  if (enPackCache) return enPackCache;
  enPackCache = await loadLanguagePack("en").catch(() => ({}));
  return enPackCache;
}

/**
 * 3. t(key, fallback?)
 * UI 语言包：当前语言 -> en -> fallback 参数 -> key
 * @param {string} key - 如 "hsk.tab.words"
 * @param {object|string} paramsOrFallback - 插值 {n:1} 或 fallback 字符串
 * @param {string} [fallback] - 当 paramsOrFallback 为 object 时的 fallback
 */
export function t(key, paramsOrFallback, fallback) {
  if (!key || typeof key !== "string") return key;
  const params = typeof paramsOrFallback === "object" && paramsOrFallback !== null && !Array.isArray(paramsOrFallback)
    ? paramsOrFallback
    : undefined;
  const fb = params !== undefined ? fallback : paramsOrFallback;

  const path = keyToPath(key);
  let value = getByPath(languagePack, path);
  if (value === undefined && currentLang !== "en" && enPackCache) {
    value = getByPath(enPackCache, path);
  }
  if (value === undefined && typeof fb === "string") return interpolate(fb, params || {});
  if (value === undefined) return interpolate(key, params || {});
  return interpolate(String(value), params || {});
}

/** 异步 t：确保 en fallback 已加载 */
export async function tAsync(key, paramsOrFallback, fallback) {
  if (!key || typeof key !== "string") return key;
  const params = typeof paramsOrFallback === "object" && paramsOrFallback !== null && !Array.isArray(paramsOrFallback)
    ? paramsOrFallback
    : undefined;
  const fb = params !== undefined ? fallback : paramsOrFallback;

  const path = keyToPath(key);
  let value = getByPath(languagePack, path);
  if (value === undefined && currentLang !== "en") {
    const en = await getEnPack();
    value = getByPath(en, path);
  }
  if (value === undefined && typeof fb === "string") return interpolate(fb, params || {});
  if (value === undefined) return interpolate(key, params || {});
  return interpolate(String(value), params || {});
}

/**
 * 4. pick(obj, options?)
 * 从多语言对象取值
 * options.strict: true 时仅返回当前语言，不 fallback 到其他语言（课程内容用，避免混语）
 * JP strict lock: 当 lang=jp 且 strict 时，绝不 fallback 到 kr/cn/en
 * 否则顺序：当前 lang -> en -> kr -> cn -> jp -> ""
 */
export function pick(obj, options = {}) {
  if (!obj || typeof obj !== "object") return options.fallback ?? "";
  if (typeof obj === "string" || typeof obj === "number") return String(obj);

  const lang = options.lang ?? getLang();
  if (options.strict) {
    const v = obj[lang] ?? obj[lang === "kr" ? "ko" : lang === "cn" ? "zh" : lang === "jp" ? "ja" : lang];
    return (v != null && str(v)) ? str(v) : (options.fallback ?? "");
  }

  const order = [lang, ...FALLBACK_ORDER.filter((l) => l !== lang)];
  for (const l of order) {
    const v = obj[l] ?? obj[l === "kr" ? "ko" : l === "cn" ? "zh" : l === "jp" ? "ja" : l];
    if (v != null && str(v)) return str(v);
  }
  return options.fallback ?? "";
}

/**
 * 4b. getLessonDisplayTitle(lesson, lang?)
 * 统一 lesson 标题：目录页与 detail 共用
 * JP strict lock: 当 lang=jp 时，只返回 jp 字段，绝不 fallback 到 kr/cn
 * 优先 pick(lesson.title, { strict:true })
 * 兼容 lesson.title_jp / title_en / title_kr / title_cn
 */
export function getLessonDisplayTitle(lesson, lang) {
  if (!lesson) return "";
  const l = lang ?? getLang();
  const titleObj = lesson.title || lesson.name || lesson.label;
  if (typeof titleObj === "object" && titleObj !== null) {
    const v = pick(titleObj, { strict: true, lang: l });
    if (v) return v;
    if (l === "jp" || l === "ja") return "";
    return str(titleObj.cn ?? titleObj.zh ?? titleObj.en ?? titleObj.kr ?? titleObj.jp ?? "") || "";
  }
  if (typeof titleObj === "string") return str(titleObj);
  const flat = lesson["title_" + l] ?? lesson["title_" + (l === "kr" ? "ko" : l === "cn" ? "zh" : l === "jp" ? "ja" : l)];
  if (flat) return str(flat);
  if (l === "jp" || l === "ja") return str(lesson.title_jp ?? lesson.title_ja ?? "") || "";
  return str(lesson.title_cn ?? lesson.title_zh ?? lesson.title_jp ?? lesson.title_en ?? lesson.title_kr ?? "");
}

/**
 * 5. getContentText(item, field?, options?)
 * 课程内容字段：兼容 translation/meaning/explain + 旧结构
 * options: { strict: true, lang: "jp" } — JP strict lock 时绝不 fallback 到 kr/cn
 * 新结构: item.translation?.[lang], item.meaning?.[lang], item.explain?.[lang]
 * 旧结构: item.kr/jp/en/cn, item.meaningKr/meaningJp/meaningEn/meaningCn,
 *        item.explainKr/explainJp/explainEn/explainCn,
 *        item.explanation_kr/explanation_jp/explanation_en/explanation_zh
 */
export function getContentText(item, field, options = {}) {
  if (!item || typeof item !== "object") return "";

  const lang = options.lang ?? getLang();
  const useStrict = options.strict !== false;

  /** 从旧结构构建多语言对象：meaningKr->kr, explanation_kr->kr */
  function buildFromOld(it, prefix) {
    const obj = {};
    const map = { kr: ["kr", "Kr", "ko", "Ko"], cn: ["cn", "Cn", "zh", "Zh"], en: ["en", "En"], jp: ["jp", "Jp", "ja", "Ja"] };
    for (const [k, variants] of Object.entries(map)) {
      for (const v of variants) {
        const key = prefix + v;
        const val = it[key];
        if (val != null && str(val)) { obj[k] = str(val); break; }
      }
    }
    return Object.keys(obj).length ? obj : null;
  }

  const strictOpt = { strict: useStrict, lang };

  const fields = field ? [field] : ["translation", "meaning", "explain", "explanation"];

  for (const f of fields) {
    const sub = item[f];
    if (sub && typeof sub === "object") {
      const v = pick(sub, strictOpt);
      if (v) return v;
    }
    if (f === "meaning") {
      const old = buildFromOld(item, "meaning") ?? buildFromOld(item, "meaning_");
      if (old) { const v = pick(old, strictOpt); if (v) return v; }
    }
    if (f === "translation") {
      const old = buildFromOld(item, "translation") ?? buildFromOld(item, "translation_");
      if (old) { const v = pick(old, strictOpt); if (v) return v; }
    }
  }

  const explainPrefixes = ["explain", "explanation_"];
  for (const p of explainPrefixes) {
    const old = buildFromOld(item, p);
    if (old) { const v = pick(old, strictOpt); if (v) return v; }
  }

  if (field === "explain" || field === "explanation") {
    const jpVal = item.explainJp ?? item.explanationJp ?? item.explain_jp ?? item.explanation_jp;
    if (jpVal && (lang === "jp" || lang === "ja")) return str(jpVal);
  }

  return pick(item, strictOpt);
}

/** 初始化：从 storage/html 读取并加载语言包，预加载 en 用于 fallback。可选传 lang 覆盖 */
export async function init(overrideLang) {
  if (overrideLang) {
    currentLang = normalizeLang(overrideLang, "kr");
    safeSet(STORAGE_KEY, currentLang);
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.setAttribute("data-lang", currentLang);
    }
  } else {
    currentLang = getLang();
    safeSet(STORAGE_KEY, currentLang);
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.setAttribute("data-lang", currentLang);
    }
  }
  const packLang = toPackLang(currentLang);
  languagePack = await loadLanguagePack(packLang);
  if (currentLang !== "en") getEnPack().catch(() => {});
  return currentLang;
}

/** 预加载语言包（切换前可选） */
export async function loadLanguagePackFor(lang) {
  return loadLanguagePack(toPackLang(normalizeLang(lang, "kr")));
}

export function getLanguagePack() {
  return languagePack || {};
}

export const languageEngine = {
  getLang,
  setLang,
  t,
  tAsync,
  pick,
  getContentText,
  normalizeLang,
  init,
  getLanguagePack,
  SUPPORTED_LANGS,
};
