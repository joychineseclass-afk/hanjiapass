// /ui/components/learnPanel.js
// 教材型「单词学习卡」：词语 / 拼音 / 词性 / 释义 → 词义说明 → 例句 1/2（中文 + 拼音 + 系统语言译文）
// 数据来自课程 JSON 的 vocab 词条对象（经词卡 LEARN_PANEL.open 传入）；无文案的区块不渲染，不使用「暂无」类占位。
// window.LEARN_PANEL.open(item) · learn:set · learn:open

import { i18n } from "../i18n.js";
import { getLang, pick } from "../core/languageEngine.js";
import { getMeaningByLang, getPosByLang } from "../utils/wordDisplay.js";
import { resolvePinyin } from "../utils/pinyinEngine.js";

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

/** 词义说明：多字段回退；支持字符串或 { kr, cn, en, jp, zh, ko } */
function pickWordNote(raw, uiLang) {
  if (!raw || typeof raw !== "object") return "";
  const structured = [raw.explanation, raw.description, raw.note, raw.explain];
  for (const s of structured) {
    if (s == null) continue;
    if (typeof s === "string") {
      const t = str(s);
      if (t) return t;
      continue;
    }
    if (typeof s === "object") {
      const t = pick(s, { strict: false, lang: uiLang });
      if (str(t)) return str(t);
    }
  }
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
  return "";
}

function translationFromExample(tr, uiLang) {
  if (tr == null) return "";
  if (typeof tr === "string") return str(tr);
  if (typeof tr === "object") return str(pick(tr, { strict: false, lang: uiLang }));
  return "";
}

const MAX_WORD_STUDY_EXAMPLES = 3;

/** 设为 false 可关闭例句/词义说明打点：`window.__WORD_STUDY_TRACE__ = false` */
const WORD_STUDY_TRACE =
  typeof window !== "undefined" && window.__WORD_STUDY_TRACE__ !== false;

/**
 * 最多 3 条例句：中文 + 拼音 + 系统语言翻译（课程 JSON vocab.examples）
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

  const exArrays = [raw.examples, raw.exampleSentences, raw.sampleExamples].filter(Array.isArray);
  for (const arr of exArrays) {
    for (const ex of arr) {
      if (!ex) continue;
      if (typeof ex === "string") push(ex, "", "");
      else {
        const z = ex.zh ?? ex.text ?? ex.cn ?? ex.sentence ?? ex.line;
        const p = ex.pinyin ?? ex.py ?? "";
        const tr = translationFromExample(ex.translation ?? ex.trans, uiLang);
        push(z, p, tr);
      }
      if (out.length >= MAX_WORD_STUDY_EXAMPLES) return out;
    }
  }

  const single = raw.example;
  if (single && typeof single === "object" && out.length < MAX_WORD_STUDY_EXAMPLES) {
    push(
      single.text ?? single.zh ?? single.cn,
      single.pinyin ?? single.py ?? "",
      translationFromExample(single.translation, uiLang)
    );
  }

  const ez = str(raw.exampleZh ?? raw.example_zh ?? raw.exampleZH);
  if (ez && out.length < MAX_WORD_STUDY_EXAMPLES && !seen.has(ez)) {
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

  return out.slice(0, MAX_WORD_STUDY_EXAMPLES);
}

function render(wrapRoot, root, raw) {
  if (!root) return;

  i18n.apply?.(wrapRoot || document.getElementById("learn-panel-root") || document);

  const titleEl = document.getElementById("learnPanelTitle");
  if (titleEl) titleEl.textContent = i18n.t("word_study_title");

  const uiLang = getLang();
  const scope = hskScopeFromCtx();
  const w = typeof raw === "string" ? { hanzi: raw } : (raw && typeof raw === "object" ? { ...raw } : {});

  const hanzi = str(w.hanzi ?? w.word ?? w.zh ?? w.cn ?? w.text ?? w.simplified ?? "");
  const pinyinRaw = str(w.pinyin ?? w.py ?? w.pron ?? "");
  const pinyin = str(resolvePinyin(hanzi, pinyinRaw));
  const pos = str(getPosByLang(w, posUiLang(uiLang), scope));
  const meaning = str(getMeaningByLang(w, uiLang, hanzi, scope));
  const note = pickWordNote(w, uiLang);
  const examples = collectExampleItems(w, uiLang).filter((x) => x.zh);

  if (WORD_STUDY_TRACE && typeof console !== "undefined" && console.info) {
    const rawEx = w.examples;
    console.info("[word-study] learnPanel.render(open) item", {
      hanzi,
      pinyin,
      pos,
      meaning,
      senseNote: w.senseNote ?? w.sense_note,
      examples: rawEx,
      examplesIsArray: Array.isArray(rawEx),
      examplesLen: Array.isArray(rawEx) ? rawEx.length : null,
      noteResolvedLen: note ? note.length : 0,
      examplesCollectedLen: examples.length,
    });
  }

  const labelWord = i18n.t("word_study_row_word");
  const labelPyRow = i18n.t("word_study_row_pinyin");
  const labelPosRow = i18n.t("word_study_row_pos");
  const labelMeanRow = i18n.t("word_study_row_meaning");
  const labelNote = i18n.t("word_study_label_note");
  const labelExSection = i18n.t("word_study_section_examples");
  const labelExZh = i18n.t("word_study_ex_line_zh");
  const labelExPy = i18n.t("word_study_ex_line_py");
  const labelExTr = i18n.t("word_study_ex_line_tr");

  const dash = "\u2014";
  const heroInner = `
    <div class="word-study-field">
      <div class="word-study-field-label">${esc(labelWord)}</div>
      <div class="word-study-field-value word-study-hanzi">${esc(hanzi || dash)}</div>
    </div>
    <div class="word-study-field">
      <div class="word-study-field-label">${esc(labelPyRow)}</div>
      <div class="word-study-field-value word-study-pinyin">${esc(pinyin || dash)}</div>
    </div>
    <div class="word-study-field">
      <div class="word-study-field-label">${esc(labelPosRow)}</div>
      <div class="word-study-field-value word-study-pos">${esc(pos || dash)}</div>
    </div>
    <div class="word-study-field">
      <div class="word-study-field-label">${esc(labelMeanRow)}</div>
      <div class="word-study-field-value word-study-meaning">${esc(meaning || dash)}</div>
    </div>`;

  const noteHtml = note
    ? `<section class="word-study-section word-study-note-block">
        <h3 class="word-study-block-title">${esc(labelNote)}</h3>
        <p class="word-study-note-body">${esc(note)}</p>
      </section>`
    : "";

  const examplesHtml = examples.length
    ? `<section class="word-study-examples-region" aria-label="${esc(labelExSection)}">
        <h2 class="word-study-major-title">${esc(labelExSection)}</h2>
        ${examples
          .map(
            (ex, i) => `
        <div class="word-study-example-unit">
          <h3 class="word-study-block-title">${esc(i18n.t("word_study_example_no", { n: i + 1 }))}</h3>
          <div class="word-study-ex-line">
            <span class="word-study-ex-tag">${esc(labelExZh)}</span>
            <div class="word-study-ex-zh">${esc(ex.zh)}</div>
          </div>
          <div class="word-study-ex-line">
            <span class="word-study-ex-tag">${esc(labelExPy)}</span>
            <div class="word-study-ex-py">${esc(ex.py || dash)}</div>
          </div>
          <div class="word-study-ex-line">
            <span class="word-study-ex-tag">${esc(labelExTr)}</span>
            <div class="word-study-ex-tr">${esc(ex.trans || dash)}</div>
          </div>
        </div>`
          )
          .join("")}
      </section>`
    : "";

  root.innerHTML = `
    <article class="word-study-card word-study-card--textbook">
      <header class="word-study-hero" aria-label="${esc(i18n.t("word_study_title"))}">
        ${heroInner}
      </header>
      ${noteHtml}
      ${examplesHtml}
    </article>
  `;

  window.dispatchEvent(new CustomEvent("learn:rendered", { detail: w }));
}
