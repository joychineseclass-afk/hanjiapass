// /ui/components/learnPanel.js
// 单词学习卡：仅展示当前词条（词语 / 拼音 / 词性 / 释义 / 可选说明与例句）
// window.LEARN_PANEL.open(item) · learn:set · learn:open

import { i18n } from "../i18n.js";
import { getLang, pick } from "../core/languageEngine.js";
import { getMeaningByLang, getPosByLang } from "../utils/wordDisplay.js";

let mounted = false;

export function mountLearnPanel(opts = {}) {
  if (mounted) return window.LEARN_PANEL;
  mounted = true;

  const { container = document.body } = opts;

  const existed = document.getElementById("learn-panel-root");
  if (existed) existed.remove();

  const wrap = document.createElement("div");
  wrap.id = "learn-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const overlay = wrap.querySelector("#learn-panel");
  const backBtn = wrap.querySelector("#learnBack");
  const closeXBtn = wrap.querySelector("#learnCloseX");
  const body = wrap.querySelector("#learnBody");

  const open = () => overlay?.classList.remove("hidden");
  const close = () => overlay?.classList.add("hidden");

  closeXBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
    document.querySelector("#hskGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  if (!document.body.dataset.learnEscBound) {
    document.body.dataset.learnEscBound = "1";
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  window.addEventListener("openLearnPanel", open);
  window.addEventListener("closeLearnPanel", close);

  window.addEventListener("learn:set", (e) => {
    const data = e?.detail || {};
    render(wrap, body, data);
    open();
  });

  window.addEventListener("learn:open", (e) => {
    const data = e?.detail || {};
    render(wrap, body, data);
    open();
  });

  window.LEARN_PANEL = {
    open: (data) => {
      render(wrap, body, data);
      open();
    },
    close,
    set: (data) => render(wrap, body, data),
    isMounted: true,
  };

  return window.LEARN_PANEL;
}

function tpl() {
  return `
    <div id="learn-panel" class="learn-overlay hidden" aria-label="Word study">
      <div class="learn-modal" role="dialog" aria-modal="true">
        <div class="learn-topbar">
          <button id="learnBack" type="button" class="learn-btn" data-i18n="word_study_back"></button>
          <div id="learnPanelTitle" class="learn-title"></div>
          <button id="learnCloseX" type="button" class="learn-x" data-i18n-aria-label="common_close">×</button>
        </div>
        <div id="learnBody" class="learn-body"></div>
      </div>
    </div>
  `;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function posUiLang(uiLang) {
  if (uiLang === "kr") return "ko";
  if (uiLang === "cn") return "zh";
  return uiLang;
}

function hskScopeFromCtx() {
  const lv = window.__HSK_PAGE_CTX?.level;
  if (lv == null || lv === "") return "";
  const n = Number(lv);
  if (!Number.isFinite(n) || n < 1) return "";
  return `hsk${n}`;
}

/** 简短词义说明：仅当数据中存在专用字段时返回，不做占位 */
function pickWordNote(raw, uiLang) {
  if (!raw || typeof raw !== "object") return "";
  const candidates = [
    raw.senseNote,
    raw.sense_note,
    raw.usageDesc,
    raw.usage_desc,
    raw.usageDescription,
    raw.usage_description,
    raw.levelNote,
    raw.level_note,
    raw.hskNote,
    raw.hsk_note,
    raw.usageNote,
    raw.usage_note,
    raw.teachingNote,
    raw.teaching_note,
    raw.wordNote,
    raw.word_note,
    raw.glossNote,
    raw.gloss_note,
    raw.shortDef,
    raw.short_def,
    raw.definitionShort,
    raw.definition_short,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === "string") {
      const t = str(c);
      if (t && t !== "[object Object]") return t;
      continue;
    }
    if (typeof c === "object") {
      const t = pick(c, { strict: false, lang: uiLang });
      if (str(t)) return str(t);
    }
  }
  const ex = raw.explain;
  if (ex && typeof ex === "object") {
    const t = pick(ex, { strict: false, lang: uiLang });
    if (str(t)) return str(t);
  }
  return "";
}

function translationFromExample(tr, uiLang) {
  if (tr == null) return "";
  if (typeof tr === "string") return str(tr);
  if (typeof tr === "object") return str(pick(tr, { strict: false, lang: uiLang }));
  return "";
}

/**
 * 最多 2 条例句：中文 + 拼音 + 系统语言翻译
 */
function collectExampleItems(raw, uiLang) {
  const out = [];
  const seen = new Set();

  const push = (zh, py, trans) => {
    const z = str(zh);
    if (!z || seen.has(z)) return;
    seen.add(z);
    out.push({
      zh: z,
      py: str(py),
      trans: str(trans),
    });
  };

  if (Array.isArray(raw.examples)) {
    for (const ex of raw.examples) {
      if (!ex) continue;
      if (typeof ex === "string") push(ex, "", "");
      else {
        const z = ex.zh ?? ex.text ?? ex.cn ?? ex.sentence;
        const p = ex.pinyin ?? ex.py ?? "";
        const tr = translationFromExample(ex.translation ?? ex.trans, uiLang);
        push(z, p, tr);
      }
      if (out.length >= 2) return out;
    }
  }

  const single = raw.example;
  if (single && typeof single === "object" && out.length < 2) {
    push(
      single.text ?? single.zh ?? single.cn,
      single.pinyin ?? single.py ?? "",
      translationFromExample(single.translation, uiLang)
    );
  }

  const ez = str(raw.exampleZh ?? raw.example_zh ?? raw.exampleZH);
  if (ez && out.length < 2 && !seen.has(ez)) {
    const epy = str(raw.examplePinyin ?? raw.example_pinyin ?? raw.examplePY ?? "");
    let tr = "";
    if (raw.exampleTranslation && typeof raw.exampleTranslation === "object") {
      tr = translationFromExample(raw.exampleTranslation, uiLang);
    }
    if (!tr) {
      tr = str(
        raw.exampleExplainKr ||
          raw.exampleKR ||
          raw.explainKr ||
          raw.exampleExplainEn ||
          raw.exampleExplainCn ||
          raw.exampleExplainJp ||
          ""
      );
    }
    push(ez, epy, tr);
  }

  return out.slice(0, 2);
}

function render(wrapRoot, root, raw) {
  if (!root) return;

  i18n.apply?.(wrapRoot || document.getElementById("learn-panel-root") || document);

  const titleEl = document.getElementById("learnPanelTitle");
  if (titleEl) titleEl.textContent = i18n.t("word_study_title");

  const uiLang = getLang();
  const scope = hskScopeFromCtx();
  const w = typeof raw === "string" ? { hanzi: raw } : (raw && typeof raw === "object" ? { ...raw } : {});

  const hanzi = str(w.hanzi ?? w.word ?? w.zh ?? w.cn ?? w.simplified ?? "");
  const pinyin = str(w.pinyin ?? w.py ?? "");
  const pos = getPosByLang(w, posUiLang(uiLang), scope);
  const meaning = getMeaningByLang(w, uiLang, hanzi, scope);
  const note = pickWordNote(w, uiLang);
  const examples = collectExampleItems(w, uiLang).filter((x) => x.zh);

  const labelNote = i18n.t("word_study_label_note");

  const heroInner = [
    `<div class="word-study-hanzi">${esc(hanzi || "—")}</div>`,
    pinyin ? `<div class="word-study-pinyin">${esc(pinyin)}</div>` : "",
    pos ? `<div class="word-study-pos">${esc(pos)}</div>` : "",
    meaning ? `<div class="word-study-meaning">${esc(meaning)}</div>` : "",
  ].filter(Boolean).join("");

  const noteHtml = note
    ? `<section class="word-study-section word-study-note-block">
        <h3 class="word-study-block-title">${esc(labelNote)}</h3>
        <p class="word-study-note-body">${esc(note)}</p>
      </section>`
    : "";

  const examplesHtml = examples.length
    ? examples
        .map(
          (ex, i) => `
      <section class="word-study-section word-study-example-block">
        <h3 class="word-study-block-title">${esc(i18n.t("word_study_example_no", { n: i + 1 }))}</h3>
        <div class="word-study-ex-zh">${esc(ex.zh)}</div>
        ${ex.py ? `<div class="word-study-ex-py">${esc(ex.py)}</div>` : ""}
        ${ex.trans ? `<div class="word-study-ex-tr">${esc(ex.trans)}</div>` : ""}
      </section>`
        )
        .join("")
    : "";

  root.innerHTML = `
    <div class="word-study-card">
      <header class="word-study-hero">
        ${heroInner}
      </header>
      ${noteHtml}
      ${examplesHtml}
    </div>
  `;

  window.dispatchEvent(new CustomEvent("learn:rendered", { detail: w }));
}
