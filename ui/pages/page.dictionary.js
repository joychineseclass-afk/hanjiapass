// ui/pages/page.dictionary.js — 字典查询（#dictionary?query= / #dictionary?char=）
import { i18n } from "../i18n.js";
import { pick, getLang } from "../core/languageEngine.js";
import { navigateTo } from "../router.js";
import {
  searchDictionaryWithIdiomFallback,
  isSingleCjkChar,
  searchDictionarySuggestions,
} from "../platform/dictionary/dictionaryEngine.js";

let _langHandler = null;
/** @type {null | (() => void)} */
let _dictPageCleanup = null;

function getMountEl(ctxOrRoot) {
  if (ctxOrRoot && ctxOrRoot.nodeType === 1) return ctxOrRoot;
  return document.getElementById("app") || document.body;
}

function getDictQueryFromHash() {
  const h = typeof location !== "undefined" ? location.hash || "" : "";
  const qm = h.indexOf("?");
  if (qm < 0) return { char: "", query: "", fromWord: "" };
  const p = new URLSearchParams(h.slice(qm + 1));
  return {
    char: (p.get("char") || "").trim(),
    query: (p.get("query") || p.get("q") || "").trim(),
    fromWord: (p.get("fromWord") || "").trim(),
  };
}

function firstCjkInString(s) {
  const t = String(s || "");
  for (const c of t) {
    if (isSingleCjkChar(c)) return c;
  }
  return "";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// --- 数字声调 → 带调拼音（与 scripts/convert-cedict-sample.mjs 同源，供浏览器展示用）---

const _PY_TONE = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

function _pyGetToneVowelIndex(body) {
  const s = String(body).toLowerCase();
  if (s.includes("a")) return s.indexOf("a");
  if (s.includes("e")) return s.indexOf("e");
  if (s.includes("o")) return s.indexOf("o");
  if (s.length >= 2 && s.endsWith("iu")) return s.length - 1;
  if (s.length >= 2 && s.endsWith("ui")) return s.length - 1;
  if (s.includes("i") && s.includes("ü")) return s.indexOf("ü");
  if (s.includes("i")) return s.lastIndexOf("i");
  if (s.includes("u")) return s.indexOf("u");
  if (s.includes("ü") || s.includes("v")) return s.includes("ü") ? s.indexOf("ü") : s.indexOf("v");
  return 0;
}

function _pyCharAtCaseAware(orig, i, withTone) {
  const c = orig[i];
  return c && c === c.toUpperCase() && c !== c.toLowerCase() ? withTone.toUpperCase() : withTone;
}

function _pyAddToneToSyllableBody(body, tone) {
  const t = Math.min(4, Math.max(1, tone));
  const b = String(body);
  const lower = b.toLowerCase();
  const idx = _pyGetToneVowelIndex(b);
  const ch = lower[idx];
  const map = ch === "ü" || ch === "v" ? _PY_TONE.ü : _PY_TONE[ch];
  if (!map) return lower;
  const repl = _pyCharAtCaseAware(b, idx, map[t - 1]);
  return b.slice(0, idx) + repl + b.slice(idx + 1);
}

/**
 * 单音节如 "shou3" / "xie5" → 带调或轻声
 * @param {string} token
 */
function numberedSyllableToToneMark(token) {
  const m = String(token).match(/^(.+?)([1-5])$/i);
  if (!m) return String(token).toLowerCase();
  const body = m[1];
  const t = +m[2];
  if (t === 5) return body.toLowerCase();
  return _pyAddToneToSyllableBody(body, t);
}

/**
 * "shou3 zhu1 dai4 tu4" → "shǒu zhū dài tù"（音节后空格，便于学习）
 * @param {string} input
 */
function numberedPinyinToDisplay(input) {
  return String(input || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((syllable) => numberedSyllableToToneMark(syllable))
    .join(" ");
}

/**
 * 标题旁拼音：有 pinyinNumbered 时优先用其生成带空格学习版
 * @param {object} entry
 */
function displayPinyin(entry) {
  if (entry?.pinyinNumbered) {
    return numberedPinyinToDisplay(entry.pinyinNumbered);
  }
  return entry?.pinyin || "";
}

/** 候选行拼音：有 pinyinNumbered 时优先学习者友好分音节展示 */
function suggestionPinyinForDisplay(s) {
  if (s?.pinyinNumbered) return numberedPinyinToDisplay(s.pinyinNumbered);
  return s?.pinyin || "";
}

/**
 * 与当前主结果同词的候选项不展示
 * @param {any} res
 * @returns {string}
 */
function getSuggestionExcludeKey(res) {
  if (!res) return "";
  if (!res.found) return String(res.query || "").trim();
  const e = res.entry;
  if (!e) return String(res.query || "").trim();
  if (res.type === "culture-idiom" || e.idiom) return String(e.idiom || "").trim();
  if (e.type === "word" || (res.type === "word" && e.word)) return String(e.word || e.query || "").trim();
  if (e.type === "char" || e.char) return String(e.char || "").trim();
  return String(res.query || "").trim();
}

/**
 * 相关词条 HTML（可接在结果卡片后）
 * @param {any[]} suggestions
 * @param {(k:string)=>string} t
 */
function buildRelatedEntriesHtml(suggestions, t) {
  if (!suggestions || !suggestions.length) return "";
  const label = t("dictionary.relatedEntriesLabel");
  const items = suggestions
    .map((s) => {
      const w = s.word || s.query || "";
      if (!w) return "";
      const py = suggestionPinyinForDisplay(s);
      const href = `#dictionary?query=${encodeURIComponent(w)}`;
      return `<a class="dictionary-related-item" href=${JSON.stringify(href)}>
  <span class="dictionary-related-word">${esc(w)}</span>
  <span class="dictionary-related-pinyin">${esc(py || "—")}</span>
</a>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  return `<div class="dictionary-related-card" role="region" aria-label="${esc(label)}">
  <h2 class="dictionary-section-title">${esc(label)}</h2>
  <div class="dictionary-related-list">${items}</div>
</div>`;
}

function bindRelatedEntryLinks(container) {
  if (!container) return;
  container.querySelectorAll("a.dictionary-related-item[href^='#dictionary']").forEach((a) => {
    a.addEventListener("click", (ev) => {
      const href = a.getAttribute("href");
      if (href) {
        ev.preventDefault();
        navigateTo(href, { force: true });
      }
    });
  });
}

/** 当前为中文 UI 时，主释义与 meaning.cn 是否重复，避免同句显示两次 */
function isDuplicateCnWithMainMeaning(lang, mainMeaning, mCn) {
  if (lang !== "cn" || !mCn) return false;
  return String(mainMeaning || "").trim() === String(mCn).trim();
}

function ensureDictStyles() {
  if (document.getElementById("lumina-dictionary-style")) return;
  const style = document.createElement("style");
  style.id = "lumina-dictionary-style";
  style.textContent = `
    .lumina-dictionary{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-dictionary .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-dictionary .section{ padding:10px 0 18px; }
    .lumina-dictionary .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-dictionary .dictionary-search-section{ position:relative; z-index:50; }
    .lumina-dictionary .dictionary-search-section .dictionary-search-card{ overflow:visible; position:relative; z-index:50; }
    .lumina-dictionary .dictionary-search-section .dictionary-search-card > .inner{ overflow:visible; }
    .lumina-dictionary .dictionary-result-section{ position:relative; z-index:1; }
    .lumina-dictionary .inner{ padding:18px; display:grid; gap:12px; }
    #dict-result-area,
    .lumina-dictionary .dictionary-entry-card{ position:relative; z-index:1; }
    .dictionary-idiom-fallback-card{ border-radius: calc(var(--radius,12px) + 4px); border:1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.9); padding: 18px 20px; display:grid; gap: 14px; }
    .dictionary-idiom-fallback-card .dictionary-idiom-title{ font-size: 1.35rem; font-weight: 700; letter-spacing: 0.02em; }
    .dictionary-idiom-fallback-card .dictionary-idiom-pinyin{ font-size: 0.95rem; color: var(--muted,#64748b); }
    .dictionary-idiom-fallback-card .dictionary-idiom-msg{ line-height: 1.5; }
    .dictionary-idiom-fallback-card .dictionary-idiom-open{ display:inline-block; }
    .dictionary-review-pending-hint{ margin:0; font-size:0.9rem; line-height:1.5; color: var(--muted,#64748b); }
    .dictionary-related-card{ margin-top:22px; padding:22px 24px; border-radius:22px; background:#fff; border:1px solid rgba(148,163,184,.25); box-shadow:0 10px 28px rgba(15,23,42,.04); }
    .dictionary-related-list{ display:grid; gap:10px; margin-top:14px; }
    .dictionary-related-item{ display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:14px; padding:12px 14px; border-radius:14px; background:#f8fafc; text-decoration:none; color:inherit; }
    .dictionary-related-word{ font-size:18px; font-weight:800; color:#0f172a; }
    .dictionary-related-pinyin{ font-size:14px; font-weight:700; color:#64748b; }
    .dictionary-autocomplete{ position:absolute; top: calc(100% + 10px); left:0; right:0; z-index:9999; max-height:360px; overflow-y:auto; padding:8px; border-radius:18px; background: rgba(255,255,255,0.98); border:1px solid rgba(148,163,184,0.32); box-shadow:0 22px 50px rgba(15,23,42,0.18); }
    .dictionary-autocomplete[hidden]{ display:none !important; }
    .dictionary-autocomplete-item{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; width:100%; padding:10px 12px; border:0; border-radius:12px; background:transparent; cursor:pointer; text-align:left; font: inherit; }
    .dictionary-autocomplete-item:hover,
    .dictionary-autocomplete-item.is-active{ background:#eff6ff; }
    .dictionary-autocomplete-word{ font-size:16px; font-weight:800; color:#0f172a; }
    .dictionary-autocomplete-pinyin{ font-size:13px; font-weight:700; color:#64748b; }
    @media (max-width: 640px) {
      .dictionary-autocomplete-item{ align-items:flex-start; flex-direction:column; }
    }
  `;
  document.head.appendChild(style);
}

function renderShell(container) {
  container.innerHTML = `
    <div class="lumina-dictionary">
      <section class="section dictionary-search-section">
        <div class="wrap">
          <div class="card dictionary-search-card">
            <div class="inner">
              <form id="dict-search-form" class="dict-search-form" action="#" method="get">
                <div class="dict-search-row">
                  <div class="dictionary-search-wrap">
                    <input type="search" id="dict-search-inp" class="input-box dict-input" autocomplete="off" />
                    <div id="dictionary-autocomplete" class="dictionary-autocomplete" hidden role="listbox" aria-label="Suggestions"></div>
                  </div>
                  <button type="submit" class="btn primary" data-i18n="common.search"></button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
      <section class="section dictionary-result-section">
        <div class="wrap">
          <div class="card dictionary-result-card">
            <div class="inner" id="dict-result-area" aria-live="polite">
              <p class="muted" data-i18n="dictionary.search.placeholder"></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

/** 词语中可点击的 CJK 单字 */
function wordComponentChars(word) {
  return [...String(word || "")].filter((c) => isSingleCjkChar(c));
}

function renderComponentCharRow(char, sourceWord, t) {
  const fw = encodeURIComponent(sourceWord);
  const cenc = encodeURIComponent(char);
  return `<div class="dictionary-component-char-row">
  <span class="dictionary-component-char-main">${esc(char)}</span>
  <span class="dictionary-component-char-actions">
    <a class="dictionary-component-link" href="#dictionary?char=${cenc}&fromWord=${fw}">${esc(
    t("dictionary.component.dictionary")
  )}</a>
    <span class="dictionary-component-sep" aria-hidden="true">|</span>
    <a class="dictionary-component-link" href="#stroke?char=${cenc}&fromWord=${fw}">${esc(
    t("dictionary.component.stroke")
  )}</a>
  </span>
</div>`;
}

/** 当前 UI 语言无释义时：当前语言 → 中文 → 英文等；raw CC-CEDICT 常仅有 meaning.en，须能展示英文 */
function wordMeaningWithFallback(e, lang) {
  const m = e?.meaning || {};
  const key = lang === "zh" || lang === "cn" ? "cn" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" ? "jp" : "en";
  const chain = [key, "cn", "en", "kr", "jp"].filter((x, i, a) => a.indexOf(x) === i);
  for (const k of chain) {
    const v = m[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  if (m.en != null && String(m.en).trim()) return String(m.en).trim();
  return "";
}

function wordEntryHasAnyMeaningField(e) {
  const m = e?.meaning || {};
  return ["cn", "kr", "en", "jp"].some((k) => m[k] != null && String(m[k]).trim() !== "");
}

function renderWordEntry(area, res, options = {}) {
  if (!area) return;
  const { suggestions = [] } = options;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const e = res.entry;
  const mCn = e.meaning?.cn || "";
  const primary = wordMeaningWithFallback(e, lang);
  let line = primary;
  if (!String(line).trim() && mCn) line = mCn;
  const hasMeaning = wordEntryHasAnyMeaningField(e);
  const showCnSecond =
    hasMeaning &&
    mCn &&
    String(line).trim() &&
    !isDuplicateCnWithMainMeaning(lang, line, mCn) &&
    String(line).trim() !== String(mCn).trim();
  const trad = e.traditional || "";
  const showTrad = String(trad).trim() && String(trad).trim() !== String(e.word || "").trim();
  const tradLine = showTrad
    ? `<p class="dictionary-traditional-row"><span class="dictionary-traditional-label">${esc(
        t("dictionary.traditionalLabel")
      )}</span>：${esc(String(trad).trim())}</p>`
    : "";

  const exCn = e.example?.cn || "";
  const exPy = e.examplePinyin || "";
  const exTrans = e.example ? pick(e.example, { lang }) || "" : "";
  const showExTrans = exTrans && (lang !== "cn" || String(exTrans).trim() !== String(exCn).trim());

  const exampleBlock =
    exCn || exPy
      ? `<h2 class="dictionary-section-title">${esc(t("dictionary.exampleLabel"))}</h2>
      <div class="dictionary-example-block">
        ${exCn ? `<p class="dictionary-example-cn" lang="zh-CN">${esc(exCn)}</p>` : ""}
        ${exPy ? `<p class="dictionary-example-pinyin">${esc(exPy)}</p>` : ""}
        ${showExTrans ? `<p class="dictionary-example-tr">${esc(exTrans)}</p>` : ""}
      </div>`
      : "";

  const sourceWord = e.word || "";
  const chars = wordComponentChars(sourceWord);
  const compBlock =
    chars.length > 0
      ? `<h2 class="dictionary-section-title">${esc(t("dictionary.componentsLabel"))}</h2>
      <div class="dictionary-component-char-list" role="list">
        ${chars.map((c) => renderComponentCharRow(c, sourceWord, t)).join("")}
      </div>`
      : "";

  const meaningBlock = hasMeaning
    ? String(line).trim()
      ? `${`<p class="dictionary-main-meaning">${esc(line)}</p>`}${
          showCnSecond ? `<p class="dictionary-cn-explanation" lang="zh-CN">${esc(mCn)}</p>` : ""
        }`
      : `<p class="dictionary-main-meaning muted">${esc(t("dictionary.meaningNotIndexed"))}</p>`
    : `<p class="dictionary-main-meaning muted">${esc(t("dictionary.meaningNotIndexed"))}</p>`;

  const showRawReviewHint = e.qualityLevel === "raw" && e.needsReview === true;
  const reviewHintBlock = showRawReviewHint
    ? `<p class="dictionary-review-pending-hint" role="note">${esc(t("dictionary.reviewPendingHint"))}</p>`
    : "";

  const headPinyin = displayPinyin(e) || e.pinyin || "—";
  const related = buildRelatedEntriesHtml(suggestions, t);

  area.innerHTML = `
    <article class="dictionary-entry-card dict-result-article dictionary-entry-card--word" lang="${esc(lang)}">
      <header class="dictionary-entry-head dictionary-word-head">
        <span class="dictionary-entry-word">${esc(e.word || "—")}</span>
        <span class="dictionary-entry-pinyin">${esc(headPinyin)}</span>
      </header>
      ${tradLine}
      ${meaningBlock}
      ${reviewHintBlock}
      ${exampleBlock}
      ${compBlock}
    </article>
    ${related}
  `;
  bindRelatedEntryLinks(area);
}

function renderWordNotFound(area, res, options = {}) {
  if (!area) return;
  const { suggestions = [] } = options;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const q = res.query || "";
  const related = buildRelatedEntriesHtml(suggestions, t);
  area.innerHTML = `
    <article class="dictionary-entry-card dict-result-article dictionary-entry-card--word" lang="${esc(lang)}">
      <header class="dictionary-entry-head dictionary-word-head">
        <span class="dictionary-entry-word">${q ? esc(q) : "—"}</span>
      </header>
      <p class="dictionary-entry-missing muted">${esc(t("dictionary.entryMissing"))}</p>
    </article>
    ${related}
  `;
  bindRelatedEntryLinks(area);
}

function renderCharEntry(area, res, options = {}) {
  if (!area) return;
  const { suggestions = [] } = options;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const { fromWord } = getDictQueryFromHash();
  const backToWordBlock = fromWord
    ? `<a class="dictionary-back-link" href="#dictionary?query=${encodeURIComponent(fromWord)}">← ${esc(
        t("dictionary.backToWord")
      )}：${esc(fromWord)}</a>`
    : "";
  const stroke = res.stroke || { codePoint: 0, path: "", exists: false };
  const hasEntry = res.found && res.entry;
  const chFromQuery =
    res.query && isSingleCjkChar(res.query) ? res.query : firstCjkInString(res.query);
  const ch = (hasEntry && res.entry && res.entry.char) || chFromQuery || "";
  const py = (hasEntry && res.entry && res.entry.pinyin) || "";

  let mainMeaning = "";
  let mCn = "";
  let teach = "";
  let wordsHtml = "";
  const commonWords = hasEntry && res.entry.commonWords && res.entry.commonWords.length ? res.entry.commonWords : null;

  if (hasEntry) {
    const e = res.entry;
    mainMeaning = pick(e.meaning, { lang }) || "";
    mCn = e.meaning?.cn || "";
    if (!String(mainMeaning).trim() && mCn) mainMeaning = mCn;
    teach = pick(e.teachingNote, { lang }) || "";
    if (commonWords) {
      wordsHtml = commonWords
        .map((w) => {
          const wm = pick(w.meaning, { lang }) || "";
          return `<li class="dict-cw-line">${esc(w.word)} <span class="dict-cw-py">${esc(w.pinyin || "")}</span> — ${esc(
            wm
          )}</li>`;
        })
        .join("");
    }
  }

  const showCnSecond =
    hasEntry &&
    mCn &&
    !isDuplicateCnWithMainMeaning(lang, mainMeaning, mCn) &&
    String(mainMeaning || "").trim() !== String(mCn).trim();
  const showTeach = hasEntry && teach;
  const showCommonBlock = hasEntry && commonWords;

  const missingLine = hasEntry
    ? ""
    : `<p class="dictionary-entry-missing muted">${esc(t("dictionary.entryMissing"))}</p>`;

  const strokeText = stroke.exists ? t("dictionary.strokeAvailable") : t("dictionary.strokeMissing");

  const headBlock = `
    <header class="dictionary-entry-head">
      <span class="dictionary-entry-char">${ch ? esc(ch) : "—"}</span>
      <span class="dictionary-entry-pinyin">${esc(py || "—")}</span>
    </header>`;

  const meaningBlock =
    hasEntry && String(mainMeaning).trim()
      ? `<p class="dictionary-main-meaning">${esc(mainMeaning)}</p>${
          showCnSecond
            ? `<p class="dictionary-cn-explanation" lang="zh-CN">${esc(mCn)}</p>`
            : ""
        }`
      : "";

  const teachBlock = showTeach
    ? `<div class="dictionary-learning-note" role="note">${esc(teach)}</div>`
    : "";

  const commonBlock = showCommonBlock
    ? `<h2 class="dictionary-section-title">${esc(t("dictionary.commonWordsLabel"))}</h2>
        <ul class="dictionary-cw-list">${wordsHtml}</ul>`
    : "";

  const strokeBlock = `
    <h2 class="dictionary-section-title">${esc(t("dictionary.strokeLabel"))}</h2>
    <p class="dictionary-stroke-status">${esc(strokeText)}</p>
    <div class="dictionary-stroke-actions">
      <button type="button" class="btn primary dict-open-stroke" ${ch ? "" : "disabled"} data-char="${ch ? esc(ch) : ""}">${esc(
    t("dictionary.openStroke")
  )}</button>
    </div>`;

  const related = buildRelatedEntriesHtml(suggestions, t);
  area.innerHTML = `
    <article class="dictionary-entry-card dict-result-article" lang="${esc(lang)}">
      ${backToWordBlock}
      ${headBlock}
      ${missingLine}
      ${meaningBlock}
      ${teachBlock}
      ${commonBlock}
      <div class="dictionary-stroke-section">
        ${strokeBlock}
      </div>
    </article>
    ${related}
  `;
  bindRelatedEntryLinks(area);

  const strokeBtn = area.querySelector(".dict-open-stroke");
  strokeBtn?.addEventListener("click", () => {
    const c = strokeBtn.getAttribute("data-char");
    if (!c) return;
    const q = fromWord
      ? `#stroke?char=${encodeURIComponent(c)}&fromWord=${encodeURIComponent(fromWord)}`
      : `#stroke?char=${encodeURIComponent(c)}`;
    navigateTo(q, { force: true });
  });
}

function renderIdiomFallbackCard(area, res, options = {}) {
  if (!area) return;
  const { suggestions = [] } = options;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const e = res.entry;
  const id = e?.id ? encodeURIComponent(e.id) : "";
  const href = id ? `#culture?tab=idioms&id=${id}` : "#culture?tab=idioms";
  const related = buildRelatedEntriesHtml(suggestions, t);
  area.innerHTML = `
    <article class="dictionary-entry-card dictionary-idiom-fallback-card dict-result-article" lang="${esc(lang)}">
      <div>
        <div class="dictionary-idiom-title">${esc(e?.idiom || "—")}</div>
        <div class="dictionary-idiom-pinyin">${esc(e?.pinyin || "")}</div>
      </div>
      <p class="dictionary-idiom-msg muted">${esc(t("dictionary.idiomFallback.message"))}</p>
      <div>
        <a class="btn primary dictionary-idiom-open" href="${href}">${esc(t("dictionary.idiomFallback.open"))}</a>
      </div>
    </article>
    ${related}
  `;
  bindRelatedEntryLinks(area);
  const a = area.querySelector("a.dictionary-idiom-open");
  a?.addEventListener("click", (ev) => {
    ev.preventDefault();
    navigateTo(href, { force: true });
  });
}

function renderResult(area, res, options = {}) {
  if (!area) return;
  const { suggestions: rawSug = [] } = options;
  const ex = getSuggestionExcludeKey(res);
  const suggestions = (rawSug || [])
    .filter((s) => {
      const w = String(s.word || s.query || "").trim();
      return w && w !== ex;
    })
    .slice(0, 10);

  if (res && res.found && res.type === "culture-idiom" && res.entry) {
    renderIdiomFallbackCard(area, res, { suggestions });
    return;
  }
  const entry = res && res.entry;
  const isWord = res && (res.type === "word" || (entry && entry.type === "word"));
  if (isWord && res.found && entry) {
    renderWordEntry(area, res, { suggestions });
    return;
  }
  if (isWord && !res.found) {
    renderWordNotFound(area, res, { suggestions });
    return;
  }
  renderCharEntry(area, res, { suggestions });
}

function resolveSearchTerm() {
  const { char, query } = getDictQueryFromHash();
  if (char) return char;
  if (query) return query;
  return "";
}

export function mount(ctxOrRoot) {
  const el = getMountEl(ctxOrRoot?.root || ctxOrRoot?.app || ctxOrRoot);
  if (!el) return;

  ensureDictStyles();
  renderShell(el);
  i18n.apply(el);

  const inp = el.querySelector("#dict-search-inp");
  const form = el.querySelector("#dict-search-form");
  const area = el.querySelector("#dict-result-area");
  const acEl = el.querySelector("#dictionary-autocomplete");

  if (inp) {
    inp.setAttribute("data-i18n-placeholder", "dictionary.search.placeholder");
    inp.placeholder = i18n.t("dictionary.search.placeholder");
  }

  const acState = {
    items: /** @type {any[]} */ ([]),
    active: -1,
    req: 0,
    debounceTimer: /** @type {ReturnType<typeof setTimeout> | null} */ (null),
    blurTimer: /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  };

  function closeAutocomplete() {
    if (acState.blurTimer) {
      clearTimeout(acState.blurTimer);
      acState.blurTimer = null;
    }
    acState.items = [];
    acState.active = -1;
    if (acEl) {
      acEl.hidden = true;
      acEl.innerHTML = "";
    }
  }

  function updateAutocompleteActiveClass() {
    if (!acEl) return;
    acEl.querySelectorAll(".dictionary-autocomplete-item").forEach((node, i) => {
      node.classList.toggle("is-active", i === acState.active);
    });
  }

  function renderAutocomplete(list) {
    if (!acEl) return;
    if (!list.length) {
      closeAutocomplete();
      return;
    }
    acState.items = list;
    acState.active = -1;
    acEl.innerHTML = list
      .map((s, i) => {
        const w = s.word || s.query || "";
        const py = suggestionPinyinForDisplay(s) || (s.pinyin ? String(s.pinyin) : "");
        return `<button type="button" class="dictionary-autocomplete-item" role="option" data-index="${i}" data-word=${JSON.stringify(
          w
        )}>
  <span class="dictionary-autocomplete-word">${esc(w)}</span>
  <span class="dictionary-autocomplete-pinyin">${esc(py || "—")}</span>
</button>`;
      })
      .join("");
    acEl.hidden = false;
    updateAutocompleteActiveClass();
  }

  function isAutocompleteOpen() {
    return !!(acEl && !acEl.hidden && acState.items.length);
  }

  function scheduleAutocomplete() {
    if (acState.debounceTimer) clearTimeout(acState.debounceTimer);
    const q0 = String(inp?.value || "").trim();
    if (!q0) {
      closeAutocomplete();
      return;
    }
    const hasCjk = /[\u4e00-\u9fff]/.test(q0);
    const piny = /^[a-zA-Z0-9\s'·.]+$/.test(String(q0).replace(/\s/g, " ").trim());
    if (!hasCjk && !isSingleCjkChar(q0) && !piny) {
      closeAutocomplete();
      return;
    }
    acState.debounceTimer = setTimeout(async () => {
      acState.debounceTimer = null;
      const q = String(inp?.value || "").trim();
      if (!q) {
        closeAutocomplete();
        return;
      }
      const my = ++acState.req;
      try {
        const list = await searchDictionarySuggestions(q, { limit: 8 });
        if (my !== acState.req) return;
        if (q !== String(inp?.value || "").trim()) return;
        renderAutocomplete(list);
      } catch (err) {
        console.warn("[dictionary] autocomplete", err);
        if (my === acState.req) closeAutocomplete();
      }
    }, 180);
  }

  let busy = false;
  async function runSearch(rawTerm) {
    if (!area) return;
    closeAutocomplete();
    const term = String(rawTerm || "").trim();
    if (busy) return;
    busy = true;
    if (!term) {
      area.innerHTML = `<p class="muted" data-i18n="dictionary.search.placeholder"></p>`;
      i18n.apply(area);
      busy = false;
      return;
    }
    const hasCjk = /[\u4e00-\u9fff]/.test(term);
    const pinyinish = /^[a-zA-Z0-9\s'·.]+$/.test(String(term).replace(/\s/g, " ").trim());
    if (!hasCjk && !isSingleCjkChar(term) && !pinyinish) {
      area.innerHTML = `<p class="muted">${esc(i18n.t("dictionary.entryMissing"))}</p>`;
      busy = false;
      return;
    }
    area.innerHTML = `<p class="muted">${esc(i18n.t("common.loading"))}</p>`;
    try {
      const res = await searchDictionaryWithIdiomFallback(term);
      if (typeof localStorage !== "undefined" && localStorage.getItem("DEBUG_DICT") === "1") {
        console.log("[dictionary] query", term, "result", res);
      }
      let rawSug = [];
      try {
        rawSug = await searchDictionarySuggestions(term, { limit: 200 });
      } catch (sugErr) {
        console.warn("[dictionary] suggestions", sugErr);
      }
      renderResult(area, res, { suggestions: rawSug });
    } catch (e) {
      console.warn("[dictionary]", e);
      area.innerHTML = `<p class="muted">${esc(i18n.t("common.no_data"))}</p>`;
    } finally {
      busy = false;
    }
  }

  const acAbort = new AbortController();
  const { signal } = acAbort;

  if (acEl) {
    acEl.addEventListener(
      "mousedown",
      (e) => {
        if (e.target instanceof Element && e.target.closest(".dictionary-autocomplete-item")) e.preventDefault();
      },
      { signal }
    );
    acEl.addEventListener(
      "click",
      (e) => {
        const btn = e.target && e.target.closest && e.target.closest("button.dictionary-autocomplete-item");
        if (!btn) return;
        const w = btn.getAttribute("data-word");
        if (w) {
          e.preventDefault();
          e.stopPropagation();
          closeAutocomplete();
          navigateTo(`#dictionary?query=${encodeURIComponent(w)}`, { force: true });
        }
      },
      { signal }
    );
  }

  if (inp) {
    inp.addEventListener("input", () => scheduleAutocomplete(), { signal });
    inp.addEventListener("focus", () => {
      if (acState.blurTimer) {
        clearTimeout(acState.blurTimer);
        acState.blurTimer = null;
      }
    }, { signal });
    inp.addEventListener("blur", () => {
      acState.blurTimer = setTimeout(() => {
        acState.blurTimer = null;
        closeAutocomplete();
      }, 120);
    }, { signal });
    inp.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && isAutocompleteOpen()) {
          e.preventDefault();
          e.stopPropagation();
          closeAutocomplete();
          return;
        }
        if (e.key === "ArrowDown" && isAutocompleteOpen()) {
          e.preventDefault();
          acState.active = Math.min(acState.items.length - 1, acState.active + 1);
          updateAutocompleteActiveClass();
          return;
        }
        if (e.key === "ArrowUp" && isAutocompleteOpen()) {
          e.preventDefault();
          acState.active = Math.max(-1, acState.active - 1);
          updateAutocompleteActiveClass();
          return;
        }
        if (e.key === "Enter" && isAutocompleteOpen() && acState.active >= 0) {
          const s = acState.items[acState.active];
          const w = s && (s.word || s.query);
          if (w) {
            e.preventDefault();
            e.stopPropagation();
            closeAutocomplete();
            navigateTo(`#dictionary?query=${encodeURIComponent(String(w))}`, { force: true });
          }
        }
      },
      { signal }
    );
  }

  const initial = resolveSearchTerm();
  if (initial) {
    if (inp) inp.value = initial;
    runSearch(initial);
  }

  const onFormSubmit = (ev) => {
    ev.preventDefault();
    closeAutocomplete();
    const s = String(inp?.value || "").trim();
    if (!s) return;
    navigateTo(`#dictionary?query=${encodeURIComponent(s)}`, { force: true });
  };
  form?.addEventListener("submit", onFormSubmit, { signal });

  _dictPageCleanup = () => {
    acAbort.abort();
    if (acState.debounceTimer) clearTimeout(acState.debounceTimer);
    if (acState.blurTimer) clearTimeout(acState.blurTimer);
  };

  _langHandler = () => {
    i18n.apply(el);
    if (inp) inp.placeholder = i18n.t("dictionary.search.placeholder");
    const again = resolveSearchTerm() || String(inp?.value || "").trim();
    if (again) runSearch(again);
  };

  window.addEventListener("joy:langChanged", _langHandler);
  window.addEventListener("joy:lang", _langHandler);
  window.addEventListener("i18n:changed", _langHandler);
}

export function unmount() {
  if (typeof _dictPageCleanup === "function") {
    _dictPageCleanup();
    _dictPageCleanup = null;
  }
  if (_langHandler) {
    window.removeEventListener("joy:langChanged", _langHandler);
    window.removeEventListener("joy:lang", _langHandler);
    window.removeEventListener("i18n:changed", _langHandler);
    _langHandler = null;
  }
}

export default { mount, unmount };
