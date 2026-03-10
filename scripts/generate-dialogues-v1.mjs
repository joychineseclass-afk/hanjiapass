#!/usr/bin/env node
/**
 * Lumina Dialogue Generator v1 - 试运行脚本
 *
 * 为 L3, L4, L5 生成会话预览，保存到 dialogue_generator_preview_l{N}.json
 * 不覆盖现有课程内容。
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateDialogues, buildGeneratorInput } from "../ui/modules/curriculum/dialogueGenerator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const VOCAB_DIST_PATH = join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json");
const GOALS_PATH = join(ROOT, "data/pedagogy/hsk1-communication-goals.json");

// ========== 加载 ==========

function loadJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ========== 主流程 ==========

function main() {
  const vocabDist = loadJSON(VOCAB_DIST_PATH);
  const goalsData = loadJSON(GOALS_PATH);
  const goals = goalsData?.goals || {};

  if (!vocabDist) {
    console.error("vocab-distribution.json not found");
    process.exit(1);
  }

  const lessonsToRun = [3, 4, 5];

  for (const n of lessonsToRun) {
    const lessonPath = join(HSK1_DIR, `lesson${n}.json`);
    if (!existsSync(lessonPath)) {
      console.warn(`Lesson ${n} not found, skip`);
      continue;
    }

    const lesson = loadJSON(lessonPath);
    const input = buildGeneratorInput(lesson, vocabDist, goals);
    const output = generateDialogues(input);

    const preview = {
      lessonId: String(n),
      lessonTitle: input.lessonTitle,
      communicativeGoal: input.communicativeGoal,
      generatedAt: new Date().toISOString(),
      ...output,
    };

    const outPath = join(HSK1_DIR, `dialogue_generator_preview_l${n}.json`);
    writeFileSync(outPath, JSON.stringify(preview, null, 2), "utf-8");
    console.log(`Preview saved: ${outPath}`);
    console.log(`  Coverage: ${(output.coverage.percent * 100).toFixed(1)}%`);
    if (output.warnings?.length) console.log(`  Warnings: ${output.warnings.join("; ")}`);
    if (output.errors?.length) console.log(`  Errors: ${output.errors.join("; ")}`);
  }

  console.log("\nDone. Previews are for review only. Do not overwrite lesson files until quality is confirmed.");
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
