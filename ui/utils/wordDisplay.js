/**
 * 全站统一词卡显示规则
 * 释义、词性随系统语言（KR/CN/EN）切换，可复用到全站词卡
 * 支持 glossary 层回退：课程词条缺失时从 data/glossary/{lang}-{scope}.json 补充
 *
 * getMeaningByLang(word, lang, fallbackHanzi?, scope?)
 * getPosByLang(word, lang, scope?)
 */

import { getGlossaryMeaning, getGlossaryPos } from "./glossary.js";

/** 中文词性 -> { ko, en } 映射，用于仅有中文词性时的显示 */
export const POS_ZH_MAP = {
  代词: { ko: "대명사", en: "pronoun" },
  动词: { ko: "동사", en: "verb" },
  名词: { ko: "명사", en: "noun" },
  形容词: { ko: "형용사", en: "adjective" },
  副词: { ko: "부사", en: "adverb" },
  量词: { ko: "양사", en: "measure word" },
  助词: { ko: "조사", en: "particle" },
  介词: { ko: "전치사", en: "preposition" },
  连词: { ko: "접속사", en: "conjunction" },
  叹词: { ko: "감탄사", en: "interjection" },
  数词: { ko: "수사", en: "numeral" },
  拟声词: { ko: "의태어", en: "onomatopoeia" },
  语气词: { ko: "어기사", en: "modal particle" },
};

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** lang 归一化为 glossary 文件用的 key（kr-hsk1, en-hsk1） */
function glossaryLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "ko" || l === "kr") return "kr";
  if (l === "en") return "en";
  if (l === "zh" || l === "cn") return "zh";
  return l || "en";
}

/**
 * 按系统语言取释义
 * KR: meaning.kr → meaning.ko → glossary → word.kr → word.ko → zh（不回退英文）
 * EN: meaning.en → glossary → word.en → zh
 * CN: meaning.zh → word.zh → glossary(如以后有)
 * @param {object} word - 词条 { meaning: { zh, kr, en }, hanzi } 或兼容 zh/kr/en 在顶层
 * @param {string} lang - "ko" | "zh" | "en"
 * @param {string} fallbackHanzi - 无释义时的 fallback（如汉字本身）
 * @param {string} scope - 可选，如 "hsk1"，用于 glossary 回退
 */
export function getMeaningByLang(word, lang, fallbackHanzi = "", scope = "") {
  if (!word) return "";
  const m = word.meaning;
  const obj = typeof m === "object" ? m : {};
  const zh = str(word.zh ?? word.cn ?? obj.zh ?? obj.cn) || fallbackHanzi;
  const hanzi = str(word.hanzi ?? word.word ?? word.zh ?? word.cn ?? "") || fallbackHanzi;

  if (lang === "ko") {
    const kr = str(obj.kr ?? obj.ko ?? word.kr ?? word.ko);
    if (kr) return kr;
    if (scope) {
      const g = getGlossaryMeaning(hanzi, glossaryLang(lang), scope);
      if (g) return g;
    }
    return zh;
  }
  if (lang === "en") {
    const en = str(word.en ?? obj.en ?? obj.english);
    if (en) return en;
    if (scope) {
      const g = getGlossaryMeaning(hanzi, glossaryLang(lang), scope);
      if (g) return g;
    }
    return zh;
  }
  // zh / cn
  if (zh) return zh;
  if (scope) {
    const g = getGlossaryMeaning(hanzi, "zh", scope);
    if (g) return g;
  }
  return str(word.kr ?? word.ko ?? word.en) || fallbackHanzi;
}

/**
 * 按系统语言取词性
 * KR: pos.kr → pos.ko → glossary → 中文 pos 映射为韩语
 * EN: pos.en → glossary → 中文 pos 映射为英语
 * CN: pos.zh → 字符串 pos 直接显示
 * @param {object} word - 词条 { pos: { zh, kr, en }, hanzi } 或 pos: "代词"
 * @param {string} lang - "ko" | "zh" | "en"
 * @param {string} scope - 可选，如 "hsk1"，用于 glossary 回退
 */
export function getPosByLang(word, lang, scope = "") {
  if (!word) return "";
  const p = word.pos;
  const hanzi = str(word.hanzi ?? word.word ?? word.zh ?? word.cn ?? "");

  if (typeof p === "object" && p != null) {
    const zh = str(p.zh ?? p.cn);
    const kr = str(p.ko ?? p.kr);
    const en = str(p.en ?? p.english);
    if (lang === "ko") {
      if (kr) return kr;
      if (scope && hanzi) {
        const g = getGlossaryPos(hanzi, glossaryLang(lang), scope);
        if (g) return g;
      }
      return zh || en;
    }
    if (lang === "en") {
      if (en) return en;
      if (scope && hanzi) {
        const g = getGlossaryPos(hanzi, glossaryLang(lang), scope);
        if (g) return g;
      }
      return zh || kr;
    }
    return zh || kr || en;
  }

  const zhVal = str(p);
  if (lang === "ko") {
    if (scope && hanzi) {
      const g = getGlossaryPos(hanzi, glossaryLang(lang), scope);
      if (g) return g;
    }
    if (zhVal && POS_ZH_MAP[zhVal]) return POS_ZH_MAP[zhVal].ko || zhVal;
    return zhVal;
  }
  if (lang === "en") {
    if (scope && hanzi) {
      const g = getGlossaryPos(hanzi, glossaryLang(lang), scope);
      if (g) return g;
    }
    if (zhVal && POS_ZH_MAP[zhVal]) return POS_ZH_MAP[zhVal].en || zhVal;
    return zhVal;
  }
  return zhVal;
}
