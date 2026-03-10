#!/usr/bin/env node
/**
 * Lumina Dialogue Quality Checker
 * 检测现有课程会话质量：覆盖率、未来词、重复结构、数字堆积
 *
 * 输出：scripts/dialogue_quality_report.md
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const VOCAB_DIST = join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json");
const GOALS_PATH = join(ROOT, "data/pedagogy/hsk1-communication-goals.json");
const REPORT_PATH = join(ROOT, "scripts/dialogue_quality_report.md");

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

// ========== 检测逻辑 ==========

function checkCoverage(lesson, vocabDist) {
  let currentWords = (lesson.vocab || []).map((v) => v.hanzi).filter(Boolean);
  if (!currentWords.length) {
    const dist = vocabDist.distribution || {};
    const key = `lesson${lesson.lessonNo}`;
    currentWords = dist[key] || [];
  }
  const unique = [...new Set(currentWords)];

  const lines = (lesson.dialogueCards || []).flatMap((c) => (c.lines || []).map((l) => l.text || l.zh || ""));
  const text = lines.join("");
  const used = extractWordsFromText(text, unique);
  const percent = unique.length ? (used.size / unique.length) * 100 : 0;
  const unused = unique.filter((w) => !used.has(w));

  return { total: unique.length, used: used.size, percent, unused };
}

function checkFutureWords(lesson, vocabDist) {
  const dist = vocabDist.distribution || {};
  const lines = (lesson.dialogueCards || []).flatMap((c) => (c.lines || []).map((l) => l.text || l.zh || ""));
  const text = lines.join("");

  const forbidden = [];
  for (let i = lesson.lessonNo + 1; i <= 22; i++) {
    const key = `lesson${i}`;
    if (dist[key]) forbidden.push(...dist[key]);
  }

  const violations = forbidden.filter((w) => text.includes(w));
  return violations;
}

function checkStructuralRepetition(lesson) {
  const patterns = [];
  for (const c of lesson.dialogueCards || []) {
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

function checkNumberStacking(lesson) {
  const NUMBERS = "一二三四五六七八九十零";
  const violations = [];
  for (const c of lesson.dialogueCards || []) {
    for (const l of c.lines || []) {
      const t = l.text || l.zh || "";
      const nums = [...t].filter((ch) => NUMBERS.includes(ch)).join("");
      if (nums.length >= 4) violations.push({ text: t, nums });
    }
  }
  return violations;
}

// ========== 主流程 ==========

function main() {
  const vocabDist = loadJSON(VOCAB_DIST);
  const goalsData = loadJSON(GOALS_PATH);
  const goals = goalsData?.goals || {};

  if (!vocabDist) {
    console.error("vocab-distribution.json not found");
    process.exit(1);
  }

  const report = [];
  report.push("# Lumina Dialogue Quality Report");
  report.push("");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push("");

  for (let i = 1; i <= 20; i++) {
    const path = join(HSK1_DIR, `lesson${i}.json`);
    if (!existsSync(path)) continue;

    const lesson = loadJSON(path);
    if (!lesson) continue;

    const goal = goals[String(i)] || vocabDist.lessonThemes?.[String(i)] || "-";
    const coverage = checkCoverage(lesson, vocabDist);
    const futureViolations = checkFutureWords(lesson, vocabDist);
    const repeats = checkStructuralRepetition(lesson);
    const numStack = checkNumberStacking(lesson);

    report.push(`## Lesson ${i}`);
    report.push("");
    report.push(`- **Communicative goal**: ${goal}`);
    report.push(`- **Coverage**: ${coverage.percent.toFixed(1)}% (${coverage.used}/${coverage.total})`);
    if (coverage.percent < 95) {
      report.push(`  - ⚠️ WARNING: Below 95% target`);
      if (coverage.unused.length) report.push(`  - Unused current words: ${coverage.unused.join(", ")}`);
    }
    report.push("");

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
