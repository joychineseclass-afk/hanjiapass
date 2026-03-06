#!/usr/bin/env node
/**
 * Update HSK1 lessons: steps as object array, vocab only, review cleanup
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HSK1 = join(__dirname, "../data/courses/hsk2.0/hsk1");

const STEPS_LESSON = [
  { key: "vocab", label: { zh: "词汇", kr: "단어", en: "Words" } },
  { key: "dialogue", label: { zh: "对话", kr: "대화", en: "Dialogue" } },
  { key: "grammar", label: { zh: "语法", kr: "문법", en: "Grammar" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice" } },
  { key: "aiPractice", label: { zh: "AI练习", kr: "AI 연습", en: "AI Practice" } },
];

const STEPS_REVIEW = [
  { key: "review", label: { zh: "复习", kr: "복습", en: "Review" } },
  { key: "practice", label: { zh: "练习", kr: "연습", en: "Practice" } },
  { key: "aiPractice", label: { zh: "AI练习", kr: "AI 연습", en: "AI Practice" } },
];

for (let n = 1; n <= 22; n++) {
  const path = join(HSK1, `lesson${n}.json`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.warn("Skip:", path);
    continue;
  }

  const isReview = raw.type === "review";
  const steps = isReview ? STEPS_REVIEW : STEPS_LESSON;

  const out = { ...raw };
  delete out.words;
  out.steps = steps;

  if (n === 21) {
    out.vocab = [];
    out.dialogue = [];
    out.grammar = [];
    out.practice = [{ type: "roleplay", prompt: "复习第1–10课学过的词汇和对话。" }];
    out.review = { lessonRange: [1, 10], focusAreas: ["vocab", "dialogue", "grammar"] };
    out.aiPractice = { speaking: [], chatPrompt: "复习对话练习。" };
  }
  if (n === 22) {
    out.vocab = [];
    out.dialogue = [
      { speaker: "A", line: "你好！你叫什么名字？" },
      { speaker: "B", line: "我叫李明。我是学生。" },
    ];
    out.grammar = [];
    out.practice = [{ type: "roleplay", prompt: "完成完整自我介绍对话。" }];
    out.review = { lessonRange: [11, 20], focusAreas: ["vocab", "dialogue", "grammar"] };
    out.aiPractice = { speaking: ["你好", "我叫小明"], chatPrompt: "AI进行完整情景对话。" };
  }

  writeFileSync(path, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("Updated:", path);
}
console.log("Done.");
