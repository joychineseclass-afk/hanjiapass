/**
 * 全站统一词卡显示规则
 * 释义、词性随系统语言（KR/CN/EN）切换，可复用到全站词卡
 *
 * getMeaningByLang(word, lang)
 * getPosByLang(word, lang)
 */

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

/**
 * 按系统语言取释义
 * KR 模式读取顺序：meaning.kr → meaning.ko → word.kr → word.ko → zh（不回退英文）
 * CN 模式：meaning.zh 优先，缺失回退 kr/en
 * EN 模式：meaning.en 优先，缺失回退 zh/kr
 * @param {object} word - 词条 { meaning: { zh, kr, en } } 或兼容 zh/kr/en 在顶层
 * @param {string} lang - "ko" | "zh" | "en"
 * @param {string} fallbackHanzi - 无释义时的 fallback（如汉字本身）
 */
export function getMeaningByLang(word, lang, fallbackHanzi = "") {
  if (!word) return "";
  const m = word.meaning;
  const obj = typeof m === "object" ? m : {};
  const zh = str(word.zh ?? word.cn ?? obj.zh ?? obj.cn) || fallbackHanzi;
  const kr = str(obj.kr ?? obj.ko ?? word.kr ?? word.ko);
  const en = str(word.en ?? obj.en ?? obj.english);

  if (lang === "ko") return kr || zh;
  if (lang === "en") return en || zh || kr;
  return zh || kr || en;
}

/**
 * 按系统语言取词性
 * 支持 pos 为对象 { zh, kr, en } 或字符串（中文词性，自动映射）
 * @param {object} word - 词条 { pos: { zh, kr, en } } 或 pos: "代词"
 * @param {string} lang - "ko" | "zh" | "en"
 */
export function getPosByLang(word, lang) {
  if (!word) return "";
  const p = word.pos;
  if (p == null) return "";

  if (typeof p === "object") {
    const zh = str(p.zh ?? p.cn);
    const kr = str(p.ko ?? p.kr);
    const en = str(p.en ?? p.english);
    if (lang === "ko") return kr || zh || en;
    if (lang === "en") return en || zh || kr;
    return zh || kr || en;
  }

  const zhVal = str(p);
  if (!zhVal) return "";
  const mapped = POS_ZH_MAP[zhVal];
  if (mapped) {
    if (lang === "ko") return mapped.ko || zhVal;
    if (lang === "en") return mapped.en || zhVal;
  }
  return zhVal;
}
