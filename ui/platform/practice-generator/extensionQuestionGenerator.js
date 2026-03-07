/**
 * Practice Generator v2 - D 类语序/句型 + E 类扩展表达
 * D1 sentence_order_choice：给乱序词，选正确句子
 * D2 sentence_completion_choice：给半句，选能构成正确句子的后半句
 * E1 extension_meaning_choice：扩展表达词义识别
 * E2 extension_usage_choice：判断扩展表达适合的场景（HSK2+）
 */

import {
  getExtensionZh,
  getExtensionPinyin,
  getExtensionMeaning,
  getExtensionMeaningObj,
  getDialogueLineZh,
  shuffle,
  nextId,
  parseLevelNum,
  buildOptionsWithLetterKeys,
} from "./generatorUtils.js";
import { buildDistractorsForMeaningChoice, buildDistractorsForZhChoice } from "./distractorBuilder.js";

function getDialogueLines(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  if (cards.length) return cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  const d = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const first = d[0];
  if (first?.lines) return d.flatMap((c) => c.lines || []);
  return d;
}

function splitSentence(s) {
  const t = String(s ?? "").trim();
  if (!t || t.length < 2) return [];
  if (t.length <= 3) return [t.slice(0, 1), t.slice(1)].filter(Boolean);
  if (t.length <= 5) return [t.slice(0, 2), t.slice(2)].filter(Boolean);
  const parts = [];
  let i = 0;
  while (i < t.length) {
    const chunk = t.slice(i, i + 2);
    if (chunk) parts.push(chunk);
    i += 2;
  }
  return parts.length >= 2 ? parts : [t];
}

/**
 * D1. sentence_order_choice
 * 下面哪一句顺序正确？选项为完整句子
 */
export function generateSentenceOrderChoice(lesson, count, lang) {
  const lines = getDialogueLines(lesson);
  const texts = lines.map((l) => getDialogueLineZh(l)).filter((t) => t && t.length >= 3);
  if (!texts.length) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const t = texts[i % texts.length];
    if (!t || used.has(t)) continue;

    const pieces = splitSentence(t);
    if (pieces.length < 2) continue;
    used.add(t);

    const wrongOrders = new Set();
    wrongOrders.add(t);
    for (let j = 0; j < 5; j++) {
      const shuffled = shuffle([...pieces]);
      const joined = shuffled.join("");
      if (joined !== t) wrongOrders.add(joined);
    }
    const wrongArr = [...wrongOrders].filter((o) => o !== t);
    const optionTexts = [t, ...shuffle(wrongArr).slice(0, 3)];
    const contents = shuffle(optionTexts).slice(0, 4).map((o) => ({ zh: o, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, t);

    out.push({
      id: nextId("order"),
      type: "choice",
      subtype: "sentence_order_choice",
      source: "dialogueCards",
      question: {
        zh: `下面哪一句顺序正确？`,
        kr: `올바른 순서의 문장은?`,
        en: `Which sentence has the correct word order?`,
      },
      prompt: { zh: pieces.join(" / "), pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `正确答案：${t}`,
        kr: `정답: ${t}`,
        en: `Correct answer: ${t}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * D2. sentence_completion_choice
 * 给半句，选能构成正确句子的后半句
 */
export function generateSentenceCompletionChoice(lesson, count, lang) {
  const lines = getDialogueLines(lesson);
  const texts = lines.map((l) => getDialogueLineZh(l)).filter((t) => t && t.length >= 4);
  if (!texts.length) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const t = texts[i % texts.length];
    if (!t || used.has(t)) continue;

    const mid = Math.floor(t.length / 2);
    const firstHalf = t.slice(0, mid);
    const secondHalf = t.slice(mid);
    if (!firstHalf || !secondHalf) continue;
    used.add(t);

    const others = texts.filter((x) => x !== t).map((x) => x.slice(Math.floor(x.length / 2)));
    const optionTexts = [secondHalf, ...shuffle(others).slice(0, 3)];
    const uniqueOpts = shuffle([...new Set(optionTexts)]).slice(0, 4);
    const contents = uniqueOpts.map((o) => ({ zh: o, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, secondHalf);

    out.push({
      id: nextId("completion"),
      type: "choice",
      subtype: "sentence_completion_choice",
      source: "dialogueCards",
      question: {
        zh: `下列哪一句能正确完成「${firstHalf}……」？`,
        kr: `「${firstHalf}……」를 올바르게 완성하는 것은?`,
        en: `Which completes "${firstHalf}..." correctly?`,
      },
      prompt: { zh: firstHalf + "……", pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `完整句子：${t}`,
        kr: `완전한 문장: ${t}`,
        en: `Complete sentence: ${t}.`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * E1. extension_meaning_choice
 * 「便宜一点吧」的意思是？
 */
export function generateExtensionMeaningChoice(lesson, count, lang, levelNum) {
  const ext = Array.isArray(lesson?.extension) ? lesson.extension : [];
  const pool = shuffle(ext).filter((item) => getExtensionZh(item) && getExtensionMeaning(item, lang));
  const out = [];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const item = pool[i];
    const zh = getExtensionZh(item);
    const pinyin = getExtensionPinyin(item);
    const meaningObj = getExtensionMeaningObj(item);
    const meaning = getExtensionMeaning(item, lang);
    if (!zh || !meaning) continue;

    const correctOption = { zh, pinyin, kr: meaningObj.kr, en: meaningObj.en };
    const distractors = buildDistractorsForMeaningChoice(lesson, zh, meaning, lang, 3, levelNum);
    const allContents = [correctOption, ...distractors.map((d) => ({ zh: d.zh, pinyin: "", kr: d.kr, en: d.en }))];
    const { options, answer } = buildOptionsWithLetterKeys(allContents, zh);

    out.push({
      id: nextId("ext"),
      type: "choice",
      subtype: "extension_meaning_choice",
      source: "extension",
      question: {
        zh: `「${zh}」的意思是？`,
        kr: `「${zh}」의 뜻은?`,
        en: `What does "${zh}" mean?`,
      },
      prompt: { zh, pinyin },
      options,
      answer,
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
