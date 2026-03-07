#!/usr/bin/env node
/**
 * HSK1 Batch I18n - 批量补齐 lesson1~22 的 words/dialogue/grammar 多语言数据
 * 运行: node scripts/batch-hsk1-i18n.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HSK1_DIR = join(ROOT, "data/courses/hsk2.0/hsk1");
const GLOSSARY_JP = join(ROOT, "data/glossary/jp-hsk1.json");
const DIAG_TRANS = join(HSK1_DIR, "dialogue-translations.json");

const THEME_JP = {
  "打招呼": "あいさつ", "介绍名字": "名前の紹介", "国籍/国家": "国籍", "家庭": "家族",
  "家人": "家族", "数字与数量": "数字と数量", "数字①": "数字と数量", "年龄": "年齢",
  "日期": "日付", "时间": "時間", "打电话": "電話をかける", "问地点/在哪儿": "場所を聞く",
  "学校生活": "学校生活", "工作": "仕事", "爱好": "趣味", "饮食1": "飲食1", "饮食2": "飲食2",
  "位置/方向": "位置・方向", "交通/出行": "交通", "购物": "買い物", "天气": "天気",
  "看病/综合应用": "病院・総合", "复习1": "復習1", "复习2": "復習2", "国家": "国・国籍",
  "复习 1": "復習1", "复习 2": "復習2", "看病": "病院", "买东西": "買い物", "吃饭": "食事", "饮料": "飲み物", "学校": "学校", "在哪儿": "場所",
};

const POS_KR_TO_JP = { "명사": "名詞", "대명사": "代名詞", "동사": "動詞", "형용사": "形容詞",
  "부사": "副詞", "양사": "量詞", "조사": "助詞", "수사": "数詞", "감탄사": "感嘆詞", "접속사": "接続詞", "전치사": "前置詞", "의태어": "擬声語", "어기사": "語気詞" };
const POS_EN_TO_JP = { "noun": "名詞", "pronoun": "代名詞", "verb": "動詞", "adjective": "形容詞",
  "adverb": "副詞", "measure word": "量詞", "particle": "助詞", "numeral": "数詞", "interjection": "感嘆詞", "conjunction": "接続詞", "preposition": "前置詞" };

const GRAMMAR_JP = {
  "吗 — 一般疑问句": "平叙文の後に「吗」をつけると一般疑問文になります。",
  "很 + 形容词": "形容詞が述語になるとき、通常「很」を使います。",
  "叫 + 名字": "「叫」で名前を紹介したり聞いたりします。",
  "什么 — 疑问词": "「什么」は物や名前を聞くときに使います。",
  "A 是 B": "「是」は主語と目的語をつなぎ、同等であることを表します。",
  "不 + 是": "「是」の否定には「不」を使います。",
  "的 — 所属": "「的」は所有関係を表します。",
  "他 / 她": "「他」は男性、「她」は女性を指します。",
  "几 + 个": "「几」は少ない数量を聞き、「个」は量詞です。",
  "多少": "「多少」は数量や価格を聞きます。",
  "几 + 岁": "年齢を聞くときは「几岁」を使います。",
  "不 + 形容词": "形容詞の否定には「不」を使います。",
  "年 + 月 + 日": "日付の順序は年、月、日です。",
  "星期 + 数字": "「星期几」で曜日を聞きます。",
  "喂": "電話に出るときは「喂」を使います。",
  "谁 — 疑问词": "「谁」は人を聞くときに使います。",
  "在 + 地点": "「在」は存在や位置を表します。",
  "上 / 下 / 里": "方位詞：上、下、前面、后面、里。",
  "学习 + 宾语": "「学习」の後に学習内容が続きます。",
  "本 — 量词": "「本」は本に使う量詞です。",
  "做 + 工作": "「做」は仕事をすることを表します。",
  "能 / 会": "「能」は能力、「会」は〜できることを表します。",
  "吃 / 喝 + 宾语": "「吃」は固体、「喝」は液体に使います。",
  "和": "「和」は名詞をつなぎます。",
  "块": "「块」は人民元の単位です。",
  "东西": "「东西」は物を指します。",
  "来 / 去 / 回": "「来」は話者へ、「去」は離れる、「回」は帰る。",
  "有": "「有」は所有を表します。",
  "坐 + 交通工具": "「坐」の後に交通手段が続きます。",
  "都": "「都」は全部を表します。",
  "这 / 那": "「这」は近く、「那」は遠くを指します。",
  "呢": "「呢」は追及や話題転換に使います。",
  "太 + 形容词": "「太」は程度が高すぎることを表します。",
  "想 + 动词": "「想」の後に動詞が来ると、〜したいという意味になります。",
  "怎么": "「怎么」は方法を聞きます。",
  "没 + 有": "「有」の否定には「没」を使います。",
};

function loadJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch (e) { return null; }
}

function ensureTitleJp(lesson, lessonNo) {
  const vd = loadJson(join(ROOT, "data/courses/hsk2.0/hsk1/vocab-distribution.json"));
  const theme = vd?.lessonThemes?.[String(lessonNo)] || lesson.title?.zh;
  const jp = theme ? THEME_JP[theme] : null;
  if (!lesson.title) lesson.title = {};
  if (typeof lesson.title === "string") lesson.title = { zh: lesson.title };
  if (jp && !lesson.title.jp) lesson.title.jp = jp;
}

function ensureVocabJp(vocab, glossaryJp) {
  if (!Array.isArray(vocab) || !glossaryJp) return;
  for (const w of vocab) {
    const hanzi = (w.hanzi || w.word || "").trim();
    if (!hanzi) continue;
    if (!w.meaning) w.meaning = {};
    if (typeof w.meaning === "string") w.meaning = { zh: w.meaning };
    if (!w.meaning.jp) {
      const g = glossaryJp[hanzi];
      w.meaning.jp = (g && g.meaning) || "";
    }
    if (!w.pos) w.pos = {};
    if (typeof w.pos === "string") w.pos = { zh: w.pos };
    if (!w.pos.jp) {
      const g = glossaryJp[hanzi];
      w.pos.jp = (g && g.pos) || POS_KR_TO_JP[w.pos?.kr] || POS_EN_TO_JP[w.pos?.en] || "";
    }
  }
}

function ensureDialogueTranslation(cards, diagTrans) {
  if (!Array.isArray(cards)) return;
  for (const card of cards) {
    if (!card.title) card.title = {};
    const m = card.title.zh?.match(/\d+/);
    if (!card.title.jp && (card.title.zh || card.title.kr)) card.title.jp = "会話" + (m ? m[0] : "1");
    if (!card.lines) continue;
    for (const line of card.lines) {
      const zh = (line.text || line.zh || line.cn || "").trim();
      if (!zh) continue;
      if (!line.text) line.text = zh;
      if (!line.translation) line.translation = {};
      if (line.kr && !line.translation.kr) line.translation.kr = line.kr;
      if (line.en && !line.translation.en) line.translation.en = line.en;
      if (line.jp && !line.translation.jp) line.translation.jp = line.jp;
      const tr = diagTrans && diagTrans[zh];
      if (!line.translation.en && tr?.en) line.translation.en = tr.en;
      if (!line.translation.jp && tr?.jp) line.translation.jp = tr.jp;
    }
  }
}

function ensureGrammarJp(grammar) {
  if (!Array.isArray(grammar)) return;
  for (const g of grammar) {
    const title = (g.title || g.pattern || "").trim();
    if (!g.explain) g.explain = {};
    if (typeof g.explain === "string") g.explain = { zh: g.explain };
    if (g.explanation_jp && !g.explain.jp) g.explain.jp = g.explanation_jp;
    else if (!g.explain.jp && title && GRAMMAR_JP[title]) g.explain.jp = GRAMMAR_JP[title];
    if (g.explanation_en && typeof g.explain === "object" && !g.explain.en) g.explain.en = g.explanation_en;
    if (g.explanation_kr && typeof g.explain === "object" && !g.explain.kr) g.explain.kr = g.explanation_kr;
    if (g.explanation_zh && typeof g.explain === "object" && !g.explain.zh) g.explain.zh = g.explanation_zh;
  }
}

function processLesson(lessonNo, glossaryJp, diagTrans) {
  const path = join(HSK1_DIR, `lesson${lessonNo}.json`);
  const lesson = loadJson(path);
  if (!lesson) return false;
  ensureTitleJp(lesson, lessonNo);
  ensureVocabJp(lesson.vocab, glossaryJp);
  ensureDialogueTranslation(lesson.dialogueCards, diagTrans);
  ensureGrammarJp(lesson.grammar);
  writeFileSync(path, JSON.stringify(lesson, null, 2), "utf8");
  return true;
}

function main() {
  const glossaryJp = loadJson(GLOSSARY_JP) || {};
  const diagTrans = loadJson(DIAG_TRANS) || {};
  console.log("[batch-hsk1-i18n] Processing lesson1~22...");
  for (let i = 1; i <= 22; i++) {
    const ok = processLesson(i, glossaryJp, diagTrans);
    console.log(ok ? `  lesson${i}.json OK` : `  lesson${i}.json skip`);
  }
  console.log("[batch-hsk1-i18n] Done.");
}

main();
