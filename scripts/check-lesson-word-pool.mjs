#!/usr/bin/env node
/**
 * 课程自动检查：dialogueWords ⊆ wordCard
 * 如果发现未收录词，自动加入 wordCard (words/vocab)
 *
 * 规则：
 * - 会话只允许使用：reviewWords + newWords + borrowWords(最多2个)
 * - 若会话出现新词，必须自动加入单词卡
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LESSONS_DIR = join(ROOT, "data/courses/hsk2.0/hsk2");
const HSK1_VOCAB_PATH = join(ROOT, "data/vocab/hsk2.0/hsk1.json");
const HSK2_VOCAB_PATH = join(ROOT, "data/vocab/hsk2.0/hsk2.json");

function loadVocab(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

/**
 * 从对话文本中提取出现的词汇（基于全局词库匹配）
 * 按词长降序匹配，排除被更长词包含的短词（如「高」在「高兴」中不单独计）
 */
function extractWordsFromText(text, vocabByLen) {
  if (!text || typeof text !== "string") return new Set();
  const found = new Set();
  for (const word of vocabByLen) {
    if (!text.includes(word)) continue;
    const isSubstringOfFound = [...found].some((w) => w !== word && w.includes(word));
    if (!isSubstringOfFound) found.add(word);
  }
  return found;
}

/**
 * 获取 lesson 中 dialogue 的所有 cn 文本
 */
function getDialogueTexts(lesson) {
  const texts = [];
  const dialogue = lesson.dialogue || lesson.dialogueCards || [];
  for (const block of dialogue) {
    const lines = block.lines || (block.cn ? [block] : []);
    for (const line of lines) {
      const t = line.cn || line.text || "";
      if (t) texts.push(t);
    }
  }
  return texts;
}

/**
 * 获取 lesson 的 wordCard（允许使用的词）
 */
function getWordCard(lesson) {
  const pool = lesson.lessonWordPool || {};
  const review = new Set(pool.reviewWords || []);
  const newW = new Set(pool.newWords || []);
  const borrow = new Set(pool.borrowWords || []);
  const words = lesson.words || lesson.vocab || [];
  const fromWords = new Set(words.map((w) => w.hanzi || w));
  return new Set([...review, ...newW, ...borrow, ...fromWords]);
}

function mapWordForVocab(hanzi, vocabMap) {
  const v = vocabMap.get(hanzi) || {};
  const t = v.meaning || v.translations || {};
  return {
    hanzi,
    pinyin: v.pinyin || "",
    pos: v.pos || "",
    meaning: {
      kr: t.ko || t.kr || "",
      en: t.en || "",
      jp: t.jp || t.ja || "",
      cn: hanzi,
      zh: hanzi,
    },
    translations: { kr: t.ko || t.kr, en: t.en, jp: t.jp || t.ja },
  };
}

// 主逻辑
const hsk1 = loadVocab(HSK1_VOCAB_PATH);
const hsk2 = loadVocab(HSK2_VOCAB_PATH);
const allVocab = [...hsk1, ...hsk2];
const vocabByLen = [...new Set(allVocab.map((w) => w.hanzi))].sort(
  (a, b) => (b?.length || 0) - (a?.length || 0)
);
const vocabMap = new Map(allVocab.map((w) => [w.hanzi, w]));

let totalAdded = 0;
let totalIssues = 0;

for (let no = 1; no <= 22; no++) {
  const lessonPath = join(LESSONS_DIR, `lesson${no}.json`);
  let lesson;
  try {
    lesson = JSON.parse(readFileSync(lessonPath, "utf-8"));
  } catch {
    continue;
  }

  if (lesson.type === "review") continue;

  const dialogueTexts = getDialogueTexts(lesson);
  const wordCard = getWordCard(lesson);
  const dialogueWords = new Set();

  for (const text of dialogueTexts) {
    const found = extractWordsFromText(text, vocabByLen);
    found.forEach((w) => dialogueWords.add(w));
  }

  const missing = [...dialogueWords].filter((w) => !wordCard.has(w));

  // 检查本课新词 ≥80% 出现在会话
  const pool = lesson.lessonWordPool || { reviewWords: [], newWords: [], borrowWords: [] };
  const newWords = pool.newWords || [];
  const inDialogue = newWords.filter((w) => dialogueWords.has(w));
  const coverage = newWords.length ? inDialogue.length / newWords.length : 1;
  if (newWords.length > 0 && coverage < 0.8) {
    const notInDialogue = newWords.filter((w) => !dialogueWords.has(w));
    console.log(
      `\nLesson ${no}: 新词会话覆盖率 ${(coverage * 100).toFixed(0)}% < 80%，未进会话: ${notInDialogue.join(", ")}（应放入 extension 造句）`
    );
    totalIssues++;
  }

  if (missing.length > 0) {
    totalIssues++;
    console.log(`\nLesson ${no}: 发现 ${missing.length} 个未收录词: ${missing.join(", ")}`);

    const words = [...(lesson.words || lesson.vocab || [])];
    const existingHanzi = new Set(words.map((w) => w.hanzi || w));

    for (const hanzi of missing) {
      if (existingHanzi.has(hanzi)) continue;

      const mapped = mapWordForVocab(hanzi, vocabMap);
      words.push(mapped);
      existingHanzi.add(hanzi);

      if (pool.borrowWords.length < 2 && !pool.newWords.includes(hanzi) && !pool.reviewWords.includes(hanzi)) {
        pool.borrowWords = [...(pool.borrowWords || []), hanzi].slice(0, 2);
      }

      totalAdded++;
      console.log(`  + 自动加入 wordCard: ${hanzi}`);
    }

    lesson.words = words;
    lesson.vocab = words;
    lesson.lessonWordPool = pool;

    writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), "utf-8");
    console.log(`  已更新 lesson${no}.json`);
  }
}

console.log(`\n完成。共检查 22 课，发现 ${totalIssues} 课有问题，自动加入 ${totalAdded} 个词。`);
