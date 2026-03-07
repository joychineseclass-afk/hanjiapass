/**
 * Lumina Language Pack Engine v1 - i18n 核心
 * 底层统一委托给 languageEngine，不允许页面各自手写 localStorage / fallback / JSON key 判断
 */

import * as LE from "./languageEngine.js";

export const normalizeLang = LE.normalizeLang;
export const getLang = LE.getLang;
export const setLang = LE.setLang;
export const getLanguagePack = LE.getLanguagePack;

let legacyDict = null;

/**
 * 获取文案
 * @param {string} path - "lesson.words" 或 "lesson_words"（兼容）
 * @param {object} [params] - 插值参数 { n: 3, score: 10 }
 */
export function t(path, params) {
  if (!path || typeof path !== "string") return path;
  if (legacyDict) {
    const lang = LE.getLang();
    const dictKey = lang === "zh" ? "cn" : lang === "ko" ? "kr" : lang;
    const pack = legacyDict[dictKey] || legacyDict.kr;
    const v = pack?.[path];
    if (v != null && typeof v === "string") {
      return (params && typeof params === "object") ? v.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? "")) : v;
    }
  }
  return LE.t(path, params);
}

/**
 * 初始化语言并加载语言包
 * @param {string} [lang] - kr/cn/en/jp，不传则从 localStorage 读取
 */
export async function initLang(lang) {
  return LE.init(lang);
}

/**
 * 注入旧版 DICT 作为 fallback（可选）
 */
export function setLegacyDict(dict) {
  legacyDict = dict;
}
