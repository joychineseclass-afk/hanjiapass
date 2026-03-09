#!/usr/bin/env node
/**
 * HSK1 对话新词覆盖率检查
 * 检查每课 dialogueCards 中本课新词的出现比例
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const DIST_PATH = join(HSK1_DIR, "vocab-distribution.json");

const dist = JSON.parse(readFileSync(DIST_PATH, "utf-8"));
const distribution = dist.distribution || {};

function getDialogueTexts(lesson) {
  const texts = [];
  const dialogue = lesson.dialogueCards || lesson.dialogue || [];
  for (const block of dialogue) {
    const lines = block.lines || (block.zh ? [block] : []);
    for (const line of lines) {
      const t = line.zh || line.cn || line.text || "";
      if (t) texts.push(t);
    }
  }
  return texts;
}

function getNewWords(lessonNo) {
  const key = `lesson${lessonNo}`;
  return distribution[key] || [];
}

const results = [];
let below80 = [];

for (let no = 1; no <= 20; no++) {
  const lessonPath = join(HSK1_DIR, `lesson${no}.json`);
  let lesson;
  try {
    lesson = JSON.parse(readFileSync(lessonPath, "utf-8"));
  } catch {
    continue;
  }

  const newWords = getNewWords(no);
  if (newWords.length === 0) continue;

  const texts = getDialogueTexts(lesson);
  const fullText = texts.join(" ");

  const inDialogue = newWords.filter((w) => fullText.includes(w));
  const coverage = inDialogue.length / newWords.length;
  const notInDialogue = newWords.filter((w) => !fullText.includes(w));

  results.push({
    lesson: no,
    total: newWords.length,
    inDialogue: inDialogue.length,
    coverage: Math.round(coverage * 100),
    notInDialogue,
  });

  if (coverage < 0.8) {
    below80.push({ no, coverage: Math.round(coverage * 100), notInDialogue });
  }
}

console.log("\n=== HSK1 新词会话覆盖率 ===\n");
for (const r of results) {
  const status = r.coverage >= 80 ? "✓" : "✗";
  console.log(`Lesson ${r.lesson}: ${r.coverage}% (${r.inDialogue}/${r.total}) ${status}`);
  if (r.coverage < 80 && r.notInDialogue.length > 0) {
    console.log(`  未进会话: ${r.notInDialogue.join(", ")}`);
  }
}

console.log("\n=== 低于 80% 的课程 ===\n");
for (const b of below80) {
  console.log(`Lesson ${b.no}: ${b.coverage}% — ${b.notInDialogue.join(", ")}`);
}

console.log(`\n共 ${results.length} 课，${below80.length} 课未达标。`);
