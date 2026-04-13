/**
 * 따라 말하기：从 lesson 构建「单词 / 表达 / 句子」三层数据（不写死课文）
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

/**
 * 从 extension 条目中取释义（系统语言）
 */
function meaningFromExtension(ex, lang) {
  const k = normLang(lang);
  if (k === "kr") return str(ex.kr ?? ex.ko);
  if (k === "cn") return str(ex.zh ?? ex.cn);
  if (k === "jp") return str(ex.jp ?? ex.ja);
  return str(ex.en);
}

/**
 * 与 aiLessonFocus collectCuratedExpressionGroups 对齐：生成本课核心表达（可拆成多条短卡）
 * @param {(key: string, fb?: string) => string} t
 */
function buildCuratedExpressionItems(lesson, ctx, lang, t) {
  const joined = (ctx.dialogue || []).map((d) => str(d.zh)).join("");
  const g0 = Array.isArray(lesson?.grammar) ? lesson.grammar[0] : null;
  const pat = str(g0?.pattern != null ? g0.pattern : "");
  const patPy = str(g0?.pinyin != null ? g0.pinyin : "");
  const out = [];

  const pushSplit = (expr, py, meaning) => {
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
        meaning: str(meaning),
        note: "",
      });
    });
  };

  if (/您|你/.test(joined) || /您|你/.test(pat)) {
    pushSplit("您 / 你", patPy || "nín / nǐ", t("ai.lesson_focus_group_usage_nin_ni", "按对象选用敬称「您」或一般「你」。"));
  }
  if (/您好/.test(joined) || /你好/.test(joined)) {
    pushSplit("您好 / 你好", "nín hǎo / nǐ hǎo", t("ai.lesson_focus_group_usage_greeting", "「您好」更正式；「你好」常用于平辈、同学。"));
  }
  if (/对不起/.test(joined) && /没关系/.test(joined)) {
    pushSplit("对不起 / 没关系", "duìbuqǐ / méi guānxi", t("ai.lesson_focus_group_usage_apology", "道歉后，对方常接「没关系」。"));
  }
  if (/谢谢/.test(joined) && /不客气/.test(joined)) {
    pushSplit("谢谢 / 不客气", "xièxie / bú kèqi", t("ai.lesson_focus_group_usage_thanks", "致谢后，对方常接「不客气」。"));
  }

  if (out.length) return dedupeByZh(out.slice(0, 12));

  const patStr = str(g0?.pattern);
  const isPlaceholderGrammar =
    !patStr || /暂无|没有重点|no grammar|N\/A/i.test(patStr) || patStr.length > 40;
  if (!isPlaceholderGrammar && /[\u4e00-\u9fff]/.test(patStr)) {
    const hint = pickLang(g0.hint, lang);
    const ex = pickLang(g0.explanation, lang);
    const raw = (hint || ex || "").trim();
    const short = raw.length > 88 ? `${raw.slice(0, 85)}…` : raw;
    out.push({
      zh: patStr,
      pinyin: resolvePinyin(patStr, patPy),
      meaning: short || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。"),
      note: "",
    });
  }

  return dedupeByZh(out.slice(0, 8));
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
    const zh = str(ex.zh ?? ex.phrase ?? "");
    if (!zh || !/[\u4e00-\u9fff]/.test(zh)) continue;
    const py = str(ex.pinyin ?? "");
    const mean = meaningFromExtension(ex, lang) || pickLang(ex.explain, lang);
    out.push({
      zh,
      pinyin: resolvePinyin(zh, py),
      meaning: mean,
      note: pickLang(ex.explain, lang) || "",
    });
  }
  return dedupeByZh(out);
}

/**
 * @returns {{ words: object[], expressions: object[], sentences: object[] }}
 * 每项：{ zh, pinyin, meaning, speaker?, note? }
 */
export function buildShadowingPracticeData(lesson, lang, t) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const ctx = buildLessonContext(lesson, {
    lang,
    wordsWithMeaning: (w) => pickLang(w && w.meaning, lang) || str((w && (w.hanzi != null ? w.hanzi : w.word)) || ""),
  });

  const words = [];
  const seenWord = new Set();

  const pushWord = (zh, pyManual, mean) => {
    const z = str(zh);
    if (!z || !/[\u4e00-\u9fff]/.test(z) || seenWord.has(z)) return;
    seenWord.add(z);
    words.push({
      zh: z,
      pinyin: resolvePinyin(z, str(pyManual)),
      meaning: str(mean),
      note: "",
    });
  };

  if (ctx.vocab && ctx.vocab.length) {
    for (const w of ctx.vocab) {
      pushWord(w.hanzi, w.pinyin, w.meaning);
    }
  } else {
    for (const d of ctx.dialogue || []) {
      const z = str(d.zh);
      if (!z) continue;
      if (z.length <= 4) {
        pushWord(z, d.pinyin, d.trans);
      }
    }
  }

  let expressions = [];
  expressions = expressions.concat(buildCuratedExpressionItems(lesson, ctx, lang, safeT));
  expressions = expressions.concat(extensionExpressionItems(lesson, lang));
  expressions = dedupeByZh(expressions);

  const sentences = [];
  for (const d of ctx.dialogue || []) {
    const z = str(d.zh);
    if (!z) continue;
    sentences.push({
      zh: z,
      pinyin: resolvePinyin(z, str(d.pinyin)),
      meaning: str(d.trans),
      speaker: str(d.speaker),
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
