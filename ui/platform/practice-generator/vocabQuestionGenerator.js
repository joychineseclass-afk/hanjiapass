/**
 * Practice Generator v2 - 词义选择题
 * 来源：vocab / extension
 * 题型：vocab_meaning_choice
 */

import {
  getVocabZh,
  getVocabPinyin,
  getVocabMeaning,
  getExtensionZh,
  getExtensionPinyin,
  getExtensionMeaning,
  shuffle,
  nextId,
  parseLevelNum,
} from "./generatorUtils.js";
import { buildDistractorsForMeaningChoice, buildDistractorsForZhChoice, normalizeOptionsToObjects } from "./distractorBuilder.js";

/**
 * 从 vocab 生成词义选择题
 * 题干给中文，问意思（选项为翻译）
 */
export function generateVocabMeaningChoice(lesson, count, lang, levelNum) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const pool = shuffle(vocab).filter((w) => getVocabZh(w) && getVocabMeaning(w, lang));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const w = pool[i];
    const zh = getVocabZh(w);
    const pinyin = getVocabPinyin(w);
    const meaning = getVocabMeaning(w, lang);
    if (!zh || !meaning) continue;

    const correctOption = {
      key: zh,
      zh,
      pinyin,
      kr: lang === "ko" ? meaning : "",
      en: lang === "en" ? meaning : "",
    };

    const distractors = buildDistractorsForMeaningChoice(lesson, zh, meaning, lang, 3, levelNum);
    const allOptions = [correctOption, ...distractors];
    const options = shuffle(allOptions).slice(0, 4);

    out.push({
      id: nextId("vocab"),
      type: "choice",
      subtype: "vocab_meaning_choice",
      source: "vocab",
      question: {
        zh: `「${zh}」的意思是？`,
        kr: `「${zh}」의 뜻은?`,
        en: `What does "${zh}" mean?`,
      },
      prompt: { zh, pinyin },
      options,
      answer: zh,
      explanation: {
        zh: `「${zh}」是${meaning}。`,
        kr: `「${zh}」는 ${meaning}입니다.`,
        en: `"${zh}" means ${meaning}.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 从 extension 生成词义选择题
 */
export function generateExtensionMeaningChoice(lesson, count, lang, levelNum) {
  const ext = Array.isArray(lesson?.extension) ? lesson.extension : [];
  const pool = shuffle(ext).filter((item) => getExtensionZh(item) && getExtensionMeaning(item, lang));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const item = pool[i];
    const zh = getExtensionZh(item);
    const pinyin = getExtensionPinyin(item);
    const meaning = getExtensionMeaning(item, lang);
    if (!zh || !meaning) continue;

    const correctOption = {
      key: zh,
      zh,
      pinyin,
      kr: lang === "ko" ? meaning : "",
      en: lang === "en" ? meaning : "",
    };

    const distractors = buildDistractorsForMeaningChoice(lesson, zh, meaning, lang, 3, levelNum);
    const allOptions = [correctOption, ...distractors];
    const options = shuffle(allOptions).slice(0, 4);

    out.push({
      id: nextId("ext"),
      type: "choice",
      subtype: "vocab_meaning_choice",
      source: "extension",
      question: {
        zh: `「${zh}」的意思是？`,
        kr: `「${zh}」의 뜻은?`,
        en: `What does "${zh}" mean?`,
      },
      prompt: { zh, pinyin },
      options,
      answer: zh,
      explanation: {
        zh: `「${zh}」：${meaning}`,
        kr: `「${zh}」: ${meaning}`,
        en: `"${zh}" means ${meaning}.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 翻译找中文：题干给翻译，选项为中文
 */
export function generateTranslateToZh(lesson, count, lang) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const pool = shuffle(vocab).filter((w) => getVocabZh(w) && getVocabMeaning(w, lang));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const w = pool[i];
    const zh = getVocabZh(w);
    const meaning = getVocabMeaning(w, lang);
    if (!zh || !meaning) continue;

    const distractors = buildDistractorsForZhChoice(lesson, zh, 3);
    const options = [zh, ...distractors];
    const uniqueOpts = shuffle([...new Set(options)]).slice(0, 4);

    const optObjects = uniqueOpts.map((o, idx) => ({
      key: o,
      zh: o,
      pinyin: "",
      kr: "",
      en: "",
    }));

    out.push({
      id: nextId("vocab"),
      type: "choice",
      subtype: "vocab_meaning_choice",
      source: "vocab",
      question: {
        zh: `「${meaning}」用中文怎么说？`,
        kr: `「${meaning}」은 중국어로?`,
        en: `Which Chinese word means "${meaning}"?`,
      },
      prompt: { zh: meaning, pinyin: "" },
      options: optObjects,
      answer: zh,
      explanation: {
        zh: `「${meaning}」：${zh}`,
        kr: `「${meaning}」: ${zh}`,
        en: `"${meaning}" is ${zh}.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 按配额生成 vocab 题
 */
export function generateVocabQuestions(lesson, quota, lang) {
  const levelNum = parseLevelNum(lesson?.level ?? lesson?.courseId ?? 1);
  const out = [];
  const vocabQuota = quota?.vocab ?? 2;

  const meaningFromVocab = generateVocabMeaningChoice(lesson, vocabQuota, lang, levelNum);
  out.push(...meaningFromVocab);

  const needMore = vocabQuota - out.length;
  if (needMore > 0) {
    const transToZh = generateTranslateToZh(lesson, needMore, lang);
    out.push(...transToZh);
  }

  return out;
}
