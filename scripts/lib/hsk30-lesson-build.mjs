/** Shared helpers for HSK3.0 lesson JSON generation — key order matches lesson13.json */
export const steps = [
  { key: "vocab", label: { zh: "词汇", kr: "단어", en: "Words", jp: "語彙" } },
  { key: "dialogue", label: { zh: "对话", kr: "대화", en: "Dialogue", jp: "会話" } },
  { key: "grammar", label: { zh: "语法", kr: "문법", en: "Grammar", jp: "文法" } },
  { key: "extension", label: { zh: "扩展", kr: "확장", en: "Extension", jp: "拡張" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice", jp: "練習" } },
  { key: "aiPractice", label: { zh: "AI练习", kr: "AI 연습", en: "AI Practice", jp: "AI練習" } },
];

export function L(no, o) {
  return {
    id: `hsk1_lesson${no}`,
    courseId: "hsk3.0_hsk1",
    level: "HSK1",
    version: "3.0",
    lessonNo: no,
    type: "lesson",
    title: o.title,
    summary: o.summary,
    scene: o.scene,
    objectives: o.objectives,
    vocab: [],
    dialogue: [],
    dialogueCards: o.dialogueCards,
    grammar: o.grammar,
    extension: o.extension,
    practice: o.practice,
    review: {},
    aiPractice: o.aiPractice,
    aiLearning: o.aiLearning,
    steps,
  };
}

export function i4(zh, kr, en, jp) {
  return { zh, kr, en, jp };
}

export function tr(kr, en, jp) {
  return { kr, en, jp };
}

export function line(sp, text, py, t) {
  return { speaker: sp, text, pinyin: py, translation: t };
}

export function card(title, summary, lines) {
  return { title, summary, lines };
}

export function opt4(a, b, c, d) {
  const mk = (key, cn, kr, en, jp) => ({ key, zh: cn, cn, kr, en, jp });
  return [mk("A", ...a), mk("B", ...b), mk("C", ...c), mk("D", ...d)];
}

export function pinOpts(correct, w1, w2, w3) {
  return [
    { key: "A", zh: correct, cn: correct, kr: correct, en: correct, jp: correct },
    { key: "B", zh: w1, cn: w1, kr: w1, en: w1, jp: w1 },
    { key: "C", zh: w2, cn: w2, kr: w2, en: w2, jp: w2 },
    { key: "D", zh: w3, cn: w3, kr: w3, en: w3, jp: w3 },
  ];
}
