#!/usr/bin/env node
/**
 * Lumina Dialogue Generator v1
 *
 * 1. currentWords 唯一来源：getFinalLessonWords(lesson) = vocab-map core+extra
 * 2. communicativeGoal 参与模板选择
 * 3. 生成 preview，可选 --write-back 写回 lesson.generatedDialogues
 *
 * 用法：node scripts/generate-dialogues-v1.mjs [--write-back]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateDialogues, buildGeneratorInput } from "../ui/modules/curriculum/dialogueGenerator.js";
import { loadVocabMap, loadVocabList, buildVocabMapOpts } from "./lib/getFinalLessonWords.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const VOCAB_DIST_PATH = join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json");
const GOALS_PATH = join(ROOT, "data/pedagogy/hsk1-communication-goals.json");
const DIALOGUE_BLUEPRINT_PATH = join(ROOT, "data/pedagogy/hsk1-dialogue-blueprint.json");
const LEVEL_KEY = "hsk1";

// ========== 加载 ==========

function loadJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ========== 格式转换 ==========

/** 将生成器输出转为页面 dialogueCards 格式 */
function toDialogueCards(dialogues) {
  if (!Array.isArray(dialogues)) return [];
  return dialogues.map((d) => ({
    title: typeof d.title === "string" ? { zh: d.title } : d.title,
    lines: (d.turns || []).map((t) => ({
      speaker: t.speaker,
      text: t.zh,
      pinyin: t.pinyin,
      translation: t.ko ? { kr: t.ko, en: t.en || "" } : {},
    })),
  }));
}

/** 将 extensionSentences 转为 extension 格式 */
function toExtension(extensionSentences) {
  if (!Array.isArray(extensionSentences)) return [];
  return extensionSentences.map((e) => ({
    zh: e.zh,
    pinyin: e.pinyin,
    kr: e.ko || "",
    en: e.en || "",
    phrase: e.zh,
    explain: e.ko ? { kr: e.ko, en: e.en || "" } : {},
  }));
}

// ========== 质量检查 ==========

function passesQualityCheck(output, input) {
  if (output.errors?.length) return false;
  if (output.coverage?.percent < 0.95 && output.coverage?.unusedWords?.length) return false;
  // 不允许未来整词出现（子串如 多 in 多少 若 多少 在 allowed 则放行）
  const text = (output.dialogues || []).flatMap((d) => d.turns.map((t) => t.zh)).join("");
  for (const w of input.forbiddenWords || []) {
    if (!text.includes(w)) continue;
    const inAllowed = (input.allowedWords || []).some((a) => a.includes(w) && text.includes(a));
    if (!inAllowed) return false;
  }
  return true;
}

// ========== 主流程 ==========

function main() {
  const writeBack = process.argv.includes("--write-back");

  const vocabDist = loadJSON(VOCAB_DIST_PATH);
  const goalsData = loadJSON(GOALS_PATH);
  const goals = goalsData?.goals || {};
  const dialogueBlueprint = loadJSON(DIALOGUE_BLUEPRINT_PATH);
  const vocabMap = loadVocabMap(LEVEL_KEY);
  const vocabList = loadVocabList(1);

  if (!vocabDist) {
    console.error("vocab-distribution.json not found");
    process.exit(1);
  }
  if (!vocabMap || !vocabList?.length) {
    console.error("vocab-map or vocab list not found");
    process.exit(1);
  }
  if (!dialogueBlueprint) {
    console.warn("hsk1-dialogue-blueprint.json not found, dialogueTasks will be empty");
  }

  const lessonsToRun = [3, 4, 5];

  for (const n of lessonsToRun) {
    const lessonPath = join(HSK1_DIR, `lesson${n}.json`);
    if (!existsSync(lessonPath)) {
      console.warn(`Lesson ${n} not found, skip`);
      continue;
    }

    const lesson = loadJSON(lessonPath);
    const vocabOpts = buildVocabMapOpts(n, LEVEL_KEY, vocabMap, vocabList);
    const input = buildGeneratorInput(lesson, vocabDist, goals, {
      ...vocabOpts,
      dialogueBlueprint: dialogueBlueprint || {},
    });
    const output = generateDialogues(input);

    console.log(`\n--- Lesson ${n} ---`);
    console.log(`  Final lesson words: [${input.currentWords.join(", ")}]`);
    console.log(`  Coverage: ${((output.coverage?.percent ?? 0) * 100).toFixed(1)}%`);
    if (output.coverage?.unusedWords?.length) {
      console.log(`  Unused: ${output.coverage.unusedWords.join(", ")}`);
    }
    if (output.warnings?.length) console.log(`  Warnings: ${output.warnings.join("; ")}`);
    if (output.errors?.length) console.log(`  Errors: ${output.errors.join("; ")}`);

    const preview = {
      lessonId: String(n),
      lessonTitle: input.lessonTitle,
      communicativeGoal: input.communicativeGoal,
      dialogueTasks: input.dialogueTasks || [],
      generatedAt: new Date().toISOString(),
      ...output,
    };

    const outPath = join(HSK1_DIR, `dialogue_generator_preview_l${n}.json`);
    writeFileSync(outPath, JSON.stringify(preview, null, 2), "utf-8");
    console.log(`  Preview saved: ${outPath}`);

    const qualityOk = passesQualityCheck(output, input);
    if (writeBack && qualityOk) {
      const cards = toDialogueCards(output.dialogues || []);
      const extensions = toExtension(output.extensionSentences || []);
      const lessonUpdated = {
        ...lesson,
        generatedDialogues: cards,
        generatedExtensions: extensions.length ? extensions : undefined,
        dialogueMeta: {
          generatedAt: preview.generatedAt,
          coverage: output.coverage?.percent,
          communicativeGoal: input.communicativeGoal,
          dialogueTasks: input.dialogueTasks || [],
        },
      };
      writeFileSync(lessonPath, JSON.stringify(lessonUpdated, null, 2), "utf-8");
      console.log(`  Written to lesson${n}.json (generatedDialogues)`);
    } else if (writeBack && !qualityOk) {
      console.log(`  Skipped write-back: quality check failed`);
    }
  }

  console.log("\nDone.");
  if (!writeBack) {
    console.log("Use --write-back to write generatedDialogues to lesson files.");
  }
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
