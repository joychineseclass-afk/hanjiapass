/**
 * 따라 말하기：从 lesson 构建「单词 / 表达 / 句子」三层数据（不写死课文）
 * 仅保留练说所需：汉字、拼音、系统语言简短释义（不用法说明、不与 본과 설명 重复）
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";

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

/** 释义过长时截断（练说区只显示短译） */
function clipGloss(s, maxLen = 72) {
  const x = str(s);
  if (!x) return "";
  if (x.length <= maxLen) return x;
  return `${x.slice(0, Math.max(0, maxLen - 1))}…`;
}

/**
 * 从 translation 对象按系统语言取值，缺 key 时按常见回退（避免 CN 界面无译）
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

function lineZh(line) {
  return str(
    line?.zh != null ? line.zh : line?.cn != null ? line.cn : line?.text != null ? line.text : line?.line != null ? line.line : "",
  );
}

/**
 * 会话行 → 系统语言简短译文（来自 translation / 课文字段，不取 explain 长说明）
 */
function lineMeaningForShadowing(line, lang) {
  const tr = line?.translation;
  if (tr && typeof tr === "object") {
    const t = translationObjPick(tr, lang);
    if (t) return clipGloss(t, 96);
  }
  const k = normLang(lang);
  if (k === "kr") return clipGloss(str(line?.kr ?? line?.ko ?? ""), 96);
  if (k === "jp") return clipGloss(str(line?.jp ?? line?.ja ?? ""), 96);
  if (k === "en") return clipGloss(str(line?.en ?? ""), 96);
  if (k === "cn") return clipGloss(str(line?.cn ?? line?.zh ?? ""), 96);
  return "";
}

/**
 * 教材 extension 顶层的 kr/en/jp/zh 短译（不用 explain 段落）
 */
function meaningFromExtensionShort(ex, lang) {
  const k = normLang(lang);
  if (k === "kr") return str(ex?.kr ?? ex?.ko ?? "");
  if (k === "jp") return str(ex?.jp ?? ex?.ja ?? "");
  if (k === "en") return str(ex?.en ?? "");
  if (k === "cn") return str(ex?.cn ?? ex?.zhShort ?? "");
  return "";
}

/**
 * 与「本课核心表达」拆条对齐的汉字 → 各语言简短义项（非用法说明句）
 * 仅用于 curated 规则拆条，避免复用 ai.lesson_focus_group_usage_* 长说明
 */
const SHADOWING_LEX_GLOSS = {
  您: { kr: "당신(존칭)", cn: "您（敬称）", en: "you (polite)", jp: "あなた（敬）" },
  你: { kr: "너; 당신", cn: "你", en: "you", jp: "きみ" },
  您好: { kr: "안녕하세요", cn: "您好", en: "hello (polite)", jp: "こんにちは（丁寧）" },
  你好: { kr: "안녕", cn: "你好", en: "hello", jp: "こんにちは" },
  对不起: { kr: "미안합니다", cn: "对不起", en: "sorry", jp: "すみません" },
  没关系: { kr: "괜찮아요", cn: "没关系", en: "it's OK", jp: "大丈夫" },
  谢谢: { kr: "감사합니다", cn: "谢谢", en: "thank you", jp: "ありがとう" },
  不客气: { kr: "천만에요", cn: "不客气", en: "you're welcome", jp: "どういたしまして" },
  再见: { kr: "안녕히 가요", cn: "再见", en: "goodbye", jp: "さようなら" },
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

/**
 * 与 aiLessonFocus 检测条件对齐，但释义仅用简短词汇级翻译
 */
function buildCuratedExpressionItems(lesson, ctx, lang) {
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
      const gloss = glossLexeme(z, lang);
      out.push({
        zh: z,
        pinyin: resolvePinyin(z, manualPy),
        meaning: gloss,
        note: "",
      });
    });
  };

  if (/您|你/.test(joined) || /您|你/.test(pat)) {
    pushSplit("您 / 你", patPy || "nín / nǐ");
  }
  if (/您好/.test(joined) || /你好/.test(joined)) {
    pushSplit("您好 / 你好", "nín hǎo / nǐ hǎo");
  }
  if (/对不起/.test(joined) && /没关系/.test(joined)) {
    pushSplit("对不起 / 没关系", "duìbuqǐ / méi guānxi");
  }
  if (/谢谢/.test(joined) && /不客气/.test(joined)) {
    pushSplit("谢谢 / 不客气", "xièxie / bú kèqi");
  }

  if (out.length) return dedupeByZh(out.slice(0, 12));

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

function extensionExpressionItems(lesson, lang) {
  const ext = Array.isArray(lesson?.extension) ? lesson.extension : [];
  const out = [];
  for (const ex of ext) {
    const zhRaw = str(ex.zh ?? ex.phrase ?? "");
    if (!zhRaw || !/[\u4e00-\u9fff]/.test(zhRaw)) continue;
    const py = str(ex.pinyin ?? "");
    const zhOne = normalizeZhKey(zhRaw) || zhRaw.replace(/。$/g, "").trim();
    let mean = meaningFromExtensionShort(ex, lang);
    if (!mean) mean = glossLexeme(zhOne, lang);
    mean = clipGloss(mean, 72);
    out.push({
      zh: zhOne,
      pinyin: resolvePinyin(zhOne, py),
      meaning: mean,
      note: "",
    });
  }
  return dedupeByZh(out);
}

/**
 * @returns {{ words: object[], expressions: object[], sentences: object[] }}
 * 每项：{ zh, pinyin, meaning, type, id } — meaning 为系统语言简短译，无用法说明
 */
export function buildShadowingPracticeData(lesson, lang, _t) {
  const ctx = buildLessonContext(lesson, {
    lang,
    wordsWithMeaning: (w) => pickLang(w && w.meaning, lang) || str((w && (w.hanzi != null ? w.hanzi : w.word)) || ""),
  });

  const flatDialogue = getFlatLessonDialogue(lesson);

  const words = [];
  const seenWord = new Set();

  const pushWord = (zh, pyManual, mean) => {
    const z = str(zh);
    if (!z || !/[\u4e00-\u9fff]/.test(z) || seenWord.has(z)) return;
    seenWord.add(z);
    words.push({
      zh: z,
      pinyin: resolvePinyin(z, str(pyManual)),
      meaning: clipGloss(str(mean), 72),
      note: "",
    });
  };

  if (ctx.vocab && ctx.vocab.length) {
    for (const w of ctx.vocab) {
      pushWord(w.hanzi, w.pinyin, w.meaning);
    }
  } else {
    for (const line of flatDialogue) {
      const z = lineZh(line);
      if (!z || z.length > 4) continue;
      pushWord(z, line.pinyin ?? line.py, lineMeaningForShadowing(line, lang));
    }
  }

  let expressions = [];
  expressions = expressions.concat(buildCuratedExpressionItems(lesson, ctx, lang));
  expressions = expressions.concat(extensionExpressionItems(lesson, lang));
  expressions = dedupeByZh(expressions);

  const sentences = [];
  const seenSentZh = new Set();
  for (const line of flatDialogue) {
    const z = lineZh(line);
    if (!z || seenSentZh.has(z)) continue;
    seenSentZh.add(z);
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
  expressions.forEach((it, i) => {
    it.id = `shadow-e-${i}`;
    it.type = "expression";
  });
  sentences.forEach((it, i) => {
    it.id = `shadow-s-${i}`;
    it.type = "sentence";
  });

  return {
    words,
    expressions,
    sentences,
  };
}

/**
 * 顺序：单词 → 表达 → 句子（用于跟读队列）
 */
export function flattenShadowingPlaybackOrder(data) {
  const { words = [], expressions = [], sentences = [] } = data || {};
  return [...words, ...expressions, ...sentences].map((x) => str(x.zh)).filter(Boolean);
}
