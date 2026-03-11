#!/usr/bin/env node
/**
 * Lumina Step2 — HSK1 Blueprint-driven Dialogue Rebuild
 *
 * 规则：会话1 必须包含 coreSentence；主题与 scene/dialogueTheme 一致；
 * 每课 1~3 组会话，每组 2~6 句；dialogue 优先覆盖本课新词（≥80%），语法自然出现；
 * 会话自然优先于覆盖率，禁止数字堆叠、人物冲突、标题与内容不一致。
 *
 * 流程：Blueprint + hsk1-dialogue-rebuild.json → 写回 lessonX.json 的 dialogueCards / originalDialogues
 * 范围：仅 data/courses/hsk2.0/hsk1/，不碰 HSK2。
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensurePinyin } from "./pinyin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const BLUEPRINT_PATH = join(ROOT, "data/pedagogy/hsk1-blueprint.json");
const REBUILD_DATA_PATH = join(ROOT, "data/pedagogy/hsk1-dialogue-rebuild.json");

function loadJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function ensureLinePinyin(line) {
  const text = line.text || line.zh || line.cn || "";
  if (!text) return line;
  const out = { ...line };
  if (!out.text) out.text = text;
  if (!out.pinyin || out.pinyin === out.text) {
    try {
      out.pinyin = ensurePinyin(text, line.pinyin) || text;
    } catch {
      out.pinyin = out.pinyin || text;
    }
  }
  if (out.translation && typeof out.translation === "object") {
    if (!out.translation.kr) out.translation.kr = out.translation.en || "";
    if (!out.translation.jp) out.translation.jp = out.translation.en || "";
  }
  return out;
}

function buildDialogueCards(cards, blueprintEntry) {
  const sessionTitles = [
    { zh: "会话1", kr: "회화1", en: "Session 1", jp: "会話1" },
    { zh: "会话2", kr: "회화2", en: "Session 2", jp: "会話2" },
    { zh: "会话3", kr: "회화3", en: "Session 3", jp: "会話3" },
  ];
  return (cards || []).map((card, i) => {
    const title = card.title && typeof card.title === "object"
      ? { zh: card.title.zh || sessionTitles[i]?.zh, kr: card.title.kr || sessionTitles[i]?.kr, en: card.title.en || sessionTitles[i]?.en, jp: card.title.jp || sessionTitles[i]?.jp }
      : sessionTitles[i];
    const lines = (card.lines || []).map((line) => ensureLinePinyin(line));
    return { title, lines };
  });
}

function getLessonFilePath(lessonNo, lessonsIndex) {
  if (lessonNo >= 21 && lessonsIndex) {
    const entry = lessonsIndex.lessons.find((l) => (l.no || l.id) === lessonNo);
    const file = entry?.file || (lessonNo === 21 ? "hsk1_lesson21.json" : "hsk1_lesson22.json");
    return join(HSK1_DIR, file);
  }
  return join(HSK1_DIR, `lesson${lessonNo}.json`);
}

function main() {
  const blueprint = loadJSON(BLUEPRINT_PATH);
  if (!blueprint?.lessons) {
    console.error("[rebuild] Missing or invalid blueprint at", BLUEPRINT_PATH);
    process.exit(1);
  }

  const rebuildData = loadJSON(REBUILD_DATA_PATH);
  if (!rebuildData || typeof rebuildData !== "object") {
    console.error("[rebuild] Missing or invalid rebuild data at", REBUILD_DATA_PATH);
    process.exit(1);
  }

  const lessonsIndex = loadJSON(join(HSK1_DIR, "lessons.json"));
  const report = { modified: [], cardsPerLesson: {}, wordsToExtension: {} };

  for (let no = 1; no <= 22; no++) {
    const key = String(no);
    const bp = blueprint.lessons[key];
    const content = rebuildData[key];
    const filePath = getLessonFilePath(no, lessonsIndex);

    if (!existsSync(filePath)) {
      console.warn("[rebuild] Skip (no file):", filePath);
      continue;
    }
    if (!content?.cards?.length) {
      console.warn("[rebuild] Skip (no rebuild content for lesson", no, ")");
      continue;
    }

    const lesson = loadJSON(filePath);
    if (!lesson) continue;

    const dialogueCards = buildDialogueCards(content.cards, bp);
    if (dialogueCards.length < 1 || dialogueCards.length > 3) {
      console.warn("[rebuild] Lesson", no, "cards count", dialogueCards.length, "(expected 1–3)");
    }

    // 校验：会话1 包含 coreSentence（复习课不强制）
    const isReview = bp?.scene === "review";
    const coreSentence = bp?.coreSentence ? String(bp.coreSentence).replace(/[？！。]/g, "").trim() : "";
    const firstCardText = (dialogueCards[0]?.lines || []).map((l) => l.text || "").join("");
    const normalizedFirst = firstCardText.replace(/[？！。，、\s]/g, "");
    const normalizedCore = coreSentence.replace(/[？！。，、\s]/g, "");
    if (!isReview && normalizedCore && !normalizedFirst.includes(normalizedCore)) {
      console.warn("[rebuild] Lesson", no, "dialogue 1 may not contain coreSentence:", bp.coreSentence);
    }

    lesson.dialogueCards = dialogueCards;
    lesson.originalDialogues = dialogueCards;
    writeFileSync(filePath, JSON.stringify(lesson, null, 2), "utf-8");

    report.modified.push(no);
    report.cardsPerLesson[key] = dialogueCards.length;
    if (content.wordsToExtension?.length) {
      report.wordsToExtension[key] = content.wordsToExtension;
    }
  }

  console.log("[rebuild] Done. Modified lessons:", report.modified.join(", "));
  console.log("[rebuild] Cards per lesson:", JSON.stringify(report.cardsPerLesson, null, 2));
  if (Object.keys(report.wordsToExtension).length) {
    console.log("[rebuild] Words to extension (by lesson):", JSON.stringify(report.wordsToExtension, null, 2));
  }
}

main();
