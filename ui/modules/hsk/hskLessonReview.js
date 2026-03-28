/**
 * 课内「复习」tab：统一紧凑词条清单（去重、按来源顺序），与错题测验 #hskReviewContainer 分离。
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

const trim = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

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

/** 去重主键：去尾标点、空白归一、小写（用于「你好」≈「你好！」） */
function contentDedupKey(zh) {
  let s = trim(zh).replace(/\s+/g, " ");
  const punctEnd = /[。！？，、；：.!?,…～~]+$/u;
  while (punctEnd.test(s)) s = s.replace(punctEnd, "").trim();
  return s.toLowerCase();
}

function longerMeaning(a, b) {
  const x = trim(a);
  const y = trim(b);
  if (!x) return y;
  if (!y) return x;
  return y.length > x.length ? y : x;
}

function pickDisplayText(a, b) {
  const ta = trim(a);
  const tb = trim(b);
  if (!ta) return b;
  if (!tb) return a;
  if (tb.length > ta.length) return b;
  return a;
}

/** 与 page.hsk / 对话 tab 一致 */
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

function grammarPatternReviewLine(pt, lang) {
  if (!pt || typeof pt !== "object") return null;
  let raw = "";
  if (typeof pt.pattern === "string") raw = trim(pt.pattern);
  else if (typeof pt.title === "string") raw = trim(pt.title);
  else if (pt.title && typeof pt.title === "object") {
    raw = trim(pt.title.zh || pt.title.cn || pt.title.kr || pt.title.en || pt.title.jp || "");
  } else raw = trim(pt.name || "");
  if (!raw || raw.length > 36) return null;
  if (!/[\u4e00-\u9fff]/.test(raw)) return null;
  const explain = pt.explain ?? pt.explanation;
  let meaning = "";
  if (explain && typeof explain === "object") {
    meaning = shortenText(controlledLangText(explain, lang, "grammar pat"), 72);
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
 * @typedef {{ text: string, pinyin: string, pos: string, meaning: string, type: 'word'|'sentence' }} ReviewItem
 */

function itemRichness(it) {
  let n = 0;
  if (trim(it.pinyin)) n += 2;
  if (trim(it.meaning)) n += 3;
  if (trim(it.pos)) n += 1;
  if (it.type === "word") n += 5;
  return n;
}

function mergeReviewItems(a, b) {
  const type = a.type === "word" || b.type === "word" ? "word" : "sentence";
  return {
    text: pickDisplayText(a.text, b.text),
    pinyin: trim(a.pinyin) || trim(b.pinyin) || "",
    pos: trim(a.pos) || trim(b.pos) || "",
    meaning: longerMeaning(a.meaning, b.meaning),
    type,
  };
}

/**
 * 统一去重桶：先录入者决定排序；后者仅合并补全字段。
 */
function createReviewItemRegistry() {
  /** @type {Map<string, { item: ReviewItem, order: number, richness: number }>} */
  const map = new Map();
  let seq = 0;

  return {
    ingest(candidate) {
      const key = contentDedupKey(candidate.text);
      if (!key) return;
      const r = itemRichness(candidate);
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { item: { ...candidate }, order: seq++, richness: r });
        return;
      }
      cur.item = mergeReviewItems(cur.item, candidate);
      cur.richness = Math.max(cur.richness, r);
    },
    valuesSorted() {
      return [...map.values()].sort((a, b) => a.order - b.order).map((x) => x.item);
    },
  };
}

/**
 * @param {object} lessonData
 * @param {object} options
 * @param {string} options.lang
 * @param {Array} [options.lessonWords]
 * @returns {{ items: ReviewItem[] }}
 */
export function buildLessonReviewData(lessonData, options = {}) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const lang = options.lang || "kr";
  const langNorm = normalizeLang(lang);
  const glossaryScope =
    options.glossaryScope ||
    (options.lessonLevel != null &&
    options.lessonLevel !== "" &&
    String(options.lessonLevel).match(/^\d+$/)
      ? `hsk${options.lessonLevel}`
      : "");
  const showPinyin = shouldShowPinyin({
    level: (lessonData && lessonData.level) || options.lessonLevel,
    version: (lessonData && lessonData.version) || options.lessonVersion,
  });

  const reg = createReviewItemRegistry();

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
    const posLang =
      langNorm === "kr" ? "ko" : langNorm === "cn" ? "zh" : langNorm === "jp" ? "ja" : "en";
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

  for (const w of wordRows) {
    reg.ingest({
      text: w.zh,
      pinyin: w.pinyin || "",
      pos: w.pos || "",
      meaning: w.meaning || "",
      type: "word",
    });
  }

  const pushSentence = (zh, pinyin, meaning) => {
    const t = trim(zh);
    if (t.length < 2) return;
    reg.ingest({
      text: t,
      pinyin: trim(pinyin),
      pos: "",
      meaning: trim(meaning),
      type: "sentence",
    });
  };

  const cards = collectDialogueCards(raw);
  for (const card of cards) {
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    for (const line of lines) {
      const zh = lineZh(line);
      let py = linePinyin(line, zh, showPinyin);
      pushSentence(zh, py, lineTranslation(line, lang));
    }
  }

  const scene = getSceneFromLesson(raw);
  if (scene) {
    const dmap = getSceneDialogueMap(scene, raw);
    for (const { line } of dmap.values()) {
      const zh = lineZh(line);
      pushSentence(zh, linePinyin(line, zh, showPinyin), lineTranslation(line, lang));
    }
  }

  const extArr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension)
        ? raw.extension
        : [];

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
        pushSentence(zh, py, trans);
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
      pushSentence(zh, py, trans);
    }
  }

  const g = raw && raw.grammar;
  const grammarArr = Array.isArray(g) ? g : Array.isArray(g && g.points) ? g.points : [];
  for (const pt of grammarArr) {
    const pat = grammarPatternReviewLine(pt, lang);
    if (pat && pat.zh) {
      let py = pat.pinyin;
      if (showPinyin && pat.zh && !py) py = resolvePinyin(pat.zh, py);
      pushSentence(pat.zh, py, pat.trans || "");
    }
    const exItems = grammarToExampleItems(pt, lang);
    for (const ex of exItems) {
      let py = ex.pinyin;
      if (showPinyin && ex.zh && !py) py = resolvePinyin(ex.zh, py);
      pushSentence(ex.zh, py, ex.trans || "");
    }
  }

  let items = reg.valuesSorted().slice(0, MAX_TOTAL_ITEMS);
  return { items };
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
        `<li class="lesson-review-item hsk-lr-compact py-1.5 border-b border-slate-100/90 dark:border-slate-700/80 last:border-0 text-[14px] leading-snug text-slate-800 dark:text-slate-100">${formatCompactLine(it)}</li>`
    )
    .join("");

  return `<div class="hsk-lesson-review lesson-review-summary-root max-w-2xl">
  <ul class="hsk-lesson-review-list list-none m-0 p-0">${lis}</ul>
</div>`;
}
