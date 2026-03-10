#!/usr/bin/env node
/**
 * Lumina Dialogue Quality Checker
 * 检测对象：当前页面最终单词卡词汇 vs 当前页面最终会话实际用词
 * 覆盖率、未来词、重复结构、数字堆积、标题一致性
 *
 * 输出：scripts/dialogue_quality_report.md
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadVocabMap, loadVocabList, getFinalLessonWords, buildVocabMapOpts } from "./lib/getFinalLessonWords.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const VOCAB_DIST = join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json");
const GOALS_PATH = join(ROOT, "data/pedagogy/hsk1-communication-goals.json");
const REPORT_PATH = join(ROOT, "scripts/dialogue_quality_report.md");
const LEVEL_KEY = "hsk1";

// ========== 工具 ==========

function loadJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function extractWordsFromText(text, wordList) {
  const found = new Set();
  const sorted = [...wordList].sort((a, b) => b.length - a.length);
  for (const w of sorted) {
    if (text.includes(w)) found.add(w);
  }
  return found;
}

/** 获取页面实际使用的会话：generatedDialogues > dialogueCards > dialogue */
function getDialogueCards(lesson) {
  const arr =
    Array.isArray(lesson?.generatedDialogues) && lesson.generatedDialogues.length
      ? lesson.generatedDialogues
      : Array.isArray(lesson?.dialogueCards) && lesson.dialogueCards.length
        ? lesson.dialogueCards
        : Array.isArray(lesson?.dialogue) && lesson.dialogue.length
          ? lesson.dialogue
          : [];
  return arr;
}

// ========== 检测逻辑（对齐页面词汇） ==========

function checkCoverage(lesson, finalLessonWords, dialogueCards) {
  const unique = [...new Set(finalLessonWords)];

  const lines = dialogueCards.flatMap((c) => (c.lines || []).map((l) => l.text || l.zh || ""));
  const text = lines.join("");
  const used = extractWordsFromText(text, unique);
  const percent = unique.length ? (used.size / unique.length) * 100 : 0;
  const unused = unique.filter((w) => !used.has(w));
  const usedList = [...used];

  return { total: unique.length, used: used.size, percent, unused, usedList };
}

function checkFutureWords(lesson, forbiddenWords, allowedWords, dialogueCards) {
  const lines = dialogueCards.flatMap((c) => (c.lines || []).map((l) => l.text || l.zh || ""));
  const text = lines.join("");
  const allowed = new Set(allowedWords || []);
  const violations = forbiddenWords.filter((w) => {
    if (!text.includes(w)) return false;
    const inAllowed = [...allowed].some((a) => a.includes(w) && text.includes(a));
    return !inAllowed;
  });
  return violations;
}

function checkStructuralRepetition(dialogueCards) {
  const patterns = [];
  for (const c of dialogueCards) {
    for (const l of c.lines || []) {
      const t = l.text || l.zh || "";
      const m = t.match(/^(.+)(吗？)$/);
      if (m) patterns.push(m[1]);
    }
  }
  const seen = new Set();
  const repeats = [];
  for (const p of patterns) {
    const norm = p.replace(/[你我他她]/g, "X").replace(/[爸爸妈妈儿子女儿老师学生朋友同学]/g, "N");
    if (seen.has(norm)) repeats.push(p);
    else seen.add(norm);
  }
  return repeats;
}

function checkNumberStacking(dialogueCards) {
  const NUMBERS = "一二三四五六七八九十零";
  const violations = [];
  for (const c of dialogueCards) {
    for (const l of c.lines || []) {
      const t = l.text || l.zh || "";
      const nums = [...t].filter((ch) => NUMBERS.includes(ch)).join("");
      if (nums.length >= 4) violations.push({ text: t, nums });
    }
  }
  return violations;
}

/** 标题一致性：若对话主题与 communicativeGoal 明显不符，返回 warning */
function checkTitleConsistency(lesson, goal, dialogueCards) {
  const goalLower = (goal || "").toLowerCase();
  const lines = dialogueCards.flatMap((c) => (c.lines || []).map((l) => l.text || l.zh || ""));
  const text = lines.join("");

  const mismatchKeywords = {
    "询问国籍与居住地": ["学生", "老师", "同学"],
    "介绍家人": ["学生", "老师"],
    "询问数量": ["学生", "老师"],
  };

  const key = Object.keys(mismatchKeywords).find((k) => goalLower.includes(k.toLowerCase()));
  if (!key) return null;

  const forbidden = mismatchKeywords[key];
  const found = forbidden.filter((w) => text.includes(w));
  if (found.length) {
    return `Dialogue topic mismatch with communicative goal: goal="${goal}" but dialogue contains ${found.join(", ")}`;
  }
  return null;
}

// ========== 主流程 ==========

function main() {
  const vocabDist = loadJSON(VOCAB_DIST);
  const goalsData = loadJSON(GOALS_PATH);
  const goals = goalsData?.goals || {};
  const vocabMap = loadVocabMap(LEVEL_KEY);
  const vocabList = loadVocabList(1);

  if (!vocabMap || !vocabList?.length) {
    console.error("vocab-map or vocab list not found");
    process.exit(1);
  }

  const report = [];
  report.push("# Lumina Dialogue Quality Report");
  report.push("");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push("");
  report.push("> 检测对象：页面最终单词卡词汇（vocab-map core+extra）vs 页面实际会话用词");
  report.push("");

  for (let i = 1; i <= 20; i++) {
    const path = join(HSK1_DIR, `lesson${i}.json`);
    if (!existsSync(path)) continue;

    const lesson = loadJSON(path);
    if (!lesson) continue;

    const vocabOpts = buildVocabMapOpts(i, LEVEL_KEY, vocabMap, vocabList);
    const finalLessonWords = vocabOpts.currentWords;
    const forbiddenWords = vocabOpts.forbiddenWords;
    const allowedWords = [...new Set([...finalLessonWords, ...vocabOpts.previousWords])];
    const dialogueCards = getDialogueCards(lesson);

    const goal = goals[String(i)] || vocabDist?.lessonThemes?.[String(i)] || "-";
    const coverage = checkCoverage(lesson, finalLessonWords, dialogueCards);
    const futureViolations = checkFutureWords(lesson, forbiddenWords, allowedWords, dialogueCards);
    const repeats = checkStructuralRepetition(dialogueCards);
    const numStack = checkNumberStacking(dialogueCards);
    const titleWarning = checkTitleConsistency(lesson, goal, dialogueCards);

    report.push(`## Lesson ${i}`);
    report.push("");
    report.push(`- **Communicative goal**: ${goal}`);
    report.push(`- **Final lesson words**: [${finalLessonWords.join(", ")}]`);
    report.push(`- **Dialogue used words**: [${(coverage.usedList || []).join(", ")}]`);
    report.push(`- **Coverage**: ${coverage.percent.toFixed(1)}% (${coverage.used}/${coverage.total})`);
    if (coverage.unused?.length) {
      report.push(`- **Missing words**: [${coverage.unused.join(", ")}]`);
    }
    if (coverage.percent < 95) {
      report.push(`  - ⚠️ WARNING: Below 95% target`);
    }
    report.push("");

    if (titleWarning) {
      report.push(`- ⚠️ **WARNING**: ${titleWarning}`);
      report.push("");
    }

    if (futureViolations.length) {
      report.push(`- ❌ **Future word violations**: ${futureViolations.join(", ")}`);
      report.push("");
    }

    if (repeats.length) {
      report.push(`- ⚠️ **Repetition warnings**: ${repeats.join("; ")}`);
      report.push("");
    }

    if (numStack.length) {
      report.push(`- ⚠️ **Number stacking**: ${numStack.map((x) => x.text).join("; ")}`);
      report.push("");
    }

    report.push("");
  }

  const out = report.join("\n");
  writeFileSync(REPORT_PATH, out, "utf-8");
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
