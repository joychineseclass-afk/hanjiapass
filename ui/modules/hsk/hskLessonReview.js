/**
 * 课内「复习」tab：两步构建（收集候选项 → 标准化去重择优 → 合并句过滤），紧凑列表。
 */

import { i18n } from "../../i18n.js";
import { getContentText } from "../../core/languageEngine.js";
import {
  wordKey,
  wordPinyin,
  wordMeaning,
  normalizeVocabHanziKeyForPanel,
  normalizeLang,
} from "./hskRenderer.js";
import { getPosByLang } from "../../utils/wordDisplay.js";
import { resolvePinyin, maybeGetManualPinyin, shouldShowPinyin } from "../../utils/pinyinEngine.js";
import { getSceneFromLesson, getSceneDialogueMap } from "../../platform/scene/sceneEngine.js";

const MAX_WORD_ROWS = 80;
const MAX_TOTAL_ITEMS = 140;

/** 常见问候/礼貌语在复习中的先后（用于第1课等排序，未命中则回退 source 顺序） */
const HSK1_GREETING_ORDER = ["你好", "谢谢", "不客气", "再见", "您好", "大家好"];

const trim = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

const FW_PUNCT = new Map([
  ["，", ","],
  ["。", "."],
  ["！", "!"],
  ["？", "?"],
  ["；", ";"],
  ["：", ":"],
  ["（", "("],
  ["）", ")"],
  ["【", "["],
  ["】", "]"],
]);

function normalizePracticeLangAliases(langKey) {
  const k = String(langKey || "").toLowerCase();
  if (k === "ko") return "kr";
  if (k === "ja") return "jp";
  if (k === "zh") return "cn";
  return k || "kr";
}

function controlledLangText(obj, langKey, context) {
  if (!obj || typeof obj !== "object") return "";
  const key = normalizePracticeLangAliases(langKey);
  const primary =
    key === "kr"
      ? ["kr", "ko"]
      : key === "jp"
        ? ["jp", "ja"]
        : key === "cn"
          ? ["cn", "zh"]
          : ["en"];
  const order = [...primary, "en", "cn", "zh"];
  for (const k of order) {
    const value = trim(obj[k]);
    if (value) return value;
  }
  void context;
  return "";
}

function normalizeFullWidthPunct(s) {
  let t = "";
  for (const ch of s) {
    t += FW_PUNCT.get(ch) || ch;
  }
  return t;
}

/** 展示用：去首尾空白、NFKC、全半角标点统一 */
function normalizeTextForReview(s) {
  let t = trim(s).normalize("NFKC");
  t = normalizeFullWidthPunct(t);
  return t.replace(/\s+/g, " ");
}

/**
 * 分组主键：去尾标点、小写拉丁、去掉句末括号说明（如 呢（追问）→ 呢）
 */
function normalizedGroupingKey(s) {
  let t = normalizeTextForReview(s);
  t = t.replace(/[（(][^)）]{1,20}[)）]\s*$/u, "").trim();
  const punctEnd = /[。！？,.!?…~～，、；：]+$/u;
  while (punctEnd.test(t)) t = t.replace(punctEnd, "").trim();
  return t.toLowerCase();
}

function longerMeaning(a, b) {
  const x = trim(a);
  const y = trim(b);
  if (!x) return y;
  if (!y) return x;
  return y.length > x.length ? y : x;
}

function pickRicherText(a, b) {
  const ta = normalizeTextForReview(a);
  const tb = normalizeTextForReview(b);
  if (!ta) return b;
  if (!tb) return a;
  if (tb.length > ta.length) return b;
  return a;
}

function collectDialogueCards(lesson) {
  const arr =
    lesson && Array.isArray(lesson.generatedDialogues) && lesson.generatedDialogues.length
      ? lesson.generatedDialogues
      : lesson && Array.isArray(lesson.structuredDialogues) && lesson.structuredDialogues.length
        ? lesson.structuredDialogues
        : lesson && Array.isArray(lesson.dialogueCards) && lesson.dialogueCards.length
          ? lesson.dialogueCards
          : lesson && Array.isArray(lesson.dialogue) && lesson.dialogue.length
            ? lesson.dialogue
            : [];

  if (!arr.length) return [];

  const first = arr[0];
  const isCard = first && first.lines && Array.isArray(first.lines);
  const isLine =
    first &&
    (first.speaker != null ||
      first.spk != null ||
      first.cn != null ||
      first.zh != null ||
      first.text != null);

  if (isCard) return arr;
  if (isLine) return [{ title: null, lines: arr }];
  return [];
}

function lineZh(line) {
  return trim(
    (line && line.text) ||
      (line && line.zh) ||
      (line && line.cn) ||
      (line && line.line) ||
      ""
  );
}

function lineTranslation(line, lang) {
  const l = normalizePracticeLangAliases(lang);
  const str = trim;
  const trans = line?.translation ?? line?.trans ?? line?.translations;
  if (trans && typeof trans === "object") {
    if (l === "kr") return str(trans.kr) || str(trans.ko) || "";
    if (l === "jp") return str(trans.jp) || str(trans.ja) || "";
    if (l === "cn") return str(trans.cn) || str(trans.zh) || "";
    return str(trans.en) || "";
  }
  if (l === "kr") {
    return (
      str(line?.kr) ||
      str(line?.ko) ||
      str(line?.translationKr) ||
      str(line?.translation_kr) ||
      ""
    );
  }
  if (l === "jp") {
    return (
      str(line?.jp) ||
      str(line?.ja) ||
      str(line?.translationJp) ||
      str(line?.translation_jp) ||
      ""
    );
  }
  if (l === "cn") {
    return (
      str(line?.cn) ||
      str(line?.zh) ||
      str(line?.translationCn) ||
      str(line?.translation_cn) ||
      ""
    );
  }
  return str(line?.en) || str(line?.translationEn) || str(line?.translation_en) || "";
}

function linePinyin(line, zh, showPinyin) {
  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
  return trim(py);
}

function grammarToExampleItems(pt, lang) {
  const ex = (pt && pt.example) || (pt && pt.examples);
  const toItem = (e) => {
    if (typeof e === "string") {
      return { zh: trim(e), pinyin: "", trans: "" };
    }
    const zh = trim(e && (e.zh || e.cn || e.line || e.text));
    let pinyin = trim(e && (e.pinyin || e.py));
    let trans = "";
    const transObj = e && (e.translation || e.translations || e.trans);
    if (transObj && typeof transObj === "object") {
      trans = controlledLangText(transObj, lang, "grammar ex");
    } else {
      trans = getContentText(e, "translation", { strict: true, lang: normalizePracticeLangAliases(lang) }) || "";
    }
    return { zh, pinyin, trans };
  };
  if (!ex) return [];
  if (Array.isArray(ex)) return ex.map(toItem).filter((x) => x.zh);
  return [toItem(ex)].filter((x) => x.zh);
}

function shortenText(text, maxLen) {
  const t = trim(text);
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + "…";
}

function grammarPatternLine(pt, lang) {
  if (!pt || typeof pt !== "object") return null;
  let raw = "";
  if (typeof pt.pattern === "string") raw = trim(pt.pattern);
  else if (typeof pt.title === "string") raw = trim(pt.title);
  else if (pt.title && typeof pt.title === "object") {
    raw = trim(pt.title.zh || pt.title.cn || pt.title.kr || pt.title.en || pt.title.jp || "");
  } else raw = trim(pt.name || "");
  if (!raw || raw.length > 36) return null;
  if (!/[\u4e00-\u9fff]/.test(raw)) return null;
  if (/\+/.test(raw)) return null;
  const explain = pt.explain ?? pt.explanation;
  let meaning = "";
  if (explain && typeof explain === "object") {
    meaning = shortenText(controlledLangText(explain, lang, "grammar pat"), 120);
  }
  return { zh: raw, pinyin: "", trans: meaning };
}

function filterSubsumedSingleChars(keysInOrder, hanziSet) {
  const out = [];
  const multi = [...hanziSet].filter((h) => trim(h).length >= 2);
  for (const h of keysInOrder) {
    const t = trim(h);
    if (!t) continue;
    if (t.length === 1) {
      const covered = multi.some((p) => p.includes(t));
      if (covered) continue;
    }
    out.push(t);
  }
  return out;
}

function wordRowQuality(w, lang) {
  const zh = wordKey(w);
  let q = 0;
  if (typeof w === "object" && w) {
    if (wordMeaning(w, lang)) q += 1;
    if (wordPinyin(w)) q += 1;
  }
  if (zh.length >= 2) q += 1;
  return q;
}

/**
 * @typedef {{
 *   text: string,
 *   normalizedText: string,
 *   pinyin: string,
 *   pos: string,
 *   meaning: string,
 *   note: string,
 *   source: string,
 *   priority: number,
 *   kind: 'word'|'sentence'
 * }} ReviewCandidate
 */

const SOURCE_PRIORITY_BASE = {
  vocab: 0,
  dialogue: 1000,
  scene: 1500,
  grammar_pattern: 2800,
  grammar_example: 3200,
  extension: 4500,
};

function sourceTier(source) {
  if (source === "vocab") return 0;
  if (source === "dialogue" || source === "scene") return 1;
  if (source === "grammar_pattern" || source === "grammar_example") return 3;
  if (source === "extension") return 4;
  return 2;
}

function pedagogyIndexForText(text) {
  const k = normalizedGroupingKey(text);
  for (let i = 0; i < HSK1_GREETING_ORDER.length; i++) {
    if (normalizedGroupingKey(HSK1_GREETING_ORDER[i]) === k) return i;
  }
  return -1;
}

function scoreCandidateForBestPick(a) {
  let s = 0;
  s += trim(a.meaning).length * 3;
  s += trim(a.note).length;
  s += trim(a.pinyin).length;
  s += trim(a.pos).length * 2;
  if (a.kind === "word") s += 80;
  s += SOURCE_PRIORITY_BASE[a.source] != null ? 2000 - SOURCE_PRIORITY_BASE[a.source] / 10 : 0;
  s -= Math.min(trim(a.text).length, 100) * 0.4;
  return s;
}

function mergeTwoCandidates(primary, secondary) {
  return {
    text: pickRicherText(primary.text, secondary.text),
    normalizedText: primary.normalizedText,
    pinyin: trim(primary.pinyin) || trim(secondary.pinyin) || "",
    pos: trim(primary.pos) || trim(secondary.pos) || "",
    meaning: longerMeaning(primary.meaning, secondary.meaning),
    note: longerMeaning(primary.note, secondary.note),
    source: primary.source,
    priority: Math.min(primary.priority, secondary.priority),
    kind: primary.kind === "word" || secondary.kind === "word" ? "word" : "sentence",
  };
}

/** 按 normalizedText 分组合并，每组择优一条 */
function dedupeByNormalizedKey(candidates) {
  /** @type {Map<string, ReviewCandidate>} */
  const best = new Map();
  for (const c of candidates) {
    const key = c.normalizedText;
    if (!key) continue;
    const cur = best.get(key);
    if (!cur) {
      best.set(key, { ...c });
      continue;
    }
    const sCur = scoreCandidateForBestPick(cur);
    const sNew = scoreCandidateForBestPick(c);
    if (sNew > sCur) {
      best.set(key, mergeTwoCandidates(c, cur));
    } else if (sNew < sCur) {
      best.set(key, mergeTwoCandidates(cur, c));
    } else {
      const preferNew =
        SOURCE_PRIORITY_BASE[c.source] < SOURCE_PRIORITY_BASE[cur.source] ||
        (SOURCE_PRIORITY_BASE[c.source] === SOURCE_PRIORITY_BASE[cur.source] && c.priority < cur.priority);
      best.set(key, preferNew ? mergeTwoCandidates(c, cur) : mergeTwoCandidates(cur, c));
    }
  }
  return [...best.values()];
}

const SEG_SPLIT = /[，。！？；、,.!?…~～]+/u;

function splitMeaningfulSegments(text) {
  const t = normalizeTextForReview(text);
  if (!t) return [];
  return t
    .split(SEG_SPLIT)
    .map((x) => trim(x))
    .filter((x) => x.length >= 2);
}

function registerAcceptedFragments(text, keySet, introTpl) {
  const nk = normalizedGroupingKey(text);
  if (nk) keySet.add(nk);
  for (const seg of splitMeaningfulSegments(text)) {
    const sk = normalizedGroupingKey(seg);
    if (sk) keySet.add(sk);
  }
  for (const seg of splitMeaningfulSegments(text)) {
    if (/^我叫/u.test(seg)) introTpl.add("我叫");
    if (/^我是/u.test(seg)) introTpl.add("我是");
  }
}

/**
 * 合并型冗余：主要片段已在已接受条目中独立出现过（≥2 段全部可覆盖）
 */
function isCompositeGlueSentence(text, acceptedKeys, introTpl) {
  const t = normalizeTextForReview(text);
  if (t.length < 8) return false;
  const segs = splitMeaningfulSegments(text);
  if (segs.length < 2) return false;

  let covered = 0;
  for (const seg of segs) {
    const sk = normalizedGroupingKey(seg);
    if (sk && acceptedKeys.has(sk)) {
      covered++;
      continue;
    }
    if (/^我叫/u.test(seg) && introTpl.has("我叫")) {
      covered++;
      continue;
    }
    if (/^我是/u.test(seg) && introTpl.has("我是")) {
      covered++;
      continue;
    }
  }

  if (covered < segs.length) return false;
  return true;
}

/** 省略号模板：前面已有完整「我叫/我是」句时去掉 …… 教学条 */
function isEllipsisTemplateRedundant(text, introTpl) {
  if (!/[…．]{2,}/u.test(text) && !/……/.test(text)) return false;
  if (/我叫/.test(text) && introTpl.has("我叫")) return true;
  if (/我是/.test(text) && introTpl.has("我是")) return true;
  return false;
}

/** 已有「我叫」教学句后，去掉仅换人名、无「呢」等追加信息的短「我叫……。」 */
function isNameOnlyIntroVariant(text, introTpl) {
  const t = normalizeTextForReview(text);
  if (!introTpl.has("我叫")) return false;
  if (t.includes("，") || t.includes(",")) return false;
  if (t.includes("呢")) return false;
  return /^我叫.{1,22}[。！？]$/u.test(t);
}

/**
 * @typedef {{ text: string, pinyin: string, pos: string, meaning: string, type: 'word'|'sentence' }} ReviewItem
 */

function candidateToItem(c) {
  const meaning = trim(c.meaning);
  const note = trim(c.note);
  const merged = note && meaning ? `${meaning}（${note}）` : meaning || note;
  return {
    text: normalizeTextForReview(c.text),
    pinyin: trim(c.pinyin),
    pos: trim(c.pos),
    meaning: merged,
    type: c.kind === "word" ? "word" : "sentence",
  };
}

function compareFinalItems(a, b) {
  const ca = a._cand;
  const cb = b._cand;

  const pa = pedagogyIndexForText(ca.text);
  const pb = pedagogyIndexForText(cb.text);
  if (pa >= 0 && pb >= 0 && pa !== pb) return pa - pb;
  if (pa >= 0 && pb < 0) return -1;
  if (pa < 0 && pb >= 0) return 1;

  const ta = sourceTier(ca.source);
  const tb = sourceTier(cb.source);
  if (ta !== tb) return ta - tb;

  if (ca.kind !== cb.kind) {
    if (ca.kind === "word") return -1;
    if (cb.kind === "word") return 1;
  }

  return ca.priority - cb.priority;
}

/**
 * @param {object} lessonData
 * @param {object} options
 * @returns {{ items: ReviewItem[] }}
 */
export function buildLessonReviewData(lessonData, options = {}) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const lang = options.lang || "kr";
  const langNorm = normalizeLang(lang);
  const glossaryScope = options.glossaryScope || "";
  const posLang =
    langNorm === "kr" ? "ko" : langNorm === "cn" ? "zh" : langNorm === "jp" ? "ja" : "en";

  const showPinyin = shouldShowPinyin({
    level: (lessonData && lessonData.level) || options.lessonLevel,
    version: (lessonData && lessonData.version) || options.lessonVersion,
  });

  /** @type {ReviewCandidate[]} */
  const candidates = [];
  let pri = 0;

  const pushCandidate = (c) => {
    const text = normalizeTextForReview(c.text);
    if (!text) return;
    const nk = normalizedGroupingKey(text);
    if (!nk) return;
    candidates.push({
      ...c,
      text,
      normalizedText: nk,
      pinyin: trim(c.pinyin || ""),
      pos: trim(c.pos || ""),
      meaning: trim(c.meaning || ""),
      note: trim(c.note || ""),
      priority: c.priority != null ? c.priority : pri++,
    });
  };

  const wordsSource =
    Array.isArray(options.lessonWords) && options.lessonWords.length
      ? options.lessonWords
      : Array.isArray(raw && raw.vocab) && raw.vocab.length
        ? raw.vocab
        : Array.isArray(raw && raw.words)
          ? raw.words
          : [];

  const wordMap = new Map();
  for (const w of wordsSource) {
    const zh = wordKey(w);
    if (!zh) continue;
    const key = normalizeVocabHanziKeyForPanel(zh);
    if (!key) continue;
    let pinyin = typeof w === "object" ? wordPinyin(w) : "";
    const meaning = typeof w === "object" ? wordMeaning(w, lang) : "";
    const pos =
      typeof w === "object" && w ? getPosByLang({ ...w, hanzi: wordKey(w) || w.hanzi }, posLang, glossaryScope) : "";
    if (showPinyin && zh && !pinyin) pinyin = resolvePinyin(zh, pinyin);
    const row = { zh, pinyin, meaning, pos, _q: wordRowQuality(w, lang) };
    const prev = wordMap.get(key);
    if (!prev || row._q > prev._q) wordMap.set(key, row);
  }

  const uniqueHanziOrder = [...wordMap.keys()];
  const filteredKeys = filterSubsumedSingleChars(
    uniqueHanziOrder,
    new Set(uniqueHanziOrder.map((k) => wordMap.get(k).zh))
  );
  const wordRows = filteredKeys
    .map((k) => wordMap.get(k))
    .sort((a, b) => b._q - a._q || b.zh.length - a.zh.length)
    .slice(0, MAX_WORD_ROWS);

  wordRows.forEach((w, idx) => {
    pushCandidate({
      text: w.zh,
      pinyin: w.pinyin || "",
      pos: w.pos || "",
      meaning: w.meaning || "",
      note: "",
      source: "vocab",
      priority: SOURCE_PRIORITY_BASE.vocab + idx,
      kind: "word",
    });
  });

  const pushSentence = (zh, pinyin, meaning, source, pBase) => {
    const t = trim(zh);
    if (t.length < 2) return;
    let py = trim(pinyin);
    if (showPinyin && t && !py) py = resolvePinyin(t, py);
    pushCandidate({
      text: t,
      pinyin: py,
      pos: "",
      meaning: trim(meaning),
      note: "",
      source,
      priority: pBase,
      kind: "sentence",
    });
  };

  const cards = collectDialogueCards(raw);
  let dIdx = 0;
  for (const card of cards) {
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    for (const line of lines) {
      const zh = lineZh(line);
      pushSentence(zh, linePinyin(line, zh, showPinyin), lineTranslation(line, lang), "dialogue", SOURCE_PRIORITY_BASE.dialogue + dIdx++);
    }
  }

  const scene = getSceneFromLesson(raw);
  let sIdx = 0;
  if (scene) {
    const dmap = getSceneDialogueMap(scene, raw);
    for (const { line } of dmap.values()) {
      const zh = lineZh(line);
      pushSentence(zh, linePinyin(line, zh, showPinyin), lineTranslation(line, lang), "scene", SOURCE_PRIORITY_BASE.scene + sIdx++);
    }
  }

  const extArr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension)
        ? raw.extension
        : [];

  let eIdx = 0;
  for (const item of extArr) {
    const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
    if (sentences.length && (item.groupTitle || item.focusGrammar)) {
      for (const s of sentences) {
        const zh = trim(s.cn || s.zh || "");
        let py = trim(s.pinyin || s.py);
        if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
        const transObj = s.translations || s.translation;
        const trans =
          transObj && typeof transObj === "object" ? controlledLangText(transObj, lang, "ext") : "";
        pushSentence(zh, py, trans, "extension", SOURCE_PRIORITY_BASE.extension + eIdx++);
      }
    } else {
      const zh = trim(item.phrase || item.hanzi || item.zh || item.cn || item.line);
      let py = trim(item.pinyin || item.py);
      if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
      const transObj = item.translation || item.translations || item.trans;
      let trans = "";
      if (transObj && typeof transObj === "object") {
        trans = controlledLangText(transObj, lang, "ext flat");
      } else {
        trans =
          trim(item.kr) ||
          trim(item.ko) ||
          trim(item.jp) ||
          trim(item.en) ||
          trim(item.cn) ||
          trim(item.zh) ||
          "";
      }
      const ex = item.explain ?? item.explanation;
      const note =
        ex && typeof ex === "object"
          ? shortenText(controlledLangText(ex, lang, "ext expl"), 100)
          : trim(item.explainKr) || trim(item.explainEn) || "";
      pushCandidate({
        text: zh,
        pinyin: py,
        pos: "",
        meaning: trans,
        note,
        source: "extension",
        priority: SOURCE_PRIORITY_BASE.extension + eIdx++,
        kind: "sentence",
      });
    }
  }

  const g = raw && raw.grammar;
  const grammarArr = Array.isArray(g) ? g : Array.isArray(g && g.points) ? g.points : [];
  let gPat = 0;
  let gEx = 0;
  for (const pt of grammarArr) {
    const pat = grammarPatternLine(pt, lang);
    if (pat && pat.zh) {
      let py = pat.pinyin;
      if (showPinyin && pat.zh && !py) py = resolvePinyin(pat.zh, py);
      pushCandidate({
        text: pat.zh,
        pinyin: py || "",
        pos: "",
        meaning: pat.trans || "",
        note: "",
        source: "grammar_pattern",
        priority: SOURCE_PRIORITY_BASE.grammar_pattern + gPat++,
        kind: "sentence",
      });
    }
    const exItems = grammarToExampleItems(pt, lang);
    for (const ex of exItems) {
      let py = ex.pinyin;
      if (showPinyin && ex.zh && !py) py = resolvePinyin(ex.zh, py);
      pushSentence(ex.zh, py, ex.trans || "", "grammar_example", SOURCE_PRIORITY_BASE.grammar_example + gEx++);
    }
  }

  const merged = dedupeByNormalizedKey(candidates);

  const withMeta = merged.map((c) => ({
    _cand: c,
    item: candidateToItem(c),
  }));

  withMeta.sort(compareFinalItems);

  const acceptedKeys = new Set();
  const introTpl = new Set();
  const out = [];

  for (const row of withMeta) {
    const c = row._cand;
    const it = row.item;

    if (isEllipsisTemplateRedundant(it.text, introTpl)) {
      continue;
    }
    if (isNameOnlyIntroVariant(it.text, introTpl)) {
      continue;
    }
    if (it.type === "sentence" && isCompositeGlueSentence(it.text, acceptedKeys, introTpl)) {
      continue;
    }

    registerAcceptedFragments(it.text, acceptedKeys, introTpl);
    out.push(it);
  }

  return { items: out.slice(0, MAX_TOTAL_ITEMS) };
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function speakAttrs(zh) {
  if (!zh) return "";
  const esc = escapeHtml(zh).replaceAll('"', "&quot;");
  return ` data-speak-text="${esc}" data-speak-kind="dialogue"`;
}

function formatCompactLine(it) {
  const text = escapeHtml(trim(it.text));
  const py = trim(it.pinyin);
  const pos = trim(it.pos);
  const mean = trim(it.meaning);
  const pyPart = py ? ` ${escapeHtml(py)}` : "";
  if (it.type === "word") {
    if (pos && mean) {
      return `<span class="hsk-lr-line-zh font-medium"${speakAttrs(trim(it.text))}>${text}</span>${pyPart} <span class="opacity-70">/</span> ${escapeHtml(pos)} <span class="opacity-70">/</span> ${escapeHtml(mean)}`;
    }
    if (mean) {
      return `<span class="hsk-lr-line-zh font-medium"${speakAttrs(trim(it.text))}>${text}</span>${pyPart} <span class="opacity-70">/</span> ${escapeHtml(mean)}`;
    }
    return `<span class="hsk-lr-line-zh font-medium"${speakAttrs(trim(it.text))}>${text}</span>${pyPart}`;
  }
  if (mean) {
    return `<span class="hsk-lr-line-zh"${speakAttrs(trim(it.text))}>${text}</span>${pyPart} <span class="opacity-70">/</span> ${escapeHtml(mean)}`;
  }
  return `<span class="hsk-lr-line-zh"${speakAttrs(trim(it.text))}>${text}</span>${pyPart}`;
}

/**
 * @param {ReturnType<typeof buildLessonReviewData>} reviewData
 */
export function renderLessonReviewHTML(reviewData) {
  const { items } = reviewData;
  if (!items || !items.length) {
    return `<div class="lesson-review-empty text-sm text-slate-500 dark:text-slate-400 py-1">${escapeHtml(i18n.t("hsk.lesson_review_empty_all"))}</div>`;
  }

  const lis = items
    .map(
      (it) =>
        `<li class="lesson-review-item hsk-lr-compact block cursor-pointer rounded-[10px] border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-[14px] leading-relaxed text-slate-800 transition-colors duration-150 dark:border-slate-600/40 dark:bg-slate-800/40 dark:text-slate-100 hover:border-slate-300 hover:bg-slate-100/95 dark:hover:border-slate-500/55 dark:hover:bg-slate-800/60">${formatCompactLine(it)}</li>`
    )
    .join("");

  return `<div class="hsk-lesson-review lesson-review-summary-root max-w-2xl">
  <ul class="hsk-lesson-review-list m-0 flex list-none flex-col gap-2 p-0">${lis}</ul>
</div>`;
}
