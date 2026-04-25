// ui/pages/page.dictionary.js — 字典查询（#dictionary?query= / #dictionary?char=）
import { i18n } from "../i18n.js";
import { pick, getLang } from "../core/languageEngine.js";
import { navigateTo } from "../router.js";
import { searchDictionary, isSingleCjkChar } from "../platform/dictionary/dictionaryEngine.js";

let _langHandler = null;

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
    .lumina-dictionary .inner{ padding:18px; display:grid; gap:12px; }
  `;
  document.head.appendChild(style);
}

function renderShell(container) {
  container.innerHTML = `
    <div class="lumina-dictionary">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <form id="dict-search-form" class="dict-search-form" action="#" method="get">
                <div class="dict-search-row">
                  <input type="search" id="dict-search-inp" class="input-box dict-input" autocomplete="off" />
                  <button type="submit" class="btn primary" data-i18n="common.search"></button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="card">
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

/** 当前 UI 语言无释义时：当前语言 → 中文 → 英文，避免仅 EN 的 CC-CEDICT 条空白 */
function wordMeaningWithFallback(e, lang) {
  const m = e?.meaning || {};
  const key = lang === "zh" || lang === "cn" ? "cn" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" ? "jp" : "en";
  const chain = [key, "cn", "en", "kr", "jp"].filter((x, i, a) => a.indexOf(x) === i);
  for (const k of chain) {
    const v = m[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function renderWordEntry(area, res) {
  if (!area) return;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const e = res.entry;
  let mainMeaning = wordMeaningWithFallback(e, lang);
  const mCn = e.meaning?.cn || "";
  if (!String(mainMeaning).trim() && mCn) mainMeaning = mCn;
  const showCnSecond =
    mCn &&
    !isDuplicateCnWithMainMeaning(lang, mainMeaning, mCn) &&
    String(mainMeaning || "").trim() !== String(mCn).trim();
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

  const meaningBlock =
    String(mainMeaning).trim() || showCnSecond
      ? `${String(mainMeaning).trim() ? `<p class="dictionary-main-meaning">${esc(mainMeaning)}</p>` : ""}${
          showCnSecond ? `<p class="dictionary-cn-explanation" lang="zh-CN">${esc(mCn)}</p>` : ""
        }`
      : "";

  area.innerHTML = `
    <article class="dictionary-entry-card dict-result-article dictionary-entry-card--word" lang="${esc(lang)}">
      <header class="dictionary-entry-head dictionary-word-head">
        <span class="dictionary-entry-word">${esc(e.word || "—")}</span>
        <span class="dictionary-entry-pinyin">${esc(e.pinyin || "—")}</span>
      </header>
      ${tradLine}
      ${meaningBlock}
      ${exampleBlock}
      ${compBlock}
    </article>
  `;
}

function renderWordNotFound(area, res) {
  if (!area) return;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const q = res.query || "";
  area.innerHTML = `
    <article class="dictionary-entry-card dict-result-article dictionary-entry-card--word" lang="${esc(lang)}">
      <header class="dictionary-entry-head dictionary-word-head">
        <span class="dictionary-entry-word">${q ? esc(q) : "—"}</span>
      </header>
      <p class="dictionary-entry-missing muted">${esc(t("dictionary.entryMissing"))}</p>
    </article>
  `;
}

function renderCharEntry(area, res) {
  if (!area) return;
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
  `;

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

function renderResult(area, res) {
  if (!area) return;
  const entry = res && res.entry;
  const isWord = res && (res.type === "word" || (entry && entry.type === "word"));
  if (isWord && res.found && entry) {
    renderWordEntry(area, res);
    return;
  }
  if (isWord && !res.found) {
    renderWordNotFound(area, res);
    return;
  }
  renderCharEntry(area, res);
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

  if (inp) {
    inp.setAttribute("data-i18n-placeholder", "dictionary.search.placeholder");
    inp.placeholder = i18n.t("dictionary.search.placeholder");
  }

  let busy = false;
  async function runSearch(rawTerm) {
    if (!area) return;
    const term = String(rawTerm || "").trim();
    if (busy) return;
    busy = true;
    if (!term) {
      area.innerHTML = `<p class="muted" data-i18n="dictionary.search.placeholder"></p>`;
      i18n.apply(area);
      busy = false;
      return;
    }
    if (!/[\u4e00-\u9fff]/.test(term) && !isSingleCjkChar(term)) {
      area.innerHTML = `<p class="muted">${esc(i18n.t("dictionary.entryMissing"))}</p>`;
      busy = false;
      return;
    }
    area.innerHTML = `<p class="muted">${esc(i18n.t("common.loading"))}</p>`;
    try {
      const res = await searchDictionary(term);
      if (typeof localStorage !== "undefined" && localStorage.getItem("DEBUG_DICT") === "1") {
        console.log("[dictionary] query", term, "result", res);
      }
      renderResult(area, res);
    } catch (e) {
      console.warn("[dictionary]", e);
      area.innerHTML = `<p class="muted">${esc(i18n.t("common.no_data"))}</p>`;
    } finally {
      busy = false;
    }
  }

  const initial = resolveSearchTerm();
  if (initial) {
    if (inp) inp.value = initial;
    runSearch(initial);
  }

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const s = String(inp?.value || "").trim();
    if (!s) return;
    navigateTo(`#dictionary?query=${encodeURIComponent(s)}`, { force: true });
  });

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
  if (_langHandler) {
    window.removeEventListener("joy:langChanged", _langHandler);
    window.removeEventListener("joy:lang", _langHandler);
    window.removeEventListener("i18n:changed", _langHandler);
    _langHandler = null;
  }
}

export default { mount, unmount };
