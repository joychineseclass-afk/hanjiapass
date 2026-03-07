/**
 * Lumina Language Pack Engine v1 - i18n 核心
 * 使用 /lang/{kr,cn,en,jp}.json，支持 t("lesson.words") 与 t("lesson_words") 兼容
 */

import { loadLanguagePack } from "./languagePack.js";

const STORAGE_KEY = "joy_lang";

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

/** ko/zh/en/kr/cn/jp 归一化 */
function normalizeLang(input, fallback = "kr") {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "kr" || raw === "ko" || raw.startsWith("ko")) return "kr";
  if (raw === "cn" || raw === "zh" || raw.startsWith("zh")) return "cn";
  if (raw === "en" || raw.startsWith("en")) return "en";
  if (raw === "jp" || raw === "ja" || raw.startsWith("ja")) return "jp";
  return fallback;
}

/** 用于 loadLanguagePack 的 lang 键 */
function toPackLang(canon) {
  return canon === "zh" ? "cn" : canon === "ko" ? "kr" : canon;
}

/** 插值 {n} {score} 等 */
function interpolate(str, params) {
  if (!str || typeof str !== "string") return str;
  if (!params || typeof params !== "object") return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return (v === 0 || v) ? String(v) : "";
  });
}

/** 将 key 转为 dot path：nav_home -> nav.home, hsk_meta_completed -> hsk.meta.completed */
function keyToPath(key) {
  if (!key || typeof key !== "string") return key;
  if (key.includes(".")) return key;
  const parts = key.split("_");
  if (parts.length < 2) return key;
  return parts.join(".");
}

/** 按 path 从 pack 取值 */
function getByPath(pack, path) {
  if (!pack || typeof pack !== "object") return undefined;
  const keys = path.split(".");
  let v = pack;
  for (const k of keys) {
    v = v?.[k];
    if (v === undefined) return undefined;
  }
  return typeof v === "string" ? v : (v && typeof v === "object" && !Array.isArray(v) ? undefined : v);
}

let currentLang = "kr";
let languagePack = {};
let legacyDict = null;

/**
 * 初始化语言并加载语言包
 * @param {string} [lang] - kr/cn/en/jp，不传则从 localStorage 读取
 */
export async function initLang(lang) {
  const next = normalizeLang(lang ?? safeGet(STORAGE_KEY) ?? "kr", "kr");
  currentLang = next;
  safeSet(STORAGE_KEY, next);
  const packLang = toPackLang(next);
  languagePack = await loadLanguagePack(packLang);
  return currentLang;
}

/**
 * 获取当前语言
 */
export function getLang() {
  return normalizeLang(currentLang, "kr");
}

/**
 * 设置语言并重新加载语言包
 */
export async function setLang(lang) {
  const next = normalizeLang(lang, "kr");
  if (next === currentLang) return currentLang;
  currentLang = next;
  safeSet(STORAGE_KEY, next);
  const packLang = toPackLang(next);
  languagePack = await loadLanguagePack(packLang);
  return currentLang;
}

/**
 * 获取文案
 * @param {string} path - "lesson.words" 或 "lesson_words"（兼容）
 * @param {object} [params] - 插值参数 { n: 3, score: 10 }
 */
export function t(path, params) {
  if (!path || typeof path !== "string") return path;

  const dotPath = keyToPath(path);
  let value = getByPath(languagePack, dotPath);

  if (value === undefined && legacyDict) {
    const dictKey = currentLang === "zh" ? "cn" : currentLang === "ko" ? "kr" : currentLang;
    const pack = legacyDict[dictKey] || legacyDict.kr;
    value = pack?.[path];
  }

  if (value === undefined) return path;
  return interpolate(String(value), params);
}

/**
 * 注入旧版 DICT 作为 fallback（可选）
 */
export function setLegacyDict(dict) {
  legacyDict = dict;
}

/**
 * 获取当前语言包（调试用）
 */
export function getLanguagePack() {
  return languagePack;
}
