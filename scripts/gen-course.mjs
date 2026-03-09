#!/usr/bin/env node
/**
 * Lumina Pedagogy Engine v1
 * 课程生成：WordPool → loadScene → selectTemplate → injectWords → coverageCheck → buildLesson
 *
 * 课程结构固定：WordCard → Dialogue → Grammar → Extension → Practice → AI Tutor
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PEDAGOGY_DIR = join(ROOT, "data/pedagogy");

// ========== 配置 ==========
const COURSES = {
  hsk1: {
    dir: join(ROOT, "data/courses/hsk2.0/hsk1"),
    vocabPath: "vocab-distribution.json",
    maxLessons: 20,
  },
  hsk2: {
    dir: join(ROOT, "data/courses/hsk2.0/hsk2"),
    vocabPath: null,
    maxLessons: 22,
  },
};

// ========== 加载 ==========
function loadLessonScenes() {
  const path = join(PEDAGOGY_DIR, "lesson-scenes.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadDialogueTemplates() {
  const path = join(PEDAGOGY_DIR, "dialogue-templates.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadWordPool(course, lessonNo) {
  const cfg = COURSES[course];
  if (course === "hsk1") {
    const distPath = join(cfg.dir, cfg.vocabPath);
    const dist = JSON.parse(readFileSync(distPath, "utf-8"));
    const newWords = dist.distribution?.[`lesson${lessonNo}`] || [];
    const reviewWords = [];
    for (let i = 1; i < lessonNo; i++) {
      reviewWords.push(...(dist.distribution?.[`lesson${i}`] || []));
    }
    return { newWords, reviewWords };
  }
  const lessonPath = join(cfg.dir, `lesson${lessonNo}.json`);
  if (!existsSync(lessonPath)) return { newWords: [], reviewWords: [] };
  const lesson = JSON.parse(readFileSync(lessonPath, "utf-8"));
  const pool = lesson.lessonWordPool || {};
  return {
    newWords: pool.newWords || [],
    reviewWords: pool.reviewWords || [],
  };
}

function loadLesson(course, lessonNo) {
  const path = join(COURSES[course].dir, `lesson${lessonNo}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ========== 场景与模板 ==========
function getScene(lessonScenes, course, lessonNo) {
  const map = lessonScenes[course] || lessonScenes.hsk1;
  return map[String(lessonNo)] || "general";
}

function selectTemplate(templates, scene) {
  const t = templates.templates?.[scene];
  if (t) return JSON.parse(JSON.stringify(t));
  return templates.templates?.time || [];
}

// ========== 占位符填充 ==========
const NOUN_CANDIDATES = ["人", "学生", "朋友", "同学", "苹果", "书", "爸爸", "妈妈", "老师", "医生", "学校", "商店", "衣服", "电脑", "桌子", "椅子", "火车站", "出租车", "飞机", "电影", "电视", "狗", "猫", "水", "米饭", "菜", "水果", "茶", "杯子", "饭馆", "东西"];
const NUMBER_CANDIDATES = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const VERB_CANDIDATES = ["回家", "吃饭", "学习", "睡觉", "买", "来", "去", "回", "吃", "喝", "看", "听"];
const TIME_CANDIDATES = ["下午", "上午", "中午"];

function pickFromPool(words, candidates, used) {
  for (const w of words) {
    if (candidates.includes(w) && !used.has(w)) return w;
  }
  for (const w of candidates) {
    if (words.includes(w) && !used.has(w)) return w;
  }
  for (const w of candidates) {
    if (!used.has(w)) return w;
  }
  return candidates[0];
}

function injectWords(templateCards, newWords, reviewWords) {
  const allWords = [...new Set([...reviewWords, ...newWords])];
  const used = new Set();
  const result = [];

  const pickNext = (candidates) => {
    for (const w of allWords) {
      if (candidates.includes(w) && !used.has(w)) { used.add(w); return w; }
    }
    for (const w of candidates) {
      if (!used.has(w)) { used.add(w); return w; }
    }
    return candidates[0];
  };

  const getReplacement = (type) => {
    if (type === "noun" || type === "place") return pickNext(NOUN_CANDIDATES);
    if (type === "number") return pickNext(NUMBER_CANDIDATES);
    if (type === "verb") return pickNext(VERB_CANDIDATES);
    if (type === "time") return pickNext(TIME_CANDIDATES);
    return "";
  };

  const replaceWithValues = (str, values) => {
    let i = 0;
    return str.replace(/\{(noun|number|verb|time|place)\}/g, () => values[i++] || "");
  };

  for (const card of templateCards) {
    const newCard = { title: card.title, lines: [] };
    for (const line of card.lines || []) {
      const zhRaw = line.zh || line.cn || "";
      const pyRaw = line.pinyin || "";
      const values = [];
      zhRaw.replace(/\{(noun|number|verb|time|place)\}/g, (_, type) => { values.push(getReplacement(type)); return ""; });
      const zh = replaceWithValues(zhRaw, values);
      const py = replaceWithValues(pyRaw, values) || zh;

      newCard.lines.push({
        speaker: line.speaker || "A",
        zh,
        pinyin: py,
        text: zh,
        translation: line.translation || { kr: zh, en: zh, jp: zh },
      });
    }
    result.push(newCard);
  }
  return result;
}

// ========== 覆盖率 ==========
function coverageCheck(dialogueCards, newWords) {
  const fullText = (dialogueCards || [])
    .flatMap((b) => {
      const lines = b.lines || (b.zh || b.cn ? [b] : []);
      return lines.map((l) => l.zh || l.cn || l.text || "");
    })
    .filter(Boolean)
    .join(" ");
  const inDialogue = newWords.filter((w) => fullText.includes(w));
  const notInDialogue = newWords.filter((w) => !fullText.includes(w));
  const coverage = newWords.length ? inDialogue.length / newWords.length : 1;
  return { coverage, inDialogue, notInDialogue };
}

// ========== 规则校验 ==========
function validateDialogue(dialogueCards, newWords) {
  const issues = [];
  const NUM_WORDS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  for (const card of dialogueCards || []) {
    for (const line of card.lines || []) {
      const zh = line.zh || line.cn || line.text || "";
      const numCount = NUM_WORDS.filter((w) => zh.includes(w)).length;
      if (numCount >= 4 && !/[几|个|块|点|岁]/.test(zh)) {
        issues.push({ type: "vocab_stacking", line: zh });
      }
    }
  }
  return issues;
}

// ========== 主流程 ==========
function generateDialogue(course, lessonNo) {
  const scenes = loadLessonScenes();
  const templates = loadDialogueTemplates();
  const wordPool = loadWordPool(course, lessonNo);

  if (wordPool.newWords.length === 0) return { cards: [], coverage: 1, notInDialogue: [] };

  const scene = getScene(scenes, course, lessonNo);
  const templateCards = selectTemplate(templates, scene);
  const cards = injectWords(templateCards, wordPool.newWords, wordPool.reviewWords);
  const { coverage, notInDialogue } = coverageCheck(cards, wordPool.newWords);

  return { cards, coverage, notInDialogue, scene };
}

function generatePractice(lesson, course, lessonNo) {
  return lesson.practice || [];
}

function buildLesson(lesson, dialogueCards, options = {}) {
  const out = { ...lesson };
  out.dialogueCards = dialogueCards;
  if (options.grammar !== undefined) out.grammar = options.grammar;
  if (options.extension !== undefined) out.extension = options.extension;
  if (options.practice !== undefined) out.practice = options.practice;
  return out;
}

// ========== CLI ==========
function main() {
  const args = process.argv.slice(2);
  const course = args.find((a) => a.startsWith("--course="))?.split("=")[1] || "hsk1";
  const lessonArg = args.find((a) => a.startsWith("--lesson="))?.split("=")[1];
  const dryRun = args.includes("--dry-run") || args.includes("-n");

  if (!lessonArg) {
    console.log(`
Lumina Pedagogy Engine v1

用法:
  node scripts/gen-course.mjs --course=hsk1 --lesson=8 [--dry-run]

流程: loadWordPool → loadScene → selectTemplate → injectWords → coverageCheck → buildLesson

课程结构: WordCard → Dialogue → Grammar → Extension → Practice → AI Tutor
`);
    return;
  }

  const lessonNo = parseInt(lessonArg, 10);
  const lesson = loadLesson(course, lessonNo);
  if (!lesson) {
    console.error("Lesson not found");
    process.exit(1);
  }

  const { cards, coverage, notInDialogue, scene } = generateDialogue(course, lessonNo);
  const issues = validateDialogue(cards, lesson.vocab?.map((w) => w.hanzi) || []);

  console.log(`\n=== gen:course Lesson ${lessonNo} (${course}) ===`);
  console.log(`场景: ${scene}`);
  console.log(`生成 ${cards.length} 组会话`);
  console.log(`覆盖率: ${Math.round(coverage * 100)}%`);
  if (notInDialogue.length > 0) console.log(`未进会话: ${notInDialogue.join(", ")}`);
  if (issues.length > 0) issues.forEach((i) => console.log(`⚠ ${i.type}: ${i.line}`));

  if (!dryRun && cards.length > 0) {
    const built = buildLesson(lesson, cards);
    const path = join(COURSES[course].dir, `lesson${lessonNo}.json`);
    writeFileSync(path, JSON.stringify(built, null, 2), "utf-8");
    console.log(`\n已写入 ${path}`);
  } else if (dryRun) {
    console.log("\n[dry-run] 未写入文件");
  }
}

main();
