/**
 * Practice Generator v2 - 对话理解题
 * 来源：dialogueCards
 * 题型：dialogue_response_choice
 */

import { getDialogueLineZh, shuffle, nextId } from "./generatorUtils.js";
import { buildDistractorsForZhChoice } from "./distractorBuilder.js";

function getDialogueLines(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  if (cards.length) {
    return cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  }
  const d = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const first = d[0];
  if (first?.lines) return d.flatMap((c) => c.lines || []);
  return d;
}

/**
 * 对答匹配：A 说了 X，B 应该说什么？
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
    const others = lines
      .map((l) => getDialogueLineZh(l))
      .filter((t) => t && t !== textB && t.length >= 2);
    const pool = [...distractors, ...others];
    const unique = shuffle([...new Set(pool)]).slice(0, 3);
    const options = [textB, ...unique];
    const shuffledOpts = shuffle(options).slice(0, 4);

    const optObjects = shuffledOpts.map((o) => ({
      key: o,
      zh: o,
      pinyin: "",
      kr: "",
      en: "",
    }));

    out.push({
      id: nextId("dialogue"),
      type: "choice",
      subtype: "dialogue_response_choice",
      source: "dialogueCards",
      question: {
        zh: `A：${textA}\nB：___\n\nB 应该说什么？`,
        kr: `A: ${textA}\nB: ___\n\nB가 뭐라고 말해야 할까요?`,
        en: `A: ${textA}\nB: ___\n\nWhat should B say?`,
      },
      prompt: { zh: textA, pinyin: "" },
      options: optObjects,
      answer: textB,
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
