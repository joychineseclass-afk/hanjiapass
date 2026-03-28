/**
 * 课内「复习」tab：课程内容总览（单词 / 会话 / 语法 / 扩展），与错题测验 UI（#hskReviewContainer）分离。
 */

import { i18n } from "../../i18n.js";
import { getContentText } from "../../core/languageEngine.js";
import {
  wordKey,
  wordPinyin,
  wordMeaning,
  normalizeVocabHanziKeyForPanel,
} from "./hskRenderer.js";
import { resolvePinyin, maybeGetManualPinyin, shouldShowPinyin } from "../../utils/pinyinEngine.js";

/** 与单词 tab 对齐，避免单页过长 */
const MAX_WORD_ROWS = 80;
const MAX_DIALOGUE_LINES = 48;
const MAX_GRAMMAR_POINTS = 12;
const MAX_GRAMMAR_EXAMPLES_PER_POINT = 4;
const MAX_EXTENSION_ROWS = 36;

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

function sentenceDedupKey(zh) {
  const s = trim(zh).replace(/\s+/g, " ");
  return s.replace(/[。！？，、；：.!?,]+$/u, "").toLowerCase();
}

/** 与 page.hsk getDialogueCards 一致 */
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

function lineSpeaker(line) {
  return trim((line && line.speaker) || (line && line.spk) || "");
}

function sentenceQuality(row) {
  let q = 0;
  if (row.trans) q += 4;
  if (row.pinyin) q += 2;
  const z = row.zh || "";
  if (z.length >= 4) q += 2;
  else if (z.length >= 2) q += 1;
  const src = row.sourceRank ?? 3;
  q += (3 - src) * 0.5;
  return q;
}

function grammarTitle(pt, i) {
  if (typeof pt?.title === "object") {
    return trim(pt.title.zh || pt.title.kr || pt.title.en || pt.title.jp || "");
  }
  return trim(pt?.pattern || pt?.title || pt?.name) || `#${i + 1}`;
}

function grammarExplanation(pt, lang) {
  if (!pt || typeof pt !== "object") return "";
  const l = normalizePracticeLangAliases(lang);
  const str = trim;
  const explain = pt.explain ?? pt.explanation;
  if (explain && typeof explain === "object") {
    if (l === "kr") return str(explain.kr) || str(explain.ko) || "";
    if (l === "jp") return str(explain.jp) || str(explain.ja) || "";
    if (l === "cn") return str(explain.cn) || str(explain.zh) || "";
    return str(explain.en) || "";
  }
  if (l === "kr") {
    return (
      str(pt.explainKr) ||
      str(pt.explanationKr) ||
      str(pt.explain_kr) ||
      str(pt.explanation_kr) ||
      ""
    );
  }
  if (l === "jp") {
    return (
      str(pt.explainJp) ||
      str(pt.explanationJp) ||
      str(pt.explain_jp) ||
      str(pt.explanation_jp) ||
      ""
    );
  }
  if (l === "cn") {
    return (
      str(pt.explainCn) ||
      str(pt.explanationCn) ||
      str(pt.explain_zh) ||
      str(pt.explanation_zh) ||
      ""
    );
  }
  return str(pt.explainEn) || str(pt.explanationEn) || str(pt.explain_en) || str(pt.explanation_en) || "";
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

function shortenNote(text, maxLen = 96) {
  const t = trim(text);
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + "…";
}

function pickOneWordExample(w, lang, showPinyin) {
  if (!w || typeof w !== "object" || !Array.isArray(w.examples) || !w.examples.length) {
    return "";
  }
  const ex = w.examples[0];
  const zh = trim(ex.zh || ex.cn || ex.line || ex.text);
  if (!zh) return "";
  let py = trim(ex.pinyin || ex.py);
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
  const transObj = ex.translation || ex.translations || ex.trans;
  const trans =
    transObj && typeof transObj === "object"
      ? controlledLangText(transObj, lang, "word ex")
      : "";
  let line = zh;
  if (py) line += `（${py}）`;
  if (trans) line += ` — ${trans}`;
  return line;
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
    if (Array.isArray(w.examples) && w.examples.length) q += 2;
  }
  if (zh.length >= 2) q += 1;
  return q;
}

/**
 * @param {object} lessonData
 * @param {object} options
 * @param {string} options.lang - UI 语言键（与 getLang 一致）
 * @param {Array} [options.lessonWords] - 与单词 tab 一致的面板词表；缺省则用 vocab/words
 * @returns {{ words: object[], dialogue: object[], grammar: object[], extension: object[] }}
 */
export function buildLessonReviewData(lessonData, options = {}) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const lang = options.lang || "kr";
  const showPinyin = shouldShowPinyin({
    level: (lessonData && lessonData.level) || options.lessonLevel,
    version: (lessonData && lessonData.version) || options.lessonVersion,
  });

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
    const row = {
      zh,
      pinyin: typeof w === "object" ? wordPinyin(w) : "",
      meaning: typeof w === "object" ? wordMeaning(w, lang) : "",
      exampleLine: typeof w === "object" ? pickOneWordExample(w, lang, showPinyin) : "",
      _q: wordRowQuality(w, lang),
    };
    if (showPinyin && row.zh && !row.pinyin) row.pinyin = resolvePinyin(row.zh, row.pinyin);
    const prev = wordMap.get(key);
    if (!prev || row._q > prev._q) wordMap.set(key, row);
  }

  const uniqueHanziOrder = [...wordMap.keys()];
  const filteredKeys = filterSubsumedSingleChars(
    uniqueHanziOrder,
    new Set(uniqueHanziOrder.map((k) => wordMap.get(k).zh))
  );

  const wordCandidates = filteredKeys
    .map((k) => wordMap.get(k))
    .sort((a, b) => b._q - a._q || b.zh.length - a.zh.length);

  const words = wordCandidates.slice(0, MAX_WORD_ROWS).map(({ zh, pinyin, meaning, exampleLine }) => ({
    zh,
    pinyin,
    meaning,
    exampleLine: exampleLine || "",
  }));

  /** 仅会话卡片/对白行，不含词汇例句、语法例句 */
  const dialogue = [];
  const dialogueSeen = new Set();
  const cards = collectDialogueCards(raw);
  for (const card of cards) {
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    for (const line of lines) {
      const zh = lineZh(line);
      if (!zh || zh.length < 2) continue;
      const dk = sentenceDedupKey(zh);
      if (dialogueSeen.has(dk)) continue;
      dialogueSeen.add(dk);
      dialogue.push({
        zh,
        pinyin: linePinyin(line, zh, showPinyin),
        trans: lineTranslation(line, lang),
        speaker: lineSpeaker(line),
      });
      if (dialogue.length >= MAX_DIALOGUE_LINES) break;
    }
    if (dialogue.length >= MAX_DIALOGUE_LINES) break;
  }

  const g = raw && raw.grammar;
  const grammarArr = Array.isArray(g) ? g : Array.isArray(g && g.points) ? g.points : [];

  const grammar = [];
  for (let i = 0; i < grammarArr.length && grammar.length < MAX_GRAMMAR_POINTS; i++) {
    const pt = grammarArr[i];
    const name = grammarTitle(pt, i);
    const expl = grammarExplanation(pt, lang);
    const exItems = grammarToExampleItems(pt, lang)
      .slice(0, MAX_GRAMMAR_EXAMPLES_PER_POINT)
      .map((ex) => {
        let py = ex.pinyin;
        if (showPinyin && ex.zh && !py) py = resolvePinyin(ex.zh, py);
        return { zh: ex.zh, pinyin: py || "", trans: ex.trans || "" };
      })
      .filter((ex) => ex.zh);

    if (!trim(name) && !trim(expl) && !exItems.length) continue;
    grammar.push({
      name: name || "·",
      note: trim(expl) ? shortenNote(expl, 200) : "",
      examples: exItems,
    });
  }

  const extArr =
    Array.isArray(raw && raw.generatedExtensions) && raw.generatedExtensions.length
      ? raw.generatedExtensions
      : Array.isArray(raw && raw.extension)
        ? raw.extension
        : [];

  const extMap = new Map();
  const bumpExt = (row) => {
    const k = sentenceDedupKey(row.zh);
    if (!k) return;
    const prev = extMap.get(k);
    const qn = sentenceQuality({ zh: row.zh, pinyin: row.pinyin, trans: row.trans, sourceRank: 0 });
    const qo = prev ? sentenceQuality({ zh: prev.zh, pinyin: prev.pinyin, trans: prev.trans, sourceRank: 0 }) : -1;
    if (!prev || qn > qo) extMap.set(k, row);
  };

  for (const item of extArr) {
    const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
    if (sentences.length && (item.groupTitle || item.focusGrammar)) {
      for (const s of sentences) {
        const zh = trim(s.cn || s.zh || "");
        if (zh.length < 2) continue;
        let py = trim(s.pinyin || s.py);
        if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
        const transObj = s.translations || s.translation;
        const trans =
          transObj && typeof transObj === "object" ? controlledLangText(transObj, lang, "ext") : "";
        const groupHint = trim(
          typeof item.groupTitle === "string"
            ? item.groupTitle
            : item.groupTitle && typeof item.groupTitle === "object"
              ? controlledLangText(item.groupTitle, lang, "ext group")
              : ""
        );
        const fg = trim(
          typeof item.focusGrammar === "string"
            ? item.focusGrammar
            : item.focusGrammar && typeof item.focusGrammar === "object"
              ? controlledLangText(item.focusGrammar, lang, "ext fg")
              : ""
        );
        const note = [groupHint, fg].filter(Boolean).join(" · ");
        bumpExt({ zh, pinyin: py, trans, note });
      }
    } else {
      const zh = trim(item.phrase || item.hanzi || item.zh || item.cn || item.line);
      if (zh.length < 2) continue;
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
      const note = shortenNote(
        (() => {
          const ex = item.explain ?? item.explanation;
          if (ex && typeof ex === "object") return controlledLangText(ex, lang, "ext expl");
          return (
            trim(item.explainKr) ||
            trim(item.explainEn) ||
            trim(item.explainJp) ||
            trim(item.explainCn) ||
            ""
          );
        })(),
        120
      );
      bumpExt({ zh, pinyin: py, trans, note: note || "" });
    }
  }

  const extension = [...extMap.values()]
    .sort((a, b) => sentenceQuality(b) - sentenceQuality(a))
    .slice(0, MAX_EXTENSION_ROWS)
    .map(({ zh, pinyin, trans, note }) => ({
      zh,
      pinyin,
      trans,
      note: note || "",
    }));

  return { words, dialogue, grammar, extension };
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

/**
 * @param {ReturnType<typeof buildLessonReviewData>} reviewData
 */
export function renderLessonReviewHTML(reviewData) {
  const { words, dialogue, grammar, extension } = reviewData;

  const blocks = [];

  const rowShell = (n, inner) => `<div class="hsk-lr-row flex gap-3 border-b border-slate-100 dark:border-slate-700 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
  <span class="hsk-lr-num text-sm opacity-40 w-6 shrink-0 text-right pt-0.5">${n}</span>
  <div class="hsk-lr-item flex-1 min-w-0">${inner}</div>
</div>`;

  if (words.length) {
    const title = escapeHtml(i18n.t("hsk.lesson_review_section_words"));
    const items = words
      .map((w, i) =>
        rowShell(
          i + 1,
          `<div class="hsk-lr-speak-row lesson-review-summary-word-item">
  <div class="hsk-lr-zh font-medium"${speakAttrs(w.zh)}>${escapeHtml(w.zh)}</div>
  ${w.pinyin ? `<div class="hsk-lr-py text-sm opacity-75">${escapeHtml(w.pinyin)}</div>` : ""}
  ${w.meaning ? `<div class="hsk-lr-mean text-sm mt-0.5">${escapeHtml(w.meaning)}</div>` : ""}
  ${w.exampleLine ? `<div class="hsk-lr-sub text-sm opacity-80 mt-1 pl-2 border-l-2 border-emerald-200">${escapeHtml(w.exampleLine)}</div>` : ""}
</div>`
        )
      )
      .join("");
    blocks.push(`<section class="hsk-lr-block mb-6" data-lesson-review-section="words">
  <h3 class="hsk-lr-block-title text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 mb-2">${title}</h3>
  <div class="hsk-lr-list space-y-0">${items}</div>
</section>`);
  }

  if (dialogue.length) {
    const title = escapeHtml(i18n.t("hsk.lesson_review_section_dialogue"));
    const items = dialogue
      .map((s, i) =>
        rowShell(
          i + 1,
          `<div class="hsk-lr-speak-row">
  ${s.speaker ? `<div class="text-xs opacity-60 mb-0.5">${escapeHtml(s.speaker)}</div>` : ""}
  <div class="hsk-lr-zh"${speakAttrs(s.zh)}>${escapeHtml(s.zh)}</div>
  ${s.pinyin ? `<div class="hsk-lr-py text-sm opacity-75">${escapeHtml(s.pinyin)}</div>` : ""}
  ${s.trans ? `<div class="hsk-lr-mean text-sm mt-0.5">${escapeHtml(s.trans)}</div>` : ""}
</div>`
        )
      )
      .join("");
    blocks.push(`<section class="hsk-lr-block mb-6" data-lesson-review-section="dialogue">
  <h3 class="hsk-lr-block-title text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 mb-2">${title}</h3>
  <div class="hsk-lr-list space-y-0">${items}</div>
</section>`);
  }

  if (grammar.length) {
    const title = escapeHtml(i18n.t("hsk.lesson_review_section_grammar"));
    const items = grammar
      .map((k, i) => {
        const exBlocks = (k.examples || [])
          .map(
            (ex) =>
              `<div class="hsk-lr-speak-row hsk-lr-sub text-sm mt-1 pl-2 border-l-2 border-amber-200/80">
  <span class="hsk-lr-zh"${speakAttrs(ex.zh)}>${escapeHtml(ex.zh)}</span>
  ${ex.pinyin ? `<div class="hsk-lr-py text-sm opacity-75">${escapeHtml(ex.pinyin)}</div>` : ""}
  ${ex.trans ? `<div class="opacity-80 text-sm">${escapeHtml(ex.trans)}</div>` : ""}
</div>`
          )
          .join("");
        return rowShell(
          i + 1,
          `<div class="font-medium text-slate-800 dark:text-slate-100">${escapeHtml(k.name)}</div>
  ${k.note ? `<div class="text-sm mt-0.5 opacity-90">${escapeHtml(k.note)}</div>` : ""}
  ${exBlocks}`
        );
      })
      .join("");
    blocks.push(`<section class="hsk-lr-block mb-6" data-lesson-review-section="grammar">
  <h3 class="hsk-lr-block-title text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 mb-2">${title}</h3>
  <div class="hsk-lr-list space-y-0">${items}</div>
</section>`);
  }

  if (extension.length) {
    const title = escapeHtml(i18n.t("hsk.lesson_review_section_extension"));
    const items = extension
      .map((e, i) =>
        rowShell(
          i + 1,
          `<div class="hsk-lr-speak-row">
  <div class="hsk-lr-zh"${speakAttrs(e.zh)}>${escapeHtml(e.zh)}</div>
  ${e.pinyin ? `<div class="hsk-lr-py text-sm opacity-75">${escapeHtml(e.pinyin)}</div>` : ""}
  ${e.trans ? `<div class="hsk-lr-mean text-sm mt-0.5">${escapeHtml(e.trans)}</div>` : ""}
  ${e.note ? `<div class="text-sm opacity-75 mt-0.5">${escapeHtml(e.note)}</div>` : ""}
</div>`
        )
      )
      .join("");
    blocks.push(`<section class="hsk-lr-block mb-6" data-lesson-review-section="extension">
  <h3 class="hsk-lr-block-title text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 mb-2">${title}</h3>
  <div class="hsk-lr-list space-y-0">${items}</div>
</section>`);
  }

  if (!blocks.length) {
    return `<div class="lesson-review-empty text-sm text-slate-500 dark:text-slate-400">${escapeHtml(i18n.t("hsk.lesson_review_empty_all"))}</div>`;
  }

  return `<div class="hsk-lesson-review lesson-review-summary-root text-[15px] leading-relaxed max-w-2xl">${blocks.join("")}</div>`;
}
