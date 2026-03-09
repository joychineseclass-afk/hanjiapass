#!/usr/bin/env node
/**
 * 构建 lessonWordPool
 * 规则：
 * - reviewWords: 已学词（HSK1 + 之前所有课的 newWords）
 * - newWords: 本课新词
 * - borrowWords: 借用词（最多2个）
 *
 * 生成顺序：WordPool → Dialogue → Grammar → Extension → Practice
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BLUEPRINT_PATH = join(ROOT, "data/courses/hsk2.0/hsk2/blueprint.json");
const LESSONS_DIR = join(ROOT, "data/courses/hsk2.0/hsk2");
const HSK1_VOCAB_PATH = join(ROOT, "data/vocab/hsk2.0/hsk1.json");
const HSK2_VOCAB_PATH = join(ROOT, "data/vocab/hsk2.0/hsk2.json");

const MAX_BORROW_WORDS = 2;

function loadVocab(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

function getHanziList(words) {
  return Array.isArray(words) ? words.map((w) => w.hanzi || w).filter(Boolean) : [];
}

function buildWordPoolForLesson(lessonNo, blueprint, hsk1Vocab, hsk2Vocab) {
  const entry = blueprint.find((b) => b.lesson === lessonNo);
  if (!entry || entry.type === "review") {
    return null;
  }

  const newWords = getHanziList(entry.newWords || []);
  // reviewWords = HSK1 全部 + 之前所有课的 newWords
  const reviewWords = [...getHanziList(hsk1Vocab)];
  for (let i = 1; i < lessonNo; i++) {
    const prev = blueprint.find((b) => b.lesson === i);
    if (prev?.newWords) {
      for (const h of getHanziList(prev.newWords)) {
        if (h && !reviewWords.includes(h)) reviewWords.push(h);
      }
    }
  }

  const borrowWords = entry.borrowWords || [];
  if (borrowWords.length > MAX_BORROW_WORDS) {
    console.warn(`Lesson ${lessonNo}: borrowWords exceeds ${MAX_BORROW_WORDS}, truncating`);
  }

  return {
    reviewWords,
    newWords,
    borrowWords: borrowWords.slice(0, MAX_BORROW_WORDS),
  };
}

function mapWordForLesson(w, hsk2VocabMap) {
  const full = hsk2VocabMap?.get(w) || {};
  const t = full.meaning || full.translations || {};
  return {
    hanzi: typeof w === "string" ? w : w.hanzi || "",
    pinyin: full.pinyin || "",
    pos: full.pos || "",
    meaning: {
      kr: t.ko || t.kr || "",
      en: t.en || "",
      jp: t.jp || t.ja || "",
      cn: typeof w === "string" ? w : w.hanzi || "",
      zh: typeof w === "string" ? w : w.hanzi || "",
    },
    translations: { kr: t.ko || t.kr, en: t.en, jp: t.jp || t.ja },
  };
}

// 主逻辑
const blueprint = JSON.parse(readFileSync(BLUEPRINT_PATH, "utf-8"));
const hsk1Vocab = loadVocab(HSK1_VOCAB_PATH);
const hsk2Vocab = loadVocab(HSK2_VOCAB_PATH);
const hsk2Map = new Map(hsk2Vocab.map((w) => [w.hanzi, w]));

for (let no = 1; no <= 22; no++) {
  const lessonPath = join(LESSONS_DIR, `lesson${no}.json`);
  let lesson;
  try {
    lesson = JSON.parse(readFileSync(lessonPath, "utf-8"));
  } catch {
    console.warn(`Skip lesson${no}.json (not found)`);
    continue;
  }

  const pool = buildWordPoolForLesson(no, blueprint, hsk1Vocab, hsk2Vocab);
  if (!pool) {
    console.log(`Lesson ${no}: review lesson, skip wordPool`);
    continue;
  }

  lesson.lessonWordPool = pool;

  // 仅当 words 为空或缺失时，从 blueprint 初始化；否则保留现有 words（可能含 check 自动加入的词）
  const hasWords = (lesson.words || lesson.vocab || []).length > 0;
  if (!hasWords) {
    const entry = blueprint.find((b) => b.lesson === no);
    const newWordObjs = (entry?.newWords || []).map((w) => {
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
    });
    for (const bw of pool.borrowWords) {
      if (!newWordObjs.some((w) => w.hanzi === bw)) {
        newWordObjs.push(mapWordForLesson(bw, hsk2Map));
      }
    }
    lesson.words = newWordObjs;
    lesson.vocab = newWordObjs;
  }

  writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), "utf-8");
  console.log(
    `Lesson ${no}: wordPool review=${pool.reviewWords.length} new=${pool.newWords.length} borrow=${pool.borrowWords.length}`
  );
}

console.log("Done. Built lessonWordPool for all lessons.");
