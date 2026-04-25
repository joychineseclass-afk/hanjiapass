// ui/pages/page.stroke.js
// ✅ 统一平台风格：与 Home / HSK 一致的 card/section 布局
// ✅ 全部文案走 i18n，支持 KR/CN/EN/JP
// ✅ 语言切换后完整 rerender

import { i18n } from "../i18n.js";
import { getLang, pick } from "../core/languageEngine.js";
import { mountStrokeSwitcher } from "../ui-stroke-player.js";
import { findInHSK } from "../hskLookup.js";
import { getDictionaryEntryByChar } from "../platform/dictionary/dictionaryEngine.js";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getStrokeFromWordParam() {
  const h = typeof location !== "undefined" ? location.hash || "" : "";
  const qm = h.indexOf("?");
  if (qm < 0) return "";
  return (new URLSearchParams(h.slice(qm + 1)).get("fromWord") || "").trim();
}

function buildDictCharHref(c, fromWord) {
  const cenc = encodeURIComponent(c);
  if (!fromWord) return `#dictionary?char=${cenc}`;
  return `#dictionary?char=${cenc}&fromWord=${encodeURIComponent(fromWord)}`;
}

/** 笔顺区上方：字典引擎简短摘要 + 跳转 #dictionary?char=（可带 fromWord） */
async function renderDictionaryDigest(ch) {
  const el = document.getElementById("stroke-dict-digest");
  if (!el) return;
  if (!isHan(String(ch).trim())) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  const c = Array.from(String(ch).trim())[0] || "";
  if (!c) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  const fromWord = getStrokeFromWordParam();
  const backToWordBlock = fromWord
    ? `<div class="stroke-dict-backword"><a class="dictionary-back-link stroke-dict-backword-link" href="#dictionary?query=${encodeURIComponent(
        fromWord
      )}">← ${esc(i18n.t("dictionary.backToWord"))}：${esc(fromWord)}</a></div>`
    : "";
  const dictHref = buildDictCharHref(c, fromWord);
  el.hidden = false;
  el.innerHTML = `<div class="stroke-dict-digest-skel muted">${esc(i18n.t("common.loading"))}</div>`;
  try {
    const res = await getDictionaryEntryByChar(c);
    const lang = getLang();
    if (res.found && res.entry) {
      const line = pick(res.entry.meaning, { lang }) || "";
      const py = res.entry.pinyin || "";
      el.innerHTML = `
        ${backToWordBlock}
        <div class="stroke-dict-digest-inner stroke-dict-digest--compact">
          <div class="stroke-dict-topline">
            <span class="stroke-dict-ch">${esc(c)}</span>
            <span class="stroke-dict-py">${esc(py)}</span>
          </div>
          <p class="stroke-dict-meaning-line">${esc(line)}</p>
          <a class="stroke-dict-more" href="${esc(dictHref)}"><span data-i18n="dictionary.viewDetail"></span></a>
        </div>`;
    } else {
      el.innerHTML = `
        ${backToWordBlock}
        <div class="stroke-dict-digest-inner stroke-dict-digest--compact stroke-dict-digest--empty">
          <p class="stroke-dict-meaning-line muted" data-i18n="dictionary.entryMissing"></p>
          <a class="stroke-dict-more" href="${esc(dictHref)}"><span data-i18n="dictionary.viewDetail"></span></a>
        </div>`;
    }
  } catch (e) {
    console.warn("[stroke] dictionary digest:", e);
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  i18n.apply(el);
}

/** 释义区：从 HSK 里查并渲染（随语言切换） */
async function renderMeaningFromHSK(ch) {
  const area = document.getElementById("stroke-meaning-area");
  if (!area) return;

  area.innerHTML = `<div style="opacity:.6">${i18n.t("stroke.loading")}</div>`;

  const hits = await findInHSK(ch, { max: 8 });

  if (!hits.length) {
    area.innerHTML = `<div style="opacity:.6">${i18n.t("stroke.not_found")}</div>`;
    return;
  }

  const labelPinyin = i18n.t("stroke.meaning_pinyin") || "Pinyin";
  const labelKorean = i18n.t("stroke.meaning_korean") || "Korean";
  const labelExample = i18n.t("stroke.meaning_example") || "Example";

  area.innerHTML = hits
    .map(
      (h) => `
    <div style="margin:12px 0; padding:12px; border:1px solid #eee; border-radius:12px">
      <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap">
        <div><b>${h.word}</b></div>
        <div style="opacity:.7">HSK${h.level}</div>
      </div>

      <div><b>${labelPinyin}:</b> ${h.pinyin || "-"}</div>
      <div><b>${labelKorean}:</b> ${h.kr || "-"}</div>

      ${
        h.example?.cn
          ? `
        <div style="margin-top:8px; opacity:.9">
          <div><b>${labelExample}:</b> ${h.example.cn}</div>
          <div><b>${labelPinyin}:</b> ${h.example.py || "-"}</div>
          <div><b>${labelKorean}:</b> ${h.example.kr || "-"}</div>
        </div>
      `
          : ""
      }
    </div>
  `
    )
    .join("");
}

function getMountEl(root) {
  if (root && root.nodeType === 1) return root;
  return document.getElementById("app") || document.body;
}

function render(container) {
  container.innerHTML = `
    <div class="lumina-stroke">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h1 class="page-title" data-i18n="stroke.title"></h1>
              <p class="page-desc" data-i18n="stroke.desc"></p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="card stroke-input-card">
            <div class="inner">
              <h2 class="section-title" data-i18n="stroke.input_label"></h2>
              <div class="stroke-input-row">
                <input
                  id="stroke-input"
                  class="input-box"
                  data-i18n-placeholder="stroke.input_ph"
                  maxlength="4"
                />
                <button id="stroke-load-btn" class="btn primary" data-i18n="stroke.load_btn"></button>
              </div>
              <span id="stroke-file-hint" class="muted"></span>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h2 class="section-title" data-i18n="stroke.player_title"></h2>
              <div id="stroke-dict-digest" class="stroke-dict-digest" hidden></div>
              <div id="stroke-root" class="stroke-player-wrap"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="card stroke-meaning-card">
            <div class="inner">
              <h2 class="section-title" data-i18n="stroke.meaning_title"></h2>
              <div id="stroke-meaning-area" class="muted" data-i18n="stroke.meaning_hint"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

let _strokeLangHandler = null;
let _onNextChar = null;

function isHan(ch) {
  return /[\u3400-\u9FFF]/.test(ch);
}

function ensureStrokeStyles() {
  if (document.getElementById("lumina-stroke-style")) return;
  const style = document.createElement("style");
  style.id = "lumina-stroke-style";
  style.textContent = `
    .lumina-stroke{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-stroke .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-stroke .section{ padding:10px 0 18px; }
    .lumina-stroke .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-stroke .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-stroke .page-title{ margin:0; font-size:24px; font-weight:900; letter-spacing:-0.3px; }
    .lumina-stroke .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.6; }
    .lumina-stroke .section-title{ margin:0; font-size:16px; font-weight:800; }
    .lumina-stroke .stroke-input-row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .lumina-stroke .input-box{ min-width:180px; padding:10px 12px; border:1px solid var(--line,#e2e8f0); border-radius:12px; font-size:16px; }
    .lumina-stroke .btn{ padding:10px 16px; border-radius:12px; border:1px solid var(--line,#e2e8f0); background:#fff; font-weight:800; cursor:pointer; transition:transform .15s, box-shadow .15s; }
    .lumina-stroke .btn:hover{ transform:translateY(-1px); box-shadow:0 8px 20px rgba(0,0,0,.06); }
    .lumina-stroke .btn.primary{ border-color:transparent; background:var(--brand,#2563eb); color:#fff; }
    .lumina-stroke .btn.primary:hover{ background:var(--brand-2,#1d4ed8); }
    .lumina-stroke .muted{ color:var(--muted,#475569); font-size:14px; }
    .lumina-stroke .stroke-player-wrap{ min-height:200px; }
  `;
  document.head.appendChild(style);
}

export function mount(ctxOrRoot) {
  const el = getMountEl(ctxOrRoot?.root || ctxOrRoot?.app || ctxOrRoot);
  if (!el) return;

  ensureStrokeStyles();
  render(el);
  i18n.apply(el);

  const input = el.querySelector("#stroke-input");
  const btn = el.querySelector("#stroke-load-btn");
  const strokeRoot = el.querySelector("#stroke-root");
  const meaningArea = el.querySelector("#stroke-meaning-area");

  let _seq = { text: "", idx: 0 };

  function getTextArray() {
    const raw = String((_seq.text || "").trim());
    return Array.from(raw).filter(isHan);
  }

  async function loadCharAt(index) {
    const arr = getTextArray();
    if (!arr.length) return;

    const i = Math.max(0, Math.min(index, arr.length - 1));
    _seq.idx = i;
    const ch = arr[_seq.idx];
    if (!ch) return;

    mountStrokeSwitcher(strokeRoot, ch);
    await renderDictionaryDigest(ch);
    void renderMeaningFromHSK(ch);

    try {
      input.focus();
      input.setSelectionRange(Math.min(_seq.idx + 1, input.value.length), Math.min(_seq.idx + 1, input.value.length));
    } catch {}
  }

  function handleLoad() {
    const s = String((input?.value || "").trim());
    if (!s) return;

    _seq.text = s;
    _seq.idx = 0;
    void loadCharAt(0);
  }

  btn?.addEventListener("click", handleLoad);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoad();
  });

  _onNextChar = () => {
    const currentInput = String((input?.value || "").trim());
    if (currentInput && currentInput !== _seq.text) _seq.text = currentInput;

    const arr = getTextArray();
    if (!arr.length) return;

    const next = _seq.idx + 1;
    if (next >= arr.length) return;

    void loadCharAt(next);
  };

  strokeRoot?.addEventListener("stroke:nextchar", _onNextChar);

  _strokeLangHandler = () => {
    i18n.apply(el);

    const arr = getTextArray();
    const ch = arr.length ? arr[Math.min(_seq.idx, arr.length - 1)] : String((input?.value || "").trim()).charAt(0);

    if (ch) {
      void renderDictionaryDigest(ch);
      void renderMeaningFromHSK(ch);
    }
  };

  window.addEventListener("joy:langChanged", _strokeLangHandler);
  window.addEventListener("joy:lang", _strokeLangHandler);
  window.addEventListener("i18n:changed", _strokeLangHandler);

  const fromHash = (() => {
    const h = typeof location !== "undefined" ? location.hash || "" : "";
    const qm = h.indexOf("?");
    if (qm < 0) return "";
    return (new URLSearchParams(h.slice(qm + 1)).get("char") || "").trim();
  })();
  if (fromHash) {
    const first = Array.from(fromHash).find(isHan) || fromHash[0];
    if (first) {
      input.value = first;
      _seq.text = first;
      _seq.idx = 0;
      void loadCharAt(0);
    }
  }
}

export function unmount() {
  const el = document.getElementById("app");
  const strokeRoot = el?.querySelector?.("#stroke-root");

  if (_onNextChar && strokeRoot) {
    strokeRoot.removeEventListener("stroke:nextchar", _onNextChar);
    _onNextChar = null;
  }

  if (_strokeLangHandler) {
    window.removeEventListener("joy:langChanged", _strokeLangHandler);
    window.removeEventListener("joy:lang", _strokeLangHandler);
    window.removeEventListener("i18n:changed", _strokeLangHandler);
    _strokeLangHandler = null;
  }
}

export default { mount, unmount };
