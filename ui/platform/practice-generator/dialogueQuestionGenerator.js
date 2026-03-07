/**
 * Practice Generator v2 - B 类：对话理解类
 * B1 dialogue_response_choice：根据一句对话，选最合适的回答
 * B2 dialogue_meaning_choice：给短句对话，选正确意思
 * B3 dialogue_detail_choice：根据对话内容回答细节问题
 */

import { getDialogueLineZh, getDialogueLineMeaning, shuffle, nextId, buildOptionsWithLetterKeys } from "./generatorUtils.js";
import { buildDistractorsForZhChoice } from "./distractorBuilder.js";

function getDialogueLines(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  if (cards.length) return cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  const d = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const first = d[0];
  if (first?.lines) return d.flatMap((c) => c.lines || []);
  return d;
}

/**
 * B1. dialogue_response_choice
 * 题干：A 说了 X，下列哪一句最适合回答？
 */
export function generateDialogueResponseChoice(lesson, count, lang) {
  const lines = getDialogueLines(lesson);
  if (lines.length < 2) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const idx = (i * 2) % Math.max(1, lines.length - 1);
    const lineA = lines[idx];
    const lineB = lines[idx + 1] ?? lines[0];
    const textA = getDialogueLineZh(lineA);
    const textB = getDialogueLineZh(lineB);
    if (!textA || !textB || used.has(textA + "|" + textB)) continue;
    used.add(textA + "|" + textB);

    const distractors = buildDistractorsForZhChoice(lesson, textB, 3);
    const others = lines.map((l) => getDialogueLineZh(l)).filter((t) => t && t !== textB && t.length >= 2);
    const pool = [...distractors, ...others];
    const unique = shuffle([...new Set(pool)]).slice(0, 3);
    const optionTexts = [textB, ...unique];
    const contents = optionTexts.map((t) => ({ zh: t, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, textB);

    out.push({
      id: nextId("dialogue"),
      type: "choice",
      subtype: "dialogue_response_choice",
      source: "dialogueCards",
      question: {
        zh: `下列哪一句最适合回答「${textA}」？`,
        kr: `「${textA}」에 가장 알맞은 대답은 무엇입니까?`,
        en: `Which is the best reply to "${textA}"?`,
      },
      prompt: { zh: textA, pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `「${textA}」是问候/提问，最自然的回答是「${textB}」。`,
        kr: `「${textA}」에 대한 자연스러운 대답은 「${textB}」입니다.`,
        en: `The most natural reply to "${textA}" is "${textB}".`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * B2. dialogue_meaning_choice
 * 给一段短句对话，选正确意思（选项为翻译/理解）
 */
export function generateDialogueMeaningChoice(lesson, count, lang) {
  const lines = getDialogueLines(lesson);
  if (lines.length < 2) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const idx = i % lines.length;
    const lineA = lines[idx];
    const lineB = lines[(idx + 1) % lines.length];
    const textA = getDialogueLineZh(lineA);
    const textB = getDialogueLineZh(lineB);
    const dialogueText = `${textA} ${textB}`;
    if (!textA || !textB || used.has(dialogueText)) continue;
    used.add(dialogueText);

    const meaningA = getDialogueLineMeaning(lineA, lang);
    const meaningB = getDialogueLineMeaning(lineB, lang);
    const correctMeaning = meaningA && meaningB ? `${meaningA} ${meaningB}` : (meaningA || meaningB || dialogueText);

    const others = lines.map((l) => getDialogueLineMeaning(l, lang)).filter((t) => t && t !== correctMeaning);
    const pool = [correctMeaning, ...shuffle(others).slice(0, 3)];
    const contents = pool.map((m) => ({ zh: "", pinyin: "", kr: lang === "ko" ? m : "", en: lang === "en" ? m : "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, correctMeaning);

    out.push({
      id: nextId("dialogue"),
      type: "choice",
      subtype: "dialogue_meaning_choice",
      source: "dialogueCards",
      question: {
        zh: `「${textA} ${textB}」这段对话是什么意思？`,
        kr: `이 대화의 뜻은?`,
        en: `What does this dialogue mean?`,
      },
      prompt: { zh: dialogueText, pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `这段对话的意思是：${correctMeaning}`,
        kr: `이 대화의 뜻: ${correctMeaning}`,
        en: `This dialogue means: ${correctMeaning}`,
      },
      score: 1,
    });
  }
  return out;
}

/**
 * B3. dialogue_detail_choice
 * 根据对话内容回答细节问题（如：B 在哪儿？）
 */
export function generateDialogueDetailChoice(lesson, count, lang) {
  const lines = getDialogueLines(lesson);
  if (lines.length < 2) return [];

  const out = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    const idx = (i * 2) % lines.length;
    const lineA = lines[idx];
    const lineB = lines[(idx + 1) % lines.length];
    const textA = getDialogueLineZh(lineA);
    const textB = getDialogueLineZh(lineB);
    if (!textA || !textB || used.has(textA + textB)) continue;
    used.add(textA + textB);

    const correctAnswer = textB;
    const distractors = buildDistractorsForZhChoice(lesson, textB, 3);
    const optionTexts = [textB, ...distractors];
    const contents = shuffle([...new Set(optionTexts)]).slice(0, 4).map((t) => ({ zh: t, pinyin: "", kr: "", en: "" }));
    const { options, answer } = buildOptionsWithLetterKeys(contents, correctAnswer);

    out.push({
      id: nextId("dialogue"),
      type: "choice",
      subtype: "dialogue_detail_choice",
      source: "dialogueCards",
      question: {
        zh: `A：${textA}\nB：___\n\nB 应该说什么？`,
        kr: `A: ${textA}\nB: ___\n\nB가 뭐라고 말해야 할까요?`,
        en: `A: ${textA}\nB: ___\n\nWhat should B say?`,
      },
      prompt: { zh: textA, pinyin: "" },
      options,
      answer,
      explanation: {
        zh: `B：${textB}`,
        kr: `B: ${textB}`,
        en: `B: ${textB}`,
      },
      score: 1,
    });
  }
  return out;
}
