#!/usr/bin/env node
/**
 * 同步 HSK1 lesson1~lesson20 的 vocab 与 vocab-distribution.json
 * 从 data/vocab/hsk2.0/hsk1.json 提取完整词条信息
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const vocabDistPath = join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json");
const vocabPath = join(ROOT, "data/vocab/hsk2.0/hsk1.json");
const lessonsDir = join(ROOT, "data/courses/hsk2.0/hsk1");

const vocabDist = JSON.parse(readFileSync(vocabDistPath, "utf8"));
const vocabList = JSON.parse(readFileSync(vocabPath, "utf8"));

const hanziMap = new Map();
for (const v of vocabList) {
  const h = (v.hanzi || "").trim();
  if (h && !hanziMap.has(h)) hanziMap.set(h, v);
}

function toLessonVocabEntry(src) {
  const m = src.meaning || {};
  const zh = m.zh || m.cn || src.hanzi || "";
  const kr = m.kr || m.ko || "";
  const en = m.en || "";
  return {
    hanzi: src.hanzi,
    pinyin: (src.pinyin || "").trim(),
    meaning: { zh, kr, en },
  };
}

const updated = [];
for (let n = 1; n <= 20; n++) {
  const key = `lesson${n}`;
  const words = vocabDist.distribution?.[key] || [];
  const vocab = words
    .map((hanzi) => {
      const v = hanziMap.get(hanzi);
      if (!v) {
        console.warn(`[WARN] ${key}: hanzi "${hanzi}" not found in hsk1.json, using minimal entry`);
        return { hanzi, pinyin: "", meaning: { zh: hanzi, kr: "", en: "" } };
      }
      return toLessonVocabEntry(v);
    })
    .filter((e) => e.hanzi);

  const lessonPath = join(lessonsDir, `lesson${n}.json`);
  const lesson = JSON.parse(readFileSync(lessonPath, "utf8"));
  lesson.vocab = vocab;
  writeFileSync(lessonPath, JSON.stringify(lesson, null, 2) + "\n", "utf8");
  updated.push(`lesson${n}.json`);
}

console.log("Updated:", updated.join(", "));
console.log("Done. lesson1~lesson20 vocab synced with vocab-distribution.json");
