/**
 * 따라 말하기：单词区 + 句子区（无单独「表达」区块）
 * 汉字/拼音固定；释义严格跟随系统语言；句子区与单词区按规范化汉字去重
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { getAiLearning, pickLessonLang } from "./aiLearningShared.js";

const str = (v) => (typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "");

function normLang(lang) {
  const l = String(lang || "kr").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "ko" || l === "kr") return "kr";
  if (l === "jp" || l === "ja") return "jp";
  return "en";
}

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const k = normLang(lang);
  const key = k === "cn" ? "zh" : k === "kr" ? "kr" : k === "jp" ? "jp" : "en";
  return str(obj[key] ?? obj.zh ?? obj.cn ?? obj.kr ?? obj.en ?? obj.jp ?? "");
}

function clipGloss(s, maxLen = 72) {
  const x = str(s);
  if (!x) return "";
  if (x.length <= maxLen) return x;
  return `${x.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** 释义是否与汉字本体重复（禁止第三列再显示一遍中文） */
function isTrivialEchoOfZh(zh, gloss) {
  const z = normalizeZhKey(str(zh));
  const g = normalizeZhKey(str(gloss));
  if (!g) return true;
  return z === g;
}

/** 嵌套多语言对象：按当前 UI 语言优先（如 CN 缺 zh 时先 en，再 jp，再 kr） */
function pickNestedByUiLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const n = normLang(lang);
  if (n === "cn") return str(obj.zh ?? obj.cn ?? obj.en ?? obj.jp ?? obj.ja ?? obj.kr ?? obj.ko ?? "");
  if (n === "kr") return str(obj.kr ?? obj.ko ?? obj.en ?? obj.jp ?? obj.zh ?? obj.cn ?? "");
  if (n === "jp") return str(obj.jp ?? obj.ja ?? obj.en ?? obj.kr ?? obj.zh ?? obj.cn ?? "");
  return str(obj.en ?? obj.kr ?? obj.jp ?? obj.zh ?? obj.cn ?? "");
}

/**
 * 单词区第三列：仅从多语言字段 / 词汇表取义，不回退为 hanzi/zh
 * 优先级：translation → meaning → gloss → explain → 顶层 kr 等 → 内置词汇表（非重复时）
 */
function pickWordMeaningFromItem(o, zhCanon, lang) {
  if (o == null) {
    const g = glossLexeme(str(zhCanon), lang);
    return g && !isTrivialEchoOfZh(zhCanon, g) ? clipGloss(g, 72) : "";
  }
  if (typeof o !== "object") {
    const g = glossLexeme(str(zhCanon), lang);
    return g && !isTrivialEchoOfZh(zhCanon, g) ? clipGloss(g, 72) : "";
  }

  const tr = o.translation ?? o.translations;
  let t = "";
  if (tr && typeof tr === "object") {
    t = pickNestedByUiLang(tr, lang);
  }
  const m = o.meaning;
  if (!t && m && typeof m === "object") {
    t = pickNestedByUiLang(m, lang);
  }
  if (!t && m && typeof m === "string" && m.trim()) {
    t = str(m);
  }
  const gl = o.gloss;
  if (!t && gl && typeof gl === "object") {
    t = pickNestedByUiLang(gl, lang);
  }
  if (!t) {
    const n = normLang(lang);
    if (n === "kr") t = str(o.kr ?? o.ko ?? "");
    else if (n === "jp") t = str(o.jp ?? o.ja ?? "");
    else if (n === "en") t = str(o.en ?? "");
    else if (n === "cn") t = str(o.cn ?? o.zh ?? o.zhShort ?? "");
  }
  const ex = o.explain ?? o.explanation;
  if (!t && ex && typeof ex === "object") {
    t = pickNestedByUiLang(ex, lang);
  }
  if (!t) {
    t = str(o.translation?.kr ?? o.translations?.kr ?? o.meaning?.kr ?? o.gloss?.kr ?? "");
  }
  if (t && !isTrivialEchoOfZh(zhCanon, t)) return clipGloss(t, 72);

  const g = glossLexeme(str(zhCanon), lang);
  if (g && !isTrivialEchoOfZh(zhCanon, g)) return clipGloss(g, 72);
  return "";
}

function wordAreaMeaningFromVocab(w, lang) {
  const han = str(w?.hanzi ?? w?.word ?? "");
  const zhCanon = normalizeZhKey(han) || han;
  return pickWordMeaningFromItem(w, zhCanon, lang);
}

function wordAreaMeaningFromDialogueLine(line, lang) {
  const z = lineZh(line);
  const zhCanon = normalizeZhKey(z) || z;
  return pickWordMeaningFromItem(line, zhCanon, lang);
}

/**
 * 从 translation / translations 对象按系统语言取值
 */
function translationObjPick(tr, lang) {
  if (!tr || typeof tr !== "object") return "";
  const l = normLang(lang);
  const order =
    l === "kr"
      ? ["kr", "ko", "en", "jp", "ja", "zh", "cn"]
      : l === "jp"
        ? ["jp", "ja", "en", "kr", "ko", "zh", "cn"]
        : l === "cn"
          ? ["zh", "cn", "en", "kr", "ko", "jp", "ja"]
          : ["en", "kr", "ko", "jp", "ja", "zh", "cn"];
  for (const k of order) {
    const v = str(tr[k]);
    if (v) return v;
  }
  return "";
}

function getFlatLessonDialogue(lesson) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const flat = cards.flatMap((c) => (Array.isArray(c?.lines) ? c.lines : []));
  if (flat.length) return flat;
  return Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
}

function getRawVocab(lesson) {
  return Array.isArray(lesson?.vocab) ? lesson.vocab : Array.isArray(lesson?.words) ? lesson.words : [];
}

function lineZh(line) {
  return str(
    line?.zh != null ? line.zh : line?.cn != null ? line.cn : line?.text != null ? line.text : line?.line != null ? line.line : "",
  );
}

function lineMeaningForShadowing(line, lang) {
  const z = lineZh(line);
  const tr = line?.translation ?? line?.translations;
  if (tr && typeof tr === "object") {
    let t = "";
    if (normLang(lang) === "cn") {
      t = str(tr.zh ?? tr.cn ?? "");
      if (!t) t = glossLexeme(normalizeZhKey(z), lang);
      if (!t) t = translationObjPick(tr, lang);
    } else {
      t = translationObjPick(tr, lang);
    }
    if (t) return clipGloss(t, 96);
  }
  const k = normLang(lang);
  if (k === "kr") return clipGloss(str(line?.kr ?? line?.ko ?? ""), 96);
  if (k === "jp") return clipGloss(str(line?.jp ?? line?.ja ?? ""), 96);
  if (k === "en") return clipGloss(str(line?.en ?? ""), 96);
  if (k === "cn") return clipGloss(str(line?.cn ?? line?.zh ?? "") || glossLexeme(normalizeZhKey(z), lang), 96);
  return "";
}

const SHADOWING_LEX_GLOSS = {
  您: { kr: "당신(존칭)", cn: "您（敬称）", en: "you (polite)", jp: "あなた（敬）" },
  你: { kr: "너; 당신", cn: "你", en: "you", jp: "きみ" },
  您好: { kr: "안녕하세요", cn: "您好", en: "hello (polite)", jp: "こんにちは（丁寧）" },
  你好: { kr: "안녕하세요; 안녕", cn: "你好", en: "hello", jp: "こんにちは" },
  对不起: { kr: "미안합니다", cn: "对不起", en: "sorry", jp: "すみません" },
  没关系: { kr: "괜찮아요", cn: "没关系", en: "it's OK", jp: "大丈夫" },
  谢谢: { kr: "감사합니다", cn: "谢谢", en: "thank you", jp: "ありがとう" },
  不客气: { kr: "천만에요", cn: "不客气", en: "you're welcome", jp: "どういたしまして" },
  再见: { kr: "안녕히 가세요", cn: "再见", en: "goodbye", jp: "さようなら" },
  老师: { kr: "선생님", cn: "老师", en: "teacher", jp: "先生" },
  好: { kr: "좋다", cn: "好", en: "good", jp: "よい" },
  大家好: { kr: "여러분 안녕하세요", cn: "大家好", en: "hello everyone", jp: "みなさんこんにちは" },
};

function glossLexeme(zhToken, lang) {
  const row = SHADOWING_LEX_GLOSS[str(zhToken)];
  if (!row) return "";
  const k = normLang(lang);
  const key = k === "cn" ? "cn" : k === "kr" ? "kr" : k === "jp" ? "jp" : "en";
  return str(row[key] ?? row.en ?? "");
}

function normalizeZhKey(zhRaw) {
  return str(zhRaw).replace(/[。！？，、．·…\s]/g, "");
}

function buildCuratedExpressionItems(lesson, ctx, lang) {
  const al = getAiLearning(lesson);
  if (al?.coreExpressions?.length && Array.isArray(al.coreExpressions)) {
    const out = [];
    for (const ce of al.coreExpressions.slice(0, 8)) {
      const expr = str(ce.expr != null ? ce.expr : ce.pattern);
      if (!expr || !/[\u4e00-\u9fff]/.test(expr)) continue;
      const py = str(ce.pinyin != null ? ce.pinyin : "");
      const mean = ce.usage && typeof ce.usage === "object" ? pickLessonLang(ce.usage, lang) : str(ce.usage);
      out.push({
        zh: expr.trim(),
        pinyin: py,
        meaning: mean || "",
        note: "",
      });
    }
    if (out.length) return dedupeByZh(out).slice(0, 20);
  }

  const joined = (ctx.dialogue || []).map((d) => str(d.zh)).join("");
  const g0 = Array.isArray(lesson?.grammar) ? lesson.grammar[0] : null;
  const pat = str(g0?.pattern != null ? g0.pattern : "");
  const patPy = str(g0?.pinyin != null ? g0.pinyin : "");
  const out = [];

  const pushSplit = (expr, py) => {
    const zs = str(expr)
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const pys = str(py)
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    zs.forEach((z, i) => {
      if (!/[\u4e00-\u9fff]/.test(z)) return;
      const manualPy = pys[i] || pys[0] || "";
      out.push({
        zh: z,
        pinyin: resolvePinyin(z, manualPy),
        meaning: pickWordMeaningFromItem(null, z, lang),
        note: "",
      });
    });
  };

  const lessonNo = Number(lesson?.lessonNo);
  const l1StyleGreeting =
    lessonNo === 1 || (lessonNo <= 1 && (/您好/.test(joined) || /王老师/.test(joined)));

  if (/您|你/.test(joined) || /您|你/.test(pat)) {
    pushSplit("您 / 你", patPy || "nín / nǐ");
  }
  if (l1StyleGreeting && (/您好/.test(joined) || /你好/.test(joined))) {
    pushSplit("您好 / 你好", "nín hǎo / nǐ hǎo");
  }
  if (/对不起/.test(joined) && /没关系/.test(joined)) {
    pushSplit("对不起 / 没关系", "duìbuqǐ / méi guānxi");
  }
  if (/谢谢/.test(joined) && /不客气/.test(joined)) {
    pushSplit("谢谢 / 不客气", "xièxie / bú kèqi");
  }

  if (out.length) return dedupeByZh(out.slice(0, 20));

  return [];
}

function dedupeByZh(items) {
  const seen = new Set();
  const r = [];
  for (const it of items) {
    const k = str(it.zh);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    r.push(it);
  }
  return r;
}

/** 单词区：同一汉字串只保留一条（去掉句读后与「谢谢」「谢谢！」合并） */
function dedupeWordItemsByCanonicalZh(items) {
  const seen = new Set();
  const r = [];
  for (const it of items) {
    const canon = normalizeZhKey(str(it.zh)) || str(it.zh).trim();
    if (!canon || !/[\u4e00-\u9fff]/.test(canon) || seen.has(canon)) continue;
    seen.add(canon);
    r.push({
      ...it,
      zh: canon,
      pinyin: str(it.pinyin) || resolvePinyin(canon, ""),
    });
  }
  return r;
}

function extensionExpressionItems(lesson, lang) {
  const ext = Array.isArray(lesson?.extension) ? lesson.extension : [];
  const out = [];
  for (const ex of ext) {
    const zhRaw = str(ex.zh ?? ex.phrase ?? "");
    if (!zhRaw || !/[\u4e00-\u9fff]/.test(zhRaw)) continue;
    const py = str(ex.pinyin ?? "");
    const zhOne = normalizeZhKey(zhRaw) || zhRaw.replace(/。$/g, "").trim();
    out.push({
      zh: zhOne,
      pinyin: resolvePinyin(zhOne, py),
      meaning: pickWordMeaningFromItem(ex, zhOne, lang),
      note: "",
    });
  }
  return dedupeByZh(out);
}

/**
 * @returns {{ words: object[], sentences: object[] }}
 */
export function buildShadowingPracticeData(lesson, lang, _t) {
  const ctx = buildLessonContext(lesson, {
    lang,
    wordsWithMeaning: (w) => wordAreaMeaningFromVocab(w, lang),
  });

  const flatDialogue = getFlatLessonDialogue(lesson);
  const rawVocab = getRawVocab(lesson);

  const wordParts = [];

  if (rawVocab.length) {
    for (const w of rawVocab.slice(0, 40)) {
      const han = str(w.hanzi ?? w.word ?? "");
      if (!han || !/[\u4e00-\u9fff]/.test(han)) continue;
      wordParts.push({
        zh: han,
        pinyin: resolvePinyin(han, str(w.pinyin ?? w.py ?? "")),
        meaning: wordAreaMeaningFromVocab(w, lang),
        note: "",
      });
    }
  } else {
    for (const line of flatDialogue) {
      const z = lineZh(line);
      if (!z || z.length > 4 || !/[\u4e00-\u9fff]/.test(z)) continue;
      wordParts.push({
        zh: z,
        pinyin: resolvePinyin(z, str(line.pinyin ?? line.py ?? "")),
        meaning: wordAreaMeaningFromDialogueLine(line, lang),
        note: "",
      });
    }
  }

  wordParts.push(...buildCuratedExpressionItems(lesson, ctx, lang));
  wordParts.push(...extensionExpressionItems(lesson, lang));

  const words = dedupeWordItemsByCanonicalZh(wordParts);

  const spokenWordSet = new Set(words.map((w) => str(w.zh)).filter(Boolean));

  const sentences = [];
  const seenSentZh = new Set();
  for (const line of flatDialogue) {
    const z = lineZh(line);
    if (!z || seenSentZh.has(z)) continue;
    seenSentZh.add(z);
    const key = normalizeZhKey(z);
    if (key && spokenWordSet.has(key)) continue;
    sentences.push({
      zh: z,
      pinyin: resolvePinyin(z, str(line.pinyin != null ? line.pinyin : line.py) || ""),
      meaning: lineMeaningForShadowing(line, lang),
      speaker: "",
      note: "",
    });
  }

  words.forEach((it, i) => {
    it.id = `shadow-w-${i}`;
    it.type = "word";
  });
  sentences.forEach((it, i) => {
    it.id = `shadow-s-${i}`;
    it.type = "sentence";
  });

  return {
    words,
    sentences,
  };
}

export function flattenShadowingPlaybackOrder(data) {
  const { words = [], sentences = [] } = data || {};
  return [...words, ...sentences].map((x) => str(x.zh)).filter(Boolean);
}
