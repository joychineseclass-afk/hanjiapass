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
  if (qm < 0) return { char: "", query: "" };
  const p = new URLSearchParams(h.slice(qm + 1));
  return {
    char: (p.get("char") || "").trim(),
    query: (p.get("query") || p.get("q") || "").trim(),
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

function renderResult(area, res) {
  if (!area) return;
  const lang = getLang();
  const t = (k) => i18n.t(k);
  const stroke = res.stroke || { codePoint: 0, path: "", exists: false };
  const hasEntry = res.found && res.entry;
  const chFromQuery =
    res.query && isSingleCjkChar(res.query) ? res.query : firstCjkInString(res.query);
  const ch = (hasEntry && res.entry.char) || chFromQuery || "";
  const py = (hasEntry && res.entry.pinyin) || "";

  let mainMeaning = "";
  let mCn = "";
  let teach = "";
  let wordsHtml = "";

  if (hasEntry) {
    const e = res.entry;
    mainMeaning = pick(e.meaning, { lang }) || "";
    mCn = e.meaning?.cn || "";
    teach = pick(e.teachingNote, { lang }) || "";
    if (e.commonWords && e.commonWords.length) {
      wordsHtml = e.commonWords
        .map((w) => {
          const wm = pick(w.meaning, { lang }) || "";
          return `<li class="dict-cw-line">${esc(w.word)} <span class="dict-cw-py">${esc(w.pinyin || "")}</span> — ${esc(wm)}</li>`;
        })
        .join("");
    }
  }

  const missingLine = hasEntry
    ? ""
    : `<p class="dict-entry-missing muted">${esc(t("dictionary.entryMissing"))}</p>`;

  const strokeText = stroke.exists ? t("dictionary.strokeAvailable") : t("dictionary.strokeMissing");

  area.innerHTML = `
    <div class="dict-result-block">
      <div class="dict-char-head">
        <span class="dict-char-glyph">${ch ? esc(ch) : "—"}</span>
        <div class="dict-char-meta">
          <div class="dict-pinyin-line">${esc(py || "—")}</div>
        </div>
      </div>

      ${missingLine}

      <div class="dict-section">
        <h3 class="dict-subtitle">${esc(t("dictionary.meaningLabel"))}</h3>
        <p class="dict-body">${hasEntry ? esc(mainMeaning) : "—"}</p>
      </div>

      <div class="dict-section">
        <h3 class="dict-subtitle">${esc(t("dictionary.chineseExplanationLabel"))}</h3>
        <p class="dict-body">${hasEntry && mCn ? esc(mCn) : "—"}</p>
      </div>

      <div class="dict-section">
        <h3 class="dict-subtitle">${esc(t("dictionary.teachingNoteLabel"))}</h3>
        <p class="dict-body">${hasEntry && teach ? esc(teach) : "—"}</p>
      </div>

      <div class="dict-section">
        <h3 class="dict-subtitle">${esc(t("dictionary.commonWordsLabel"))}</h3>
        ${hasEntry && wordsHtml ? `<ul class="dict-cw-list">${wordsHtml}</ul>` : `<p class="dict-body muted">—</p>`}
      </div>

      <div class="dict-section dict-stroke-block">
        <h3 class="dict-subtitle">${esc(t("dictionary.strokeLabel"))}</h3>
        <p class="dict-body dict-stroke-status">${esc(strokeText)}</p>
        <div class="dict-actions">
          <button type="button" class="btn primary dict-open-stroke" ${ch ? "" : "disabled"} data-char="${ch ? esc(ch) : ""}">${esc(
    t("dictionary.openStroke")
  )}</button>
        </div>
      </div>
    </div>
  `;

  const strokeBtn = area.querySelector(".dict-open-stroke");
  strokeBtn?.addEventListener("click", () => {
    const c = strokeBtn.getAttribute("data-char");
    if (!c) return;
    navigateTo(`#stroke?char=${encodeURIComponent(c)}`, { force: true });
  });
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
