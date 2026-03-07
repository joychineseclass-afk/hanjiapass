/**
 * Practice Generator v2 - 扩展表达题 + 语序重组题
 * 来源：extension / dialogue / grammar
 * 题型：vocab_meaning_choice, sentence_order_choice
 */

import {
  getExtensionZh,
  getExtensionPinyin,
  getExtensionMeaning,
  getDialogueLineZh,
  shuffle,
  nextId,
  parseLevelNum,
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
 * 扩展表达词义选择
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
 * 语序重组题（choice 形式）：给乱序词块，选正确句子
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
    const options = [t, ...shuffle(wrongArr).slice(0, 3)];
    const shuffledOpts = shuffle(options).slice(0, 4);

    const optObjects = shuffledOpts.map((o) => ({
      key: o,
      zh: o,
      pinyin: "",
      kr: "",
      en: "",
    }));

    out.push({
      id: nextId("order"),
      type: "choice",
      subtype: "sentence_order_choice",
      source: "dialogueCards",
      question: {
        zh: `词语：${pieces.join(" / ")}。请选择正确的排列。`,
        kr: `단어: ${pieces.join(" / ")}. 올바른 순서를 고르세요.`,
        en: `Words: ${pieces.join(" / ")}. Choose the correct order.`,
      },
      prompt: { zh: pieces.join(" / "), pinyin: "" },
      options: optObjects,
      answer: t,
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
