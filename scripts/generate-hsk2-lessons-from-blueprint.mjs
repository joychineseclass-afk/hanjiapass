#!/usr/bin/env node
/**
 * 从 blueprint.json 生成 HSK2 lesson1~22.json 正式课程文件
 * 确保 words 来自 blueprint newWords，兼容 wordDisplay (meaning/translation)
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BLUEPRINT_PATH = join(ROOT, "data/courses/hsk2.0/hsk2/blueprint.json");
const OUTPUT_DIR = join(ROOT, "data/courses/hsk2.0/hsk2");

function mapWordForLesson(w) {
  const t = w.translations || {};
  return {
    hanzi: w.hanzi || "",
    pinyin: w.pinyin || "",
    pos: w.pos || "",
    meaning: {
      kr: t.kr || t.ko || "",
      en: t.en || "",
      jp: t.jp || t.ja || "",
      cn: w.hanzi || "",
      zh: w.hanzi || "",
    },
    translations: { kr: t.kr || t.ko, en: t.en, jp: t.jp || t.ja },
  };
}

const blueprint = JSON.parse(readFileSync(BLUEPRINT_PATH, "utf-8"));

for (const entry of blueprint) {
  const no = entry.lesson;
  const type = entry.type || "study";
  const isReview = type === "review";

  const words = isReview ? [] : (entry.newWords || []).map(mapWordForLesson);
  const lesson = {
    lesson: no,
    type,
    title: entry.title || { cn: `第${no}课`, kr: `제${no}과`, en: `Lesson ${no}`, jp: `第${no}課` },
    words,
    vocab: words,
    mainGrammar: entry.mainGrammar ? { name: entry.mainGrammar.name, focus: entry.mainGrammar.focus } : { name: "", focus: "" },
    supportGrammar: Array.isArray(entry.supportGrammar) ? entry.supportGrammar : [],
    dialogue: [],
    grammar: [],
    practice: [],
    aiPrompts: [],
    review: [],
  };

  if (isReview) {
    lesson.reviewRange = entry.reviewRange || [];
    lesson.reviewWordsFromLessons = entry.reviewWordsFromLessons || [];
    lesson.reviewGrammar = entry.reviewGrammar || [];
    lesson.review = {
      lessonRange: entry.reviewRange,
      lessonIds: entry.reviewWordsFromLessons,
    };
  }

  const outPath = join(OUTPUT_DIR, `lesson${no}.json`);
  writeFileSync(outPath, JSON.stringify(lesson, null, 2), "utf-8");
  console.log(`Wrote lesson${no}.json (${lesson.words.length} words)`);
}

console.log("Done. Generated lesson1~22.json");
