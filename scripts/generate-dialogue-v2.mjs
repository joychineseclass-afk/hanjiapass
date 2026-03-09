#!/usr/bin/env node
/**
 * Lumina Dialogue Engine v2
 * 教材级会话生成：Scene → Dialogue → WordPool
 *
 * 流程：WordPool → detectScene() → generateDialogue() → coverageCheck() → autoAdjust()
 * 规则：场景驱动、对话逻辑链、2~3组会话、新词覆盖率≥80%
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ========== 配置 ==========
const COURSES = {
  hsk1: {
    dir: join(ROOT, "data/courses/hsk2.0/hsk1"),
    vocabSource: "vocab-distribution.json",
    maxLessons: 20,
  },
  hsk2: {
    dir: join(ROOT, "data/courses/hsk2.0/hsk2"),
    vocabSource: "lessonWordPool",
    maxLessons: 22,
  },
};

// ========== 规则1：场景识别 ==========
const SCENE_KEYWORDS = {
  time: ["时间", "几点", "点", "分钟", "上午", "下午", "中午", "现在", "时候", "Time", "o'clock"],
  introduce: ["介绍", "朋友", "同学", "家人", "这是", "谁", "Introduce", "friend", "family"],
  shopping: ["买", "钱", "商店", "多少", "块", "Shopping", "buy", "store"],
  daily: ["做什么", "周末", "聊天", "Daily", "do what", "weekend"],
  study: ["学校", "学习", "读", "书", "写", "汉语", "School", "study", "read"],
  travel: ["出租车", "飞机", "火车站", "来", "去", "回", "Travel", "taxi", "airport"],
  food: ["吃", "喝", "菜", "米饭", "饭馆", "茶", "杯子", "Food", "eat", "drink"],
  weather: ["天气", "热", "冷", "下雨", "Weather", "hot", "cold"],
  location: ["在", "哪儿", "里", "前面", "后面", "住", "Location", "where"],
  number: ["一", "二", "三", "几", "个", "多少", "Number", "how many"],
  greeting: ["你好", "谢谢", "再见", "Greeting", "hello"],
  phone: ["打电话", "喂", "请", "Phone", "call"],
  work: ["工作", "医生", "先生", "小姐", "做", "Work", "job"],
  hobby: ["喜欢", "爱", "看", "听", "电影", "Hobby", "like"],
  health: ["医院", "怎么", "怎么样", "Health", "hospital"],
};

/**
 * 根据课程标题、主题、摘要识别场景
 * 优先使用 data/pedagogy/lesson-scenes.json 若存在
 */
function detectScene(lesson, lessonNo, course) {
  try {
    const scenesPath = join(ROOT, "data/pedagogy/lesson-scenes.json");
    if (existsSync(scenesPath)) {
      const scenes = JSON.parse(readFileSync(scenesPath, "utf-8"));
      const map = scenes[course] || scenes.hsk1;
      const s = map?.[String(lessonNo)];
      if (s && s !== "review") return s;
    }
  } catch (_) {}
  const title = typeof lesson.title === "object"
    ? (lesson.title.zh || lesson.title.cn || lesson.title.en || "")
    : String(lesson.title || "");
  const theme = course === "hsk1" && lessonNo ? getHSK1Theme(lessonNo) : "";
  const summary = typeof lesson.summary === "object" ? (lesson.summary.zh || lesson.summary.en || "") : "";
  const text = [title, theme, summary].filter(Boolean).join(" ");
  let best = { scene: "general", score: 0 };
  for (const [scene, keywords] of Object.entries(SCENE_KEYWORDS)) {
    const score = keywords.filter((k) => text.includes(k)).length;
    if (score > best.score) best = { scene, score };
  }
  return best.scene;
}

function getHSK1Theme(lessonNo) {
  const themes = {
    1: "打招呼", 2: "介绍名字", 3: "国籍/国家", 4: "家庭", 5: "数字与数量",
    6: "年龄", 7: "日期", 8: "时间", 9: "打电话", 10: "问地点/在哪儿",
    11: "学校生活", 12: "工作", 13: "爱好", 14: "饮食1", 15: "饮食2",
    16: "位置/方向", 17: "交通/出行", 18: "购物", 19: "天气", 20: "看病/综合应用",
  };
  return themes[lessonNo] || "";
}

// ========== 规则2~4：词汇池与覆盖率 ==========
function getWordPool(lesson, lessonNo, course) {
  if (course === "hsk1") {
    const distPath = join(COURSES.hsk1.dir, "vocab-distribution.json");
    const dist = JSON.parse(readFileSync(distPath, "utf-8"));
    const newWords = dist.distribution?.[`lesson${lessonNo}`] || [];
    const reviewWords = [];
    for (let i = 1; i < lessonNo; i++) {
      reviewWords.push(...(dist.distribution?.[`lesson${i}`] || []));
    }
    return { newWords, reviewWords };
  }
  const pool = lesson.lessonWordPool || {};
  return {
    newWords: pool.newWords || [],
    reviewWords: pool.reviewWords || [],
  };
}

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

/**
 * 覆盖率检测
 * @returns {{ coverage: number, inDialogue: string[], notInDialogue: string[] }}
 */
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

// ========== 规则5~8：质量检测 ==========
const NUM_WORDS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "零"];

/**
 * 检测词汇堆叠、无场景句、断裂对话
 * @returns {{ issues: Array<{ type: string, detail: string, line?: string }> }}
 */
function dialogueQualityCheck(dialogueCards, newWords) {
  const issues = [];
  const cards = dialogueCards || [];

  for (const card of cards) {
    const lines = card.lines || (card.zh || card.cn ? [card] : []);
    for (let i = 0; i < lines.length; i++) {
      const zh = lines[i].zh || lines[i].cn || lines[i].text || "";

      // 规则5：数字词堆叠（禁止 一二三四五六...）
      const numCount = NUM_WORDS.filter((w) => zh.includes(w)).length;
      if (numCount >= 4 && !/[几|个|块|点|岁]/.test(zh)) {
        issues.push({
          type: "vocab_stacking",
          detail: `数字词堆叠（${numCount}个）未绑定名词`,
          line: zh,
        });
      }

      // 规则6：时段词(上午/下午/中午/晚上)未绑定事件时提示（现在X点 作为回答可接受）
      if (/上午|下午|中午|晚上/.test(zh) && /[点分]/.test(zh)) {
        if (!/回家|吃饭|上课|睡觉|去|来|做/.test(zh) && zh.length < 15) {
          issues.push({
            type: "time_unbound",
            detail: "时段+时间宜绑定事件（如：下午三点回家）",
            line: zh,
          });
        }
      }

      // 规则7：关系词堆叠（他是我的朋友，也是我同学 → 应拆开）
      if (/他.*是.*我.*(朋友|同学)/.test(zh) && /也.*是/.test(zh)) {
        if (zh.split("，").length >= 2 && zh.length > 15) {
          issues.push({
            type: "relation_stacking",
            detail: "人物关系宜拆开为多轮对话",
            line: zh,
          });
        }
      }
    }

    // 规则2：对话逻辑链（A问→B答→A延伸→B答）
    if (lines.length >= 2) {
      const speakers = lines.map((l) => l.speaker);
      const hasQuestion = lines.some((l) => {
        const t = l.zh || l.cn || l.text || "";
        return /[？?吗呢]/.test(t) || t.endsWith("？");
      });
      if (!hasQuestion && lines.length >= 3) {
        issues.push({
          type: "no_question",
          detail: "会话应包含问句形成逻辑链",
          line: card.title?.zh || card.title?.cn || "会话",
        });
      }
    }
  }

  return { issues };
}

// ========== 生成逻辑（模板驱动，可扩展 AI） ==========
function createLine(speaker, zh, pinyin, kr, en, jp) {
  return {
    speaker,
    zh,
    pinyin: pinyin || zh,
    kr: kr || zh,
    text: zh,
    translation: { kr: kr || zh, en: en || zh, jp: jp || zh },
  };
}

/**
 * 根据场景和词汇池生成对话（模板模式）
 * 会话1 约40%，会话2 约30%，会话3 补充剩余
 */
function generateDialogue(scene, wordPool, options = {}) {
  const { newWords = [], reviewWords = [] } = wordPool;
  const allWords = [...new Set([...reviewWords, ...newWords])];
  const cards = [];

  // 分配词汇到三组
  const n = newWords.length;
  const s1 = Math.ceil(n * 0.4);
  const s2 = Math.ceil(n * 0.3);
  const w1 = newWords.slice(0, s1);
  const w2 = newWords.slice(s1, s1 + s2);
  const w3 = newWords.slice(s1 + s2);

  const pick = (arr, count) => arr.sort(() => Math.random() - 0.5).slice(0, count);

  if (scene === "time" && w1.some((w) => ["点", "分钟", "现在", "上午", "下午", "中午", "时候"].includes(w))) {
    cards.push({
      title: { zh: "会话1", kr: "회화1", en: "Session 1", jp: "会話1" },
      lines: [
        createLine("A", "现在几点？", "Xiànzài jǐ diǎn?", null, "What time is it now?", null),
        createLine("B", "现在三点。", "Xiànzài sān diǎn.", null, "It's three o'clock.", null),
      ],
    });
    cards.push({
      title: { zh: "会话2", kr: "회화2", en: "Session 2", jp: "会話2" },
      lines: [
        createLine("A", "你什么时候回家？", "Nǐ shénme shíhou huí jiā?", null, "When do you go home?", null),
        createLine("B", "我下午回家。", "Wǒ xiàwǔ huí jiā.", null, "I go home in the afternoon.", null),
      ],
    });
    if (w3.some((w) => ["分钟", "中午"].includes(w))) {
      cards.push({
        title: { zh: "会话3", kr: "회화3", en: "Session 3", jp: "会話3" },
        lines: [
          createLine("A", "现在几点？", "Xiànzài jǐ diǎn?", null, "What time is it now?", null),
          createLine("B", "三点十五分钟。中午十二点。", "Sān diǎn shíwǔ fēnzhōng. Zhōngwǔ shí'èr diǎn.", null, "3:15. Noon.", null),
        ],
      });
    }
  }

  if (scene === "number" && w1.some((w) => ["几", "个", "多少"].includes(w))) {
    const noun = w1.find((w) => ["苹果", "学生", "人", "书", "杯子"].includes(w)) || "人";
    cards.push({
      title: { zh: "会话1", kr: "회화1", en: "Session 1", jp: "会話1" },
      lines: [
        createLine("A", `你有几个${noun}？`, null, null, `How many ${noun} do you have?`, null),
        createLine("B", "我有三个。", null, null, "I have three.", null),
      ],
    });
  }

  // 通用补充：若模板未覆盖足够词，添加简单会话
  const covered = new Set();
  for (const c of cards) {
    for (const l of c.lines || []) {
      const t = l.zh || l.cn || l.text || "";
      newWords.forEach((w) => { if (t.includes(w)) covered.add(w); });
    }
  }
  const missing = newWords.filter((w) => !covered.has(w));
  if (missing.length > 0 && cards.length < 3) {
    cards.push({
      title: { zh: "会话" + (cards.length + 1), kr: "회화" + (cards.length + 1), en: "Session " + (cards.length + 1), jp: "会話" + (cards.length + 1) },
      lines: missing.slice(0, 4).map((w, i) =>
        createLine(i % 2 === 0 ? "A" : "B", `${w}。`, null, null, `${w}.`, null)
      ).slice(0, 4),
    });
  }

  return cards;
}

/**
 * 覆盖率不足时自动补充会话
 */
function autoAdjust(dialogueCards, newWords, targetCoverage = 0.8) {
  const { coverage, notInDialogue } = coverageCheck(dialogueCards, newWords);
  if (coverage >= targetCoverage || notInDialogue.length === 0) return dialogueCards;

  const supplement = {
    title: { zh: "会话补充", kr: "회화 보충", en: "Session Supplement", jp: "会話補足" },
    lines: notInDialogue.slice(0, 4).map((w, i) =>
      createLine(i % 2 === 0 ? "A" : "B", i % 2 === 0 ? `你喜欢${w}吗？` : `喜欢。`, null, null, i % 2 === 0 ? `Do you like ${w}?` : `Yes.`, null)
    ),
  };
  return [...(dialogueCards || []), supplement];
}

// ========== CLI ==========
function loadLesson(course, lessonNo) {
  const cfg = COURSES[course];
  const path = join(cfg.dir, `lesson${lessonNo}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function runCheck(course) {
  const cfg = COURSES[course];
  const isHSK1 = course === "hsk1";
  const maxLessons = isHSK1 ? 20 : 22;

  console.log(`\n=== Dialogue Engine v2 检查 (${course.toUpperCase()}) ===\n`);

  let totalCoverage = 0;
  let lessonCount = 0;
  const below80 = [];

  for (let no = 1; no <= maxLessons; no++) {
    const lesson = loadLesson(course, no);
    if (!lesson || lesson.type === "review") continue;

    const wordPool = getWordPool(lesson, no, course);
    const newWords = wordPool.newWords;
    if (newWords.length === 0) continue;

    const dialogueCards = lesson.dialogueCards || lesson.dialogue || [];
    const { coverage, inDialogue, notInDialogue } = coverageCheck(dialogueCards, newWords);
    const quality = dialogueQualityCheck(dialogueCards, newWords);

    const pct = Math.round(coverage * 100);
    totalCoverage += coverage;
    lessonCount++;
    const status = pct >= 80 ? "✓" : "✗";
    console.log(`Lesson ${no}: ${pct}% (${inDialogue.length}/${newWords.length}) ${status} 场景:${detectScene(lesson, no, course)}`);
    if (pct < 80) below80.push({ no, notInDialogue });
    if (quality.issues.length > 0) {
      quality.issues.forEach((i) => console.log(`  ⚠ ${i.type}: ${i.detail}`));
    }
  }

  console.log(`\n--- 汇总 ---`);
  console.log(`会话数量: 每课 2~3 组`);
  console.log(`覆盖率: ${lessonCount ? Math.round((totalCoverage / lessonCount) * 100) : 0}% 平均`);
  console.log(`未达标(<80%): ${below80.length} 课`);
  if (below80.length > 0) {
    console.log(`\n未达标课程及未进会话词:`);
    below80.forEach(({ no, notInDialogue }) => console.log(`  Lesson ${no}: ${notInDialogue.join(", ")}`));
  }
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check") || args.includes("-c");
  const courseArg = args.find((a) => a.startsWith("--course="))?.split("=")[1];
  const course = courseArg || "hsk1";
  const lessonArg = args.find((a) => a.startsWith("--lesson="))?.split("=")[1];

  if (checkOnly || !lessonArg) {
    for (const c of courseArg ? [course] : ["hsk1", "hsk2"]) {
      runCheck(c);
    }
    return;
  }

  const lessonNo = parseInt(lessonArg, 10);
  const lesson = loadLesson(course, lessonNo);
  if (!lesson) {
    console.error("Lesson not found");
    process.exit(1);
  }

  const scene = detectScene(lesson, lessonNo, course);
  const wordPool = getWordPool(lesson, lessonNo, course);
  console.log(`Lesson ${lessonNo} 场景: ${scene}`);
  console.log(`新词: ${wordPool.newWords.join(", ")}`);

  const generated = generateDialogue(scene, wordPool);
  const adjusted = autoAdjust(generated, wordPool.newWords);
  const { coverage } = coverageCheck(adjusted, wordPool.newWords);
  console.log(`生成 ${adjusted.length} 组会话，覆盖率 ${Math.round(coverage * 100)}%`);

  const dryRun = args.includes("--dry-run");
  if (!dryRun) {
    lesson.dialogueCards = adjusted;
    const path = join(COURSES[course].dir, `lesson${lessonNo}.json`);
    writeFileSync(path, JSON.stringify(lesson, null, 2), "utf-8");
    console.log(`已写入 ${path}`);
  }
}

main();
