/**
 * Practice Generator v2 - A 类：词义识别类
 * 使用 practiceTemplates 规范题干，避免「哪个是谢谢」等不自然表达
 */

import {
  getVocabZh,
  getVocabPinyin,
  getVocabMeaning,
  getVocabMeaningObj,
  shuffle,
  nextId,
  parseLevelNum,
  buildOptionsWithLetterKeys,
} from "./generatorUtils.js";
import { buildDistractorsForMeaningChoice, buildDistractorsForZhChoice } from "./distractorBuilder.js";
import { buildPrompt as buildStem } from "../../modules/practice/practiceTemplates.js";

/**
 * A1. vocab_meaning_choice
 * 题干给中文，选项给当前系统语言意思（不混中文）
 */
export function generateVocabMeaningChoice(lesson, count, lang, levelNum) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const pool = shuffle(vocab).filter((w) => getVocabZh(w) && getVocabMeaning(w, lang));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const w = pool[i];
    const zh = getVocabZh(w);
    const pinyin = getVocabPinyin(w);
    const meaningObj = getVocabMeaningObj(w);
    const meaning = getVocabMeaning(w, lang);
    if (!zh || !meaning) continue;

    const correctOption = { zh, pinyin, kr: meaningObj.kr, en: meaningObj.en };
    const distractors = buildDistractorsForMeaningChoice(lesson, zh, meaning, lang, 3, levelNum);
    const allContents = [correctOption, ...distractors.map((d) => ({ zh: d.zh, pinyin: "", kr: d.kr, en: d.en }))];
    const { options, answer } = buildOptionsWithLetterKeys(allContents, zh);

    const question = buildStem("ZH_TO_MEANING", { zh });
    out.push({
      id: nextId("vocab"),
      type: "choice",
      subtype: "vocab_meaning_choice",
      source: "vocab",
      question,
      prompt: { zh, pinyin },
      options,
      answer,
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
 * A2. meaning_to_vocab_choice
 * 题干给 KR/EN/CN 意思，选项给中文
 */
export function generateMeaningToVocabChoice(lesson, count, lang) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const pool = shuffle(vocab).filter((w) => getVocabZh(w) && getVocabMeaning(w, lang));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const w = pool[i];
    const zh = getVocabZh(w);
    const meaning = getVocabMeaning(w, lang);
    if (!zh || !meaning) continue;

    const distractors = buildDistractorsForZhChoice(lesson, zh, 3);
    const zhOptions = [zh, ...distractors];
    const uniqueZh = shuffle([...new Set(zhOptions)]).slice(0, 4);
    const contents = uniqueZh.map((z) => ({ zh: z, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, zh);

    const questionByLang = buildStem("NATIVE_TO_ZH", { native: meaning });

    out.push({
      id: nextId("vocab"),
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      source: "vocab",
      question: questionByLang,
      prompt: { zh: meaning, pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `「${meaning}」：${zh}`,
        kr: `「${meaning}」: ${zh}`,
        en: `"${meaning}" is ${zh} in Chinese.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * A3. pinyin_to_vocab_choice
 * 题干给拼音，选项给中文（HSK1~3）
 */
export function generatePinyinToVocabChoice(lesson, count, lang) {
  const vocab = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const pool = shuffle(vocab).filter((w) => getVocabZh(w) && getVocabPinyin(w));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const w = pool[i];
    const zh = getVocabZh(w);
    const pinyin = getVocabPinyin(w);
    if (!zh || !pinyin) continue;

    const distractors = buildDistractorsForZhChoice(lesson, zh, 3);
    const zhOptions = [zh, ...distractors];
    const uniqueZh = shuffle([...new Set(zhOptions)]).slice(0, 4);
    const contents = uniqueZh.map((z) => ({ zh: z, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, zh);

    const question = buildStem("PINYIN_TO_ZH", { pinyin });
    out.push({
      id: nextId("vocab"),
      type: "choice",
      subtype: "pinyin_to_vocab_choice",
      source: "vocab",
      question,
      prompt: { zh: pinyin, pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `「${pinyin}」：${zh}`,
        kr: `「${pinyin}」: ${zh}`,
        en: `"${pinyin}" is ${zh}.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * 按配额生成 vocab 题（HSK1/2: A1 + A2）
 */
export function generateVocabQuestions(lesson, quota, lang) {
  const levelNum = parseLevelNum(lesson?.level ?? lesson?.courseId ?? 1);
  const out = [];
  const vocabQuota = quota?.vocab ?? 2;

  const a1 = generateVocabMeaningChoice(lesson, Math.ceil(vocabQuota / 2), lang, levelNum);
  out.push(...a1);

  const needMore = vocabQuota - out.length;
  if (needMore > 0) {
    const a2 = generateMeaningToVocabChoice(lesson, needMore, lang);
    out.push(...a2);
  }

  if (levelNum <= 3 && out.length < vocabQuota) {
    const a3 = generatePinyinToVocabChoice(lesson, 1, lang);
    out.push(...a3);
  }

  return out.slice(0, vocabQuota);
}
