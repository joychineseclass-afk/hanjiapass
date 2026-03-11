// /ui/pages/page.kids1.js
// Kids Book1 — 与 HSK1 内容模版对齐：拼音、释义、单句/全文朗读、Extension 卡片、Practice/AI 区块

import { i18n } from "../i18n.js";
import { resolvePinyin } from "../utils/pinyinEngine.js";
import { getLang } from "../core/languageEngine.js";

const STYLE_ID = "lumina-kids1-style";
const GLOSSARY_KEY = "kids1_glossary";

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return fallback;
    const s = String(v).trim();
    if (!s || s === key || s === `[${key}]`) return fallback;
    return s;
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .lumina-kids1{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-kids1 .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-kids1 .section{ padding:10px 0 18px; }
    .lumina-kids1 .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-kids1 .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-kids1 .page-title{ margin:0; font-size:24px; font-weight:900; }
    .lumina-kids1 .lesson-list{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
    .lumina-kids1 .lesson-card{ padding:16px; border:1px solid var(--line,#e2e8f0); border-radius:14px; background:#fff; cursor:pointer; transition:transform .15s, box-shadow .15s; }
    .lumina-kids1 .lesson-card:hover{ transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.08); }
    .lumina-kids1 .lesson-card .card-title{ font-weight:800; font-size:15px; }
    .lumina-kids1 .btn-back{ padding:8px 16px; border-radius:10px; background:#e2e8f0; font-weight:700; cursor:pointer; border:none; }
    .lumina-kids1 .btn-back:hover{ background:#cbd5e1; }
    .lumina-kids1 .kids-read-all{ margin-bottom:12px; }
    .lumina-kids1 .lesson-dialogue-line{ border-color:#e0e7ff; background:#f5f3ff; }
    .lumina-kids1 .lesson-extension-card{ border-color:#e0e7ff; background:#faf5ff; }
  `;
  document.head.appendChild(style);
}

function getBlueprintUrl() {
  const base = window.DATA_PATHS?.getBase?.();
  const b = base && String(base).trim();
  if (b) return String(base).replace(/\/+$/, "") + "/data/pedagogy/kids1-blueprint.json";
  const appBase = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  return appBase ? appBase + "/data/pedagogy/kids1-blueprint.json" : "/data/pedagogy/kids1-blueprint.json";
}

function getGlossaryUrl() {
  const base = window.DATA_PATHS?.getBase?.();
  const b = base && String(base).trim();
  if (b) return String(base).replace(/\/+$/, "") + "/data/pedagogy/kids1-glossary.json";
  const appBase = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  return appBase ? appBase + "/data/pedagogy/kids1-glossary.json" : "/data/pedagogy/kids1-glossary.json";
}

async function fetchBlueprint() {
  const res = await fetch(getBlueprintUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Blueprint: ${res.status}`);
  return res.json();
}

async function fetchGlossary() {
  if (window[GLOSSARY_KEY]) return window[GLOSSARY_KEY];
  const res = await fetch(getGlossaryUrl(), { cache: "no-store" });
  if (!res.ok) return {};
  const data = await res.json();
  window[GLOSSARY_KEY] = data && typeof data === "object" ? data : {};
  return window[GLOSSARY_KEY];
}

function normLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "ko" || l === "kr") return "kr";
  if (l === "ja" || l === "jp") return "jp";
  return "en";
}

function getMeaning(glossary, zh, lang) {
  if (!zh || !glossary || typeof glossary !== "object") return "";
  const key = String(zh).trim();
  const entry = glossary[key];
  if (!entry || typeof entry !== "object") return "";
  const L = normLang(lang);
  return String(entry[L] ?? entry.cn ?? entry.kr ?? entry.en ?? entry.jp ?? "").trim();
}

function getPinyin(zh, manual) {
  const z = String(zh ?? "").trim();
  if (!z) return "";
  if (manual && String(manual).trim()) return String(manual).trim();
  return resolvePinyin(z, "");
}

function flattenDialogueLines(dialogues) {
  const out = [];
  if (!Array.isArray(dialogues)) return out;
  dialogues.forEach((pair) => {
    for (let i = 0; i < (pair && pair.length) || 0; i += 2) {
      const a = pair[i];
      const b = pair[i + 1];
      if (a != null && String(a).trim()) out.push({ speaker: "A", zh: String(a).trim() });
      if (b != null && String(b).trim()) out.push({ speaker: "B", zh: String(b).trim() });
    }
  });
  return out;
}

async function playSequential(texts) {
  if (!Array.isArray(texts) || !texts.length) return;
  const AUDIO_ENGINE = (await import("../platform/index.js")).AUDIO_ENGINE;
  if (!AUDIO_ENGINE || typeof AUDIO_ENGINE.playText !== "function" || !AUDIO_ENGINE.isSpeechSupported?.()) return;
  AUDIO_ENGINE.stop();
  let idx = 0;
  function next() {
    if (idx >= texts.length) return;
    const text = String(texts[idx]).trim();
    idx += 1;
    if (!text) return next();
    AUDIO_ENGINE.playText(text, {
      lang: "zh-CN",
      rate: 0.95,
      onEnd: () => next(),
      onError: () => next(),
    });
  }
  next();
}

let _kids1SpeakBound = false;
function bindSpeakAndReadAll(root) {
  if (_kids1SpeakBound) return;
  _kids1SpeakBound = true;
  root.addEventListener("click", async function kids1Speak(e) {
    const btnReadAll = e.target.closest("#kids1ReadAllBtn");
    if (btnReadAll) {
      e.preventDefault();
      e.stopPropagation();
      const list = root.querySelector("#kids1DialogueList");
      if (!list) return;
      const texts = [];
      list.querySelectorAll(".lesson-dialogue-line .lesson-dialogue-zh[data-speak-text]").forEach((el) => {
        const t = (el.dataset?.speakText || "").trim();
        if (t) texts.push(t);
      });
      await playSequential(texts);
      return;
    }
    const el = e.target.closest("[data-speak-text][data-speak-kind]");
    if (!el) return;
    const text = (el.dataset?.speakText || "").trim();
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const { AUDIO_ENGINE } = await import("../platform/index.js");
      if (!AUDIO_ENGINE?.isSpeechSupported?.()) return;
      AUDIO_ENGINE.stop();
      const lineEl = el.closest(".lesson-dialogue-line") || el.closest(".lesson-extension-card");
      if (lineEl) lineEl.classList.add("is-speaking");
      AUDIO_ENGINE.playText(text, {
        lang: "zh-CN",
        rate: 0.95,
        onEnd: () => { if (lineEl) lineEl.classList.remove("is-speaking"); },
        onError: () => { if (lineEl) lineEl.classList.remove("is-speaking"); },
      });
    } catch (err) {
      console.warn("[kids1] speak failed:", err);
    }
  });
}

function renderList(root, blueprint) {
  ensureStyles();
  const lessons = blueprint?.lessons || {};
  const entries = Object.entries(lessons)
    .filter(([k]) => /^\d+$/.test(k))
    .sort(([a], [b]) => Number(a) - Number(b));

  root.innerHTML = `
    <div class="lumina-kids1">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <button type="button" class="btn-back" id="kids1BackToKids">${escapeHtml(t("kids1.backToKids", "← 少儿中文"))}</button>
              <h1 class="page-title mt-3">${escapeHtml(t("kids1.book1Title", "Kids Book1"))}</h1>
              <p class="text-sm text-slate-600">${escapeHtml(t("kids1.book1Subtitle", "8 课 · 句型 · 对话 · 扩展 · 练习 · AI 辅导"))}</p>
            </div>
          </div>
          <div class="card mt-4">
            <div class="inner">
              <h2 class="text-lg font-bold mb-3">${escapeHtml(t("kids1.lessonList", "课程列表"))}</h2>
              <div class="lesson-list" id="kids1LessonList"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  const listEl = root.querySelector("#kids1LessonList");
  entries.forEach(([no, lesson]) => {
    const card = document.createElement("div");
    card.className = "lesson-card";
    card.setAttribute("data-lesson-no", no);
    card.innerHTML = `<div class="card-title">第 ${no} 课 · ${escapeHtml(lesson.title || "")}</div>`;
    listEl.appendChild(card);
  });

  root.querySelector("#kids1BackToKids")?.addEventListener("click", () => { window.location.hash = "#kids"; });
  listEl.querySelectorAll(".lesson-card").forEach((el) => {
    el.addEventListener("click", () => {
      const no = el.getAttribute("data-lesson-no");
      renderLessonDetail(root, blueprint, window.__KIDS1_GLOSSARY__ || {}, no);
    });
  });
}

function renderLessonDetail(root, blueprint, glossary, lessonNo) {
  ensureStyles();
  const lessons = blueprint?.lessons || {};
  const lesson = lessons[lessonNo];
  if (!lesson) return renderList(root, blueprint);

  const lang = normLang(getLang());
  const title = lesson.title || `第 ${lessonNo} 课`;
  const coreZh = String(lesson.coreSentence || "").trim();
  const corePy = getPinyin(coreZh);
  const coreMeaning = getMeaning(glossary, coreZh, lang) || getMeaning(glossary, coreZh.replace(/[！。？，]/g, ""), lang);

  const lines = flattenDialogueLines(lesson.dialogues);
  const dialogueRows = lines.map((line) => {
    const zh = line.zh;
    const py = getPinyin(zh);
    const meaning = getMeaning(glossary, zh, lang) || getMeaning(glossary, zh.replace(/[！。？，]/g, ""), lang);
    const zhEsc = escapeAttr(zh);
    const attrs = zh ? ` data-speak-text="${zhEsc}" data-speak-kind="dialogue"` : "";
    return `
      <article class="lesson-dialogue-line lumina-kids1-dialogue-line">
        <div class="lesson-dialogue-speaker">${escapeHtml(line.speaker)}</div>
        <div class="lesson-dialogue-zh"${attrs}>${escapeHtml(zh)}</div>
        ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
        ${meaning ? `<div class="lesson-dialogue-translation">${escapeHtml(meaning)}</div>` : ""}
        <button type="button" class="lesson-extension-audio-btn mt-2"${attrs}>${escapeHtml(t("kids1.speak", "🔊 发音"))}</button>
      </article>`;
  }).join("");

  const readAllLabel = t("kids1.readAll", "🔊 全文朗读");
  const dialogueSectionTitle = t("kids1.dialogueTitle", "Dialogue");
  const dialogueSubtitle = t("hsk.dialogue_subtitle", "本课会话，可点击中文朗读。");

  const extensionWords = Array.isArray(lesson.extensionWords) ? lesson.extensionWords : [];
  const extensionCards = extensionWords.map((w, i) => {
    const zh = String(w).trim();
    const py = getPinyin(zh);
    const meaning = getMeaning(glossary, zh, lang);
    const zhEsc = escapeAttr(zh);
    const attrs = zh ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
    const idx = String(i + 1).padStart(2, "0");
    const speakLabel = t("kids1.speak", "🔊 发音");
    return `
      <article class="lesson-extension-card">
        <div class="lesson-extension-card-top">
          <span class="lesson-extension-index">${idx}</span>
          <button type="button" class="lesson-extension-audio-btn"${attrs}>${escapeHtml(speakLabel)}</button>
        </div>
        <div class="lesson-extension-body">
          <div class="lesson-extension-zh"${attrs}>${escapeHtml(zh)}</div>
          ${py ? `<div class="lesson-extension-pinyin">${escapeHtml(py)}</div>` : ""}
          ${meaning ? `<div class="lesson-extension-meaning">${escapeHtml(meaning)}</div>` : ""}
        </div>
      </article>`;
  }).join("");

  const extensionTitle = t("kids1.extensionTitle", "Extension");
  const extensionSubtitle = t("kids1.extensionUsage", "用于：数字游戏、跟读练习");
  const practiceTitle = t("kids1.practiceTitle", "Practice");
  const practicePlaceholder = t("kids1.practiceHint", "本课练习即将接入。可用于图片选择 / 配对 / 点击颜色等。");
  const aiTitle = t("kids1.aiTutorTitle", "AI Tutor");
  const aiDesc = t("kids1.aiTutorHint", "与 AI 老师练习本课句型和词汇。");
  const aiStartLabel = t("kids1.aiStart", "开始练习");
  const coreTitle = t("kids1.coreSentenceTitle", "Core Sentence");

  root.innerHTML = `
    <div class="lumina-kids1">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <button type="button" class="btn-back" id="kids1BackToList">← ${escapeHtml(t("kids1.backToList", "课程列表"))}</button>

              <div class="lesson-section-hero mt-4">
                <h2 class="lesson-section-title">${escapeHtml(title)}</h2>
              </div>

              <div class="lesson-section-hero">
                <h3 class="lesson-section-title">${escapeHtml(coreTitle)}</h3>
                <div class="lesson-dialogue-line" data-speak-text="${escapeAttr(coreZh)}" data-speak-kind="dialogue">
                  <div class="lesson-dialogue-zh">${escapeHtml(coreZh)}</div>
                  ${corePy ? `<div class="lesson-dialogue-pinyin">${escapeHtml(corePy)}</div>` : ""}
                  ${coreMeaning ? `<div class="lesson-dialogue-translation">${escapeHtml(coreMeaning)}</div>` : ""}
                  <button type="button" class="lesson-extension-audio-btn mt-2" data-speak-text="${escapeAttr(coreZh)}" data-speak-kind="dialogue">${escapeHtml(t("kids1.speak", "🔊 发音"))}</button>
                </div>
              </div>

              <div class="lesson-section-hero lesson-dialogue-hero">
                <h3 class="lesson-section-title">${escapeHtml(dialogueSectionTitle)}</h3>
                <p class="lesson-section-subtitle">${escapeHtml(dialogueSubtitle)}</p>
                <div class="kids-read-all">
                  <button type="button" id="kids1ReadAllBtn" class="lesson-extension-audio-btn">${escapeHtml(readAllLabel)}</button>
                </div>
                <div id="kids1DialogueList" class="lesson-dialogue-list">
                  ${dialogueRows || `<div class="lesson-empty-state">${escapeHtml(t("kids1.noDialogue", "暂无对话"))}</div>`}
                </div>
              </div>

              <div class="lesson-section-hero lesson-extension-hero">
                <h3 class="lesson-section-title">${escapeHtml(extensionTitle)}</h3>
                <p class="lesson-section-subtitle">${escapeHtml(extensionSubtitle)}</p>
                <section class="lesson-extension-list">${extensionCards || `<div class="lesson-extension-empty">${escapeHtml(t("kids1.noExtension", "暂无扩展词"))}</div>`}</section>
              </div>

              <div class="lesson-section-hero lesson-practice-hero">
                <h3 class="lesson-section-title">${escapeHtml(practiceTitle)}</h3>
                <p class="lesson-section-subtitle">${escapeHtml(practicePlaceholder)}</p>
                <div class="lesson-practice-fullpage">
                  <div class="lesson-practice-empty text-sm text-slate-500 p-4 rounded-xl border border-slate-200">${escapeHtml(practicePlaceholder)}</div>
                </div>
              </div>

              <div class="lesson-section-hero">
                <h3 class="lesson-section-title">${escapeHtml(aiTitle)}</h3>
                <p class="lesson-section-subtitle">${escapeHtml(aiDesc)}</p>
                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div class="text-base font-semibold text-slate-800 mb-2">${escapeHtml(coreZh)}</div>
                  ${corePy ? `<div class="text-sm text-slate-600 mb-3">${escapeHtml(corePy)}</div>` : ""}
                  <button type="button" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold" id="kids1AiStartBtn">${escapeHtml(aiStartLabel)}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  root.querySelector("#kids1BackToList")?.addEventListener("click", () => renderList(root, blueprint));
  root.querySelector("#kids1AiStartBtn")?.addEventListener("click", () => {
    try {
      const panel = document.querySelector("[data-ai-panel]") || document.getElementById("aiPanel");
      if (panel && typeof panel.show === "function") panel.show();
      else if (window.openAIPanel) window.openAIPanel();
    } catch {}
  });
  bindSpeakAndReadAll(root);
}

export default async function pageKids1(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  root.innerHTML = `<div class="lumina-kids1 wrap p-4">${t("common.loading", "加载中...")}</div>`;

  try {
    const [blueprint, glossary] = await Promise.all([fetchBlueprint(), fetchGlossary()]);
    window.__KIDS1_GLOSSARY__ = glossary;
    renderList(root, blueprint);
  } catch (e) {
    console.error("[kids1] load error", e);
    root.innerHTML = `
      <div class="lumina-kids1 wrap p-4">
        <p class="text-red-600">${escapeHtml(t("kids1.loadError", "无法加载课程蓝图"))}: ${escapeHtml(e?.message || String(e))}</p>
        <button type="button" class="btn-back mt-3" id="kids1Retry">${escapeHtml(t("common.retry", "重试"))}</button>
      </div>
    `;
    root.querySelector("#kids1Retry")?.addEventListener("click", () => pageKids1(ctxOrRoot));
  }
}

export function mount(ctxOrRoot) { return pageKids1(ctxOrRoot); }
export function render(ctxOrRoot) { return pageKids1(ctxOrRoot); }
