/**
 * 全站统一词卡显示规则
 * 释义、词性随系统语言（KR/CN/EN/JP）切换，委托 languageEngine
 * 支持 glossary 层回退：课程词条缺失时从 data/glossary/{lang}-{scope}.json 补充
 */

import { getContentText, pick } from "../core/languageEngine.js";
import { getGlossaryMeaning, getGlossaryPos } from "./glossary.js";
import { getWordImage } from "../platform/media/imageEngine.js";

/** 获取词汇图片 URL，无图时返回空字符串 */
export function getWordImageUrl(word) {
  try {
    return getWordImage?.(word) ?? "";
  } catch {
    return "";
  }
}

/** 中文词性 -> { kr, en, jp } 映射 */
export const POS_ZH_MAP = {
  代词: { kr: "대명사", ko: "대명사", en: "pronoun", jp: "代名詞" },
  动词: { kr: "동사", ko: "동사", en: "verb", jp: "動詞" },
  名词: { kr: "명사", ko: "명사", en: "noun", jp: "名詞" },
  形容词: { kr: "형용사", ko: "형용사", en: "adjective", jp: "形容詞" },
  副词: { kr: "부사", ko: "부사", en: "adverb", jp: "副詞" },
  量词: { kr: "양사", ko: "양사", en: "measure word", jp: "量詞" },
  助词: { kr: "조사", ko: "조사", en: "particle", jp: "助詞" },
  介词: { kr: "전치사", ko: "전치사", en: "preposition", jp: "前置詞" },
  连词: { kr: "접속사", ko: "접속사", en: "conjunction", jp: "接続詞" },
  叹词: { kr: "감탄사", ko: "감탄사", en: "interjection", jp: "感嘆詞" },
  数词: { kr: "수사", ko: "수사", en: "numeral", jp: "数詞" },
  拟声词: { kr: "의태어", ko: "의태어", en: "onomatopoeia", jp: "擬声語" },
  语气词: { kr: "어기사", ko: "어기사", en: "modal particle", jp: "語気詞" },
};

export const POS_ZH_TO_KR = Object.fromEntries(Object.entries(POS_ZH_MAP).map(([zh, v]) => [zh, v.kr ?? v.ko]));
export const POS_ZH_TO_EN = Object.fromEntries(Object.entries(POS_ZH_MAP).map(([zh, v]) => [zh, v.en]));
export const POS_ZH_TO_JP = Object.fromEntries(Object.entries(POS_ZH_MAP).map(([zh, v]) => [zh, v.jp]));
export const POS_EN_TO_ZH = Object.fromEntries(
  Object.entries(POS_ZH_MAP).map(([zh, v]) => [v.en?.toLowerCase?.(), zh])
);
export const POS_KR_TO_ZH = Object.fromEntries(
  Object.entries(POS_ZH_MAP).flatMap(([zh, v]) => {
    const kr = v.kr ?? v.ko;
    return kr ? [[kr, zh]] : [];
  })
);

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 常见初级表达：词库常标为「叹词/感叹词」，教学场景改为更易懂的类别（多语言与词卡语言一致）
 */
const TEACHING_PHRASE_POS = {
  你好: { zh: "问候语", cn: "问候语", kr: "인사", ko: "인사", en: "greeting", jp: "あいさつ", ja: "あいさつ" },
  您好: { zh: "问候语", cn: "问候语", kr: "인사", ko: "인사", en: "greeting", jp: "あいさつ", ja: "あいさつ" },
  谢谢: { zh: "礼貌用语", cn: "礼貌用语", kr: "예의 표현", ko: "예의 표현", en: "courtesy phrase", jp: "丁寧な表現", ja: "丁寧な表現" },
  多谢: { zh: "礼貌用语", cn: "礼貌用语", kr: "예의 표현", ko: "예의 표현", en: "courtesy phrase", jp: "丁寧な表現", ja: "丁寧な表現" },
  不客气: { zh: "礼貌用语", cn: "礼貌用语", kr: "예의 표현", ko: "예의 표현", en: "courtesy phrase", jp: "丁寧な表現", ja: "丁寧な表現" },
  没关系: { zh: "礼貌用语", cn: "礼貌用语", kr: "예의 표현", ko: "예의 표현", en: "courtesy phrase", jp: "丁寧な表現", ja: "丁寧な表現" },
  再见: { zh: "告别用语", cn: "告别用语", kr: "작별 인사", ko: "작별 인사", en: "farewell", jp: "別れのあいさつ", ja: "別れのあいさつ" },
  拜拜: { zh: "告别用语", cn: "告别用语", kr: "작별 인사", ko: "작별 인사", en: "farewell", jp: "別れのあいさつ", ja: "別れのあいさつ" },
};

/** lang 归一化为 glossary 文件用的 key（kr-hsk1, en-hsk1） */
function glossaryLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "ko" || l === "kr") return "kr";
  if (l === "en") return "en";
  if (l === "zh" || l === "cn") return "zh";
  if (l === "jp" || l === "ja") return "jp";
  return l || "en";
}

/**
 * 按系统语言取释义，委托 languageEngine.getContentText
 * JP strict lock: 当 lang=jp 时，只返回 jp 释义，绝不 fallback 到 kr/cn
 * 兼容 meaning / translation + 扁平 kr/jp/en/cn，glossary 回退
 */
export function getMeaningByLang(word, lang, fallbackHanzi = "", scope = "") {
  if (!word) return "";
  const hanzi = str(word.hanzi ?? word.word ?? word.zh ?? word.cn ?? "") || fallbackHanzi;
  const normLang = lang === "ko" ? "kr" : lang === "zh" ? "cn" : lang === "ja" ? "jp" : lang;
  const isJp = normLang === "jp";

  const fromEngine = getContentText(word, "meaning", { strict: true, lang: normLang })
    || getContentText(word, "translation", { strict: true, lang: normLang })
    || getContentText(word, "gloss", { strict: true, lang: normLang })
    || pick(word, { strict: true, lang: normLang });
  if (fromEngine) return fromEngine;

  if (scope && hanzi) {
    const g = getGlossaryMeaning(hanzi, glossaryLang(lang), scope);
    if (g) return g;
  }
  if (isJp) return "";
  const zh = str(word.zh ?? word.cn ?? (word.meaning && word.meaning.zh) ?? (word.meaning && word.meaning.cn)) || fallbackHanzi;
  return zh || fallbackHanzi;
}

/**
 * 按系统语言取词性
 * CN: pos.zh → 字符串 pos → glossary(zh-*) → 若仅有 pos.en 则反向推导中文 → 不显示（绝不回退 kr/en）
 * KR: pos.kr → pos.ko → glossary → 中文 pos 映射为韩语
 * EN: pos.en → glossary → 中文 pos 映射为英语
 * @param {object} word - 词条 { pos: { zh, kr, en }, hanzi } 或 pos: "代词"
 * @param {string} lang - "ko" | "zh" | "en"
 * @param {string} scope - 可选，如 "hsk1"，用于 glossary 回退
 */
export function getPosByLang(word, lang, scope = "") {
  if (!word) return "";
  const p = word.pos;
  const hanzi = str(word.hanzi ?? word.word ?? word.zh ?? word.cn ?? "");

  const hasPosObject =
    typeof p === "object" &&
    p != null &&
    !!(
      str(p.zh ?? p.cn) ||
      str(p.kr ?? p.ko) ||
      str(p.en ?? p.english) ||
      str(p.jp ?? p.ja)
    );
  const hasPosString = typeof p === "string" && !!str(p);
  const canUseTeachingPhraseFallback = !hasPosObject && !hasPosString;

  const phrase = TEACHING_PHRASE_POS[hanzi];
  if (canUseTeachingPhraseFallback && phrase) {
    const normLang = lang === "ko" || lang === "kr" ? "kr" : lang === "zh" || lang === "cn" ? "cn" : lang === "ja" || lang === "jp" ? "jp" : "en";
    const out =
      phrase[normLang] ||
      (normLang === "kr" ? phrase.ko || phrase.kr : "") ||
      phrase.zh ||
      phrase.en ||
      "";
    if (out) return out;
  }

  if (typeof p === "object" && p != null) {
    const normLang = lang === "ko" ? "kr" : lang === "zh" ? "cn" : lang === "ja" ? "jp" : lang;
    const fromPick = pick(p, { strict: true, lang: normLang });
    if (fromPick) return fromPick;

    const zh = str(p.zh ?? p.cn);
    const kr = str(p.ko ?? p.kr);
    const en = str(p.en ?? p.english);

    if (lang === "zh" || lang === "cn") {
      if (zh) return zh;
      if (scope && hanzi) {
        const g = getGlossaryPos(hanzi, "zh", scope);
        if (g) return g;
      }
      if (en && POS_EN_TO_ZH[en.toLowerCase()]) return POS_EN_TO_ZH[en.toLowerCase()];
      if (kr && POS_KR_TO_ZH[kr]) return POS_KR_TO_ZH[kr];
      return "";
    }
    if (lang === "ko") {
      if (kr) return kr;
      if (scope && hanzi) {
        const g = getGlossaryPos(hanzi, "kr", scope);
        if (g) return g;
      }
      if (zh && POS_ZH_MAP[zh]) return POS_ZH_MAP[zh].ko || zh;
      return "";
    }
    if (lang === "en") {
      if (en) return en;
      if (scope && hanzi) {
        const g = getGlossaryPos(hanzi, "en", scope);
        if (g) return g;
      }
      if (zh && POS_ZH_MAP[zh]) return POS_ZH_MAP[zh].en || zh;
      return "";
    }
    if (lang === "jp" || lang === "ja") {
      const jp = str(p.jp ?? p.ja);
      if (jp) return jp;
      if (scope && hanzi) {
        const g = getGlossaryPos(hanzi, "jp", scope);
        if (g) return g;
      }
      if (zh && POS_ZH_MAP[zh]) return POS_ZH_MAP[zh].jp || POS_ZH_MAP[zh].en || zh;
      return "";
    }
    return zh || kr || en;
  }

  const zhVal = str(p);
  if (lang === "zh" || lang === "cn") {
    if (zhVal) return zhVal;
    if (scope && hanzi) {
      const g = getGlossaryPos(hanzi, "zh", scope);
      if (g) return g;
    }
    return "";
  }
  if (lang === "ko" || lang === "kr") {
    if (scope && hanzi) {
      const g = getGlossaryPos(hanzi, "kr", scope);
      if (g) return g;
    }
    if (zhVal && POS_ZH_MAP[zhVal]) return POS_ZH_MAP[zhVal].kr || POS_ZH_MAP[zhVal].ko || zhVal;
    return "";
  }
  if (lang === "en") {
    if (scope && hanzi) {
      const g = getGlossaryPos(hanzi, "en", scope);
      if (g) return g;
    }
    if (zhVal && POS_ZH_MAP[zhVal]) return POS_ZH_MAP[zhVal].en || zhVal;
    return "";
  }
  if (lang === "jp" || lang === "ja") {
    if (scope && hanzi) {
      const g = getGlossaryPos(hanzi, "jp", scope);
      if (g) return g;
    }
    if (zhVal && POS_ZH_MAP[zhVal]) return POS_ZH_MAP[zhVal].jp || POS_ZH_MAP[zhVal].en || zhVal;
    return "";
  }
  return zhVal;
}
