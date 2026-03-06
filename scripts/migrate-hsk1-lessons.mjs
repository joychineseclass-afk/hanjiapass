#!/usr/bin/env node
/**
 * Migrate HSK1 lessons to standard template format
 * - Adds id, courseId, type, title{}, summary{}, vocab, steps
 * - Keeps words for backward compat
 * - lesson21/22 → type: "review"
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");

const LESSON_TITLES = {
  1: { zh: "打招呼", kr: "인사하기", en: "Greetings" },
  2: { zh: "礼貌用语", kr: "이름 묻기/介绍名字", en: "Polite expressions" },
  3: { zh: "国家", kr: "국적", en: "Countries" },
  4: { zh: "家人", kr: "가족", en: "Family" },
  5: { zh: "数字①", kr: "숫자 1", en: "Numbers 1" },
  6: { zh: "数字②", kr: "숫자 2", en: "Numbers 2" },
  7: { zh: "年龄", kr: "나이 묻기", en: "Age" },
  8: { zh: "日期", kr: "날짜", en: "Dates" },
  9: { zh: "时间", kr: "시간", en: "Time" },
  10: { zh: "星期", kr: "요일", en: "Weekdays" },
  11: { zh: "学校", kr: "학교 생활", en: "School" },
  12: { zh: "工作", kr: "직업", en: "Work" },
  13: { zh: "爱好", kr: "취미", en: "Hobbies" },
  14: { zh: "吃饭", kr: "음식 1", en: "Eating" },
  15: { zh: "饮料", kr: "음식 2", en: "Drinks" },
  16: { zh: "在哪儿", kr: "위치", en: "Location" },
  17: { zh: "坐车", kr: "교통", en: "Transport" },
  18: { zh: "买东西", kr: "쇼핑", en: "Shopping" },
  19: { zh: "天气", kr: "날씨", en: "Weather" },
  20: { zh: "看病", kr: "병원", en: "Seeing a doctor" },
  21: { zh: "复习 1", kr: "복습 1", en: "Review 1" },
  22: { zh: "复习 2", kr: "복습 2", en: "Review 2" },
};

const STEPS = ["words", "dialogue", "grammar", "practice", "ai"];

function toVocabItem(w) {
  if (typeof w === "string") {
    return { hanzi: w, pinyin: "", meaning: { zh: w, kr: "", en: "" } };
  }
  const h = w.hanzi || w.word || "";
  const m = w.meaning || {};
  return {
    hanzi: h,
    pinyin: w.pinyin || "",
    meaning: {
      zh: m.zh || w.zh || h,
      kr: m.kr || m.ko || w.ko || w.kr || "",
      en: m.en || w.en || "",
    },
  };
}

function migrateLesson(n) {
  const path = join(HSK1_DIR, `lesson${n}.json`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.warn("Skip (read fail):", path, e.message);
    return;
  }

  const isReview = n >= 21;
  const t = LESSON_TITLES[n] || { zh: raw.title?.zh || raw.title || "", kr: "", en: "" };
  const titleObj = typeof raw.title === "object" ? raw.title : { zh: String(raw.title || ""), kr: "", en: "" };
  const title = {
    zh: titleObj.zh || t.zh,
    pinyin: titleObj.pinyin || "",
    kr: titleObj.kr || t.kr,
    en: titleObj.en || t.en,
  };
  const topicObj = typeof raw.topic === "object" ? raw.topic : { zh: String(raw.topic || ""), kr: "", en: "" };

  const wordsSource = raw.vocab || raw.words || [];
  const vocab = wordsSource.map(toVocabItem);
  const words = wordsSource.map((w) =>
    typeof w === "string"
      ? { hanzi: w }
      : { hanzi: w.hanzi || w.word, pinyin: w.pinyin, ko: w.ko || w.kr, en: w.en }
  );

  const aiSrc = raw.aiPractice || raw.ai_interaction || {};
  const aiPractice = {
    speaking: aiSrc.speaking || [],
    chatPrompt: aiSrc.chatPrompt || aiSrc.chat_prompt || "",
  };

  const out = {
    id: `hsk2.0_hsk1_lesson${n}`,
    courseId: "hsk2.0_hsk1",
    level: "HSK1",
    version: "2.0",
    lessonNo: n,
    type: isReview ? "review" : "lesson",
    title,
    summary: {
      zh: topicObj.zh,
      kr: topicObj.kr,
      en: topicObj.en,
    },
    objectives: raw.objectives || [],
    vocab,
    words,
    dialogue: raw.dialogue || [],
    grammar: raw.grammar || [],
    practice: raw.practice || [],
    review: isReview
      ? n === 21
        ? { lessonRange: [1, 10], focusAreas: ["vocab", "dialogue", "grammar"] }
        : { lessonRange: [11, 20], focusAreas: ["vocab", "dialogue", "grammar"] }
      : {},
    aiPractice,
    steps: raw.steps && raw.steps.length ? raw.steps : [...STEPS],
  };

  writeFileSync(path, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("Migrated:", path);
}

for (let i = 2; i <= 22; i++) {
  migrateLesson(i);
}
console.log("Done.");
