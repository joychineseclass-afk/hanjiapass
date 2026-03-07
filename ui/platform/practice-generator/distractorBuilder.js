/**
 * Practice Generator v2 - 干扰项生成
 * 优先级：同课同类 → 同课其他 → 常见混淆 → 保底
 */

import { getVocabZh, getVocabMeaning, getExtensionZh, getExtensionMeaning, getDialogueLineZh, shuffle } from "./generatorUtils.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** HSK1 常见混淆词（保底） */
const FALLBACK_DISTRACTORS = {
  zh: ["你好", "谢谢", "再见", "不客气", "对不起", "没关系", "是", "不", "好", "很", "吗"],
  meaning: ["안녕하세요", "감사합니다", "안녕히 가세요", "천만에요", "죄송합니다", "괜찮아요"],
};

/**
 * 从 vocab 收集可作干扰的释义（同课），返回 { key, zh, kr, en }
 */
function collectVocabMeanings(vocab, excludeZh) {
  const items = Array.isArray(vocab) ? vocab : [];
  return items
    .map((w) => {
      const zh = getVocabZh(w);
      if (!zh || zh === excludeZh) return null;
      const kr = getVocabMeaning(w, "ko");
      const en = getVocabMeaning(w, "en");
      if (!kr && !en) return null;
      return { key: zh, zh, kr: kr || "", en: en || "" };
    })
    .filter(Boolean);
}

/**
 * 从 extension 收集可作干扰的释义
 */
function collectExtensionMeanings(extension, excludeZh) {
  const items = Array.isArray(extension) ? extension : [];
  return items
    .map((item) => {
      const zh = getExtensionZh(item);
      if (!zh || zh === excludeZh) return null;
      const kr = getExtensionMeaning(item, "ko");
      const en = getExtensionMeaning(item, "en");
      if (!kr && !en) return null;
      return { key: zh, zh, kr: kr || "", en: en || "" };
    })
    .filter(Boolean);
}

/**
 * 从 dialogue 收集中文句
 */
function collectDialogueTexts(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const lines = cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  return lines.map((l) => getDialogueLineZh(l)).filter((t) => t && t.length >= 2);
}

/**
 * 构建词义选择题干扰项（选项为翻译）
 * @param {object} lesson
 * @param {string} correctZh - 正确答案的中文
 * @param {string} correctMeaning - 正确答案的释义（当前语言）
 * @param {string} lang - ko | zh | en
 * @param {number} count - 需要的干扰项数量
 * @param {number} levelNum - 1-9，初级避免太难
 */
export function buildDistractorsForMeaningChoice(lesson, correctZh, correctMeaning, lang, count = 3, levelNum = 1) {
  const excludePinyin = ""; // 不比较拼音
  const pool = [];

  // 1. 同课 vocab 释义（排除正确项）
  const vocabMeanings = collectVocabMeanings(lesson?.vocab ?? [], correctZh);
  pool.push(...vocabMeanings);

  // 2. 同课 extension 释义
  const extMeanings = collectExtensionMeanings(lesson?.extension ?? [], correctZh);
  pool.push(...extMeanings);

  // 3. 去重：不允许与正确答案相同
  const correctKey = str(correctMeaning).toLowerCase();
  const seen = new Set([correctKey]);
  const filtered = pool.filter((o) => {
    const text = str(lang === "ko" ? o.kr : lang === "en" ? o.en : o.zh);
    const key = text.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 4. 保底：常见混淆
  const fallback = lang === "ko"
    ? FALLBACK_DISTRACTORS.meaning
    : ["hello", "thank you", "goodbye", "you're welcome", "sorry", "it's ok"];
  for (const t of fallback) {
    if (filtered.length >= count) break;
    const key = str(t).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push({
      key: `fallback_${filtered.length}`,
      zh: "",
      kr: lang === "ko" ? t : "",
      en: lang === "en" ? t : "",
    });
  }

  return shuffle(filtered).slice(0, count);
}

/**
 * 构建中文选项干扰项（选项为中文词/句）
 * @param {object} lesson
 * @param {string} correctZh - 正确答案
 * @param {number} count
 */
export function buildDistractorsForZhChoice(lesson, correctZh, count = 3) {
  const pool = [];

  // 1. 同课 vocab
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  for (const w of vocab) {
    const zh = getVocabZh(w);
    if (zh && zh !== correctZh && zh.length <= (correctZh?.length || 0) + 2) pool.push(zh);
  }

  // 2. 同课 extension
  const ext = Array.isArray(lesson?.extension) ? lesson.extension : [];
  for (const item of ext) {
    const zh = getExtensionZh(item);
    if (zh && zh !== correctZh) pool.push(zh);
  }

  // 3. 同课 dialogue 短句
  const dialogueTexts = collectDialogueTexts(lesson);
  for (const t of dialogueTexts) {
    if (t && t !== correctZh && t.length <= 8) pool.push(t);
  }

  // 4. 去重
  const seen = new Set([str(correctZh)]);
  const filtered = pool.filter((zh) => {
    const s = str(zh);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  // 5. 保底
  for (const t of FALLBACK_DISTRACTORS.zh) {
    if (filtered.length >= count) break;
    if (seen.has(t)) continue;
    seen.add(t);
    filtered.push(t);
  }

  return shuffle(filtered).slice(0, count);
}

/**
 * 将选项转为标准格式 { key, zh, pinyin, kr, en }
 * @param {Array} options - 字符串或对象
 * @param {string} correctKey - 正确答案的 key
 * @param {object} correctOption - 正确答案的完整对象（可选）
 */
export function normalizeOptionsToObjects(options, correctKey, correctOption = null) {
  const LETTERS = ["A", "B", "C", "D"];
  const result = [];
  const used = new Set();

  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    const letter = LETTERS[i] ?? String(i + 1);
    let obj;
    if (o && typeof o === "object" && (o.key || o.zh || o.kr || o.en)) {
      obj = {
        key: str(o.key) || letter,
        zh: str(o.zh ?? o.cn ?? ""),
        pinyin: str(o.pinyin ?? o.py ?? ""),
        kr: str(o.kr ?? o.ko ?? ""),
        en: str(o.en ?? ""),
      };
    } else {
      const text = str(o);
      obj = {
        key: text || letter,
        zh: text,
        pinyin: "",
        kr: "",
        en: "",
      };
    }
    if (!obj.key) obj.key = letter;
    if (used.has(obj.key) && obj.key !== correctKey) continue;
    used.add(obj.key);
    result.push(obj);
  }
  return result;
}
