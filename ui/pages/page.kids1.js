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
    .lumina-kids1 .card{ background:rgba(255,255,255,.9); backdrop-filter:blur(14px); border:1px solid rgba(226,232,240,.95); border-radius:24px; box-shadow:0 10px 30px rgba(15,23,42,.08); overflow:hidden; }
    .lumina-kids1 .inner{ padding:18px; display:grid; gap:14px; }
    .lumina-kids1 .page-title{ margin:0; font-size:24px; font-weight:900; }
    .lumina-kids1 .lesson-list{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
    .lumina-kids1 .lesson-card{ padding:14px; border:1px solid var(--line,#e2e8f0); border-radius:16px; background:#fff; cursor:pointer; transition:transform .12s, box-shadow .12s; }
    .lumina-kids1 .lesson-card:hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(15,23,42,.08); }
    .lumina-kids1 .lesson-card .card-title{ font-weight:800; font-size:15px; }
    .lumina-kids1 .btn-back{ padding:8px 16px; border-radius:999px; background:#e2e8f0; font-weight:700; cursor:pointer; border:none; font-size:13px; }
    .lumina-kids1 .btn-back:hover{ background:#cbd5e1; }

    .kids-lesson-page{ display:flex; flex-direction:column; gap:16px; }
    .kids-lesson-topline{
      font-size:14px;
      line-height:1.6;
      color:var(--muted,#64748b);
      margin-bottom:14px;
    }

    .kids-core-card,
    .kids-dialogue-scene-card,
    .kids-extra-card,
    .kids-game-entry-card{
      border-radius:18px;
      background:#fff;
      border:1px solid rgba(226,232,240,.9);
      box-shadow:0 4px 12px rgba(15,23,42,.06);
      padding:14px 16px;
    }

    .kids-core-card .kids-core-main-zh{ font-size:18px; font-weight:800; color:#0f172a; }
    .kids-core-card .kids-core-main-py{ font-size:14px; color:#475569; margin-top:4px; }
    .kids-core-card .kids-core-main-gloss{ font-size:13px; color:#64748b; margin-top:4px; }

    .kids-dialogue-scene-card{ max-width:760px; }
    .kids-dialogue-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }
    .kids-dialogue-head .lesson-section-title{ margin:0; }
    .kids-read-all-btn{
      padding:6px 12px;
      border-radius:12px;
      background:#0ea5e9;
      color:#fff;
      border:none;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
      flex-shrink:0;
    }
    .kids-read-all-btn:hover{ opacity:.9; }

    .kids-scene-stage{ width:100%; }
    .kids-scene-image-wrap{
      position:relative;
      width:100%;
      max-width:720px;
      min-height:320px;
      border-radius:20px;
      overflow:hidden;
      background:linear-gradient(180deg,#eef7ff,#f8fbff);
      border:1px solid rgba(226,232,240,.9);
    }
    .kids-scene-image{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
      min-height:320px;
    }
    .kids-scene-image-placeholder{
      position:absolute;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:14px;
      color:#94a3b8;
      background:linear-gradient(180deg,#eef7ff,#f8fbff);
    }
    .kids-dialogue-bubbles-overlay{
      position:absolute;
      inset:0;
      pointer-events:none;
    }
    .kids-dialogue-bubbles-overlay .kids-scene-bubble{ pointer-events:auto; }
    .kids-scene-bubble{
      position:absolute;
      display:inline-block;
      max-width:220px;
      min-width:90px;
      width:fit-content;
      padding:10px 12px;
      border-radius:16px;
      font-size:14px;
      background:#eff6ff;
      border:1px solid #dbeafe;
      box-shadow:0 2px 8px rgba(15,23,42,.08);
    }
    .kids-scene-bubble.right{ background:#fef3c7; border-color:#fde68a; }
    .kids-scene-bubble .bubble-zh{ font-weight:700; color:#0f172a; }
    .kids-scene-bubble .bubble-py{ font-size:12px; color:#475569; margin-top:2px; }
    .kids-scene-bubble .bubble-gloss{ font-size:12px; color:#64748b; margin-top:4px; }
    .kids-scene-bubble .bubble-zh.kids-text-zh,.kids-scene-bubble .bubble-gloss.kids-text-gloss{ cursor:pointer; }
    .kids-scene-bubble .bubble-zh.kids-text-zh:hover,.kids-scene-bubble .bubble-gloss.kids-text-gloss:hover{ opacity:.85; }
    .bubble-1{ top:18px; left:18px; }
    .bubble-2{ top:52px; right:18px; left:auto; }
    .bubble-3{ top:132px; left:22px; }
    .bubble-4{ top:180px; right:22px; left:auto; }
    .bubble-5{ top:220px; left:22px; }
    .bubble-6{ top:260px; right:22px; left:auto; }
    .bubble-7{ bottom:60px; left:22px; top:auto; }
    .bubble-8{ bottom:24px; right:22px; left:auto; top:auto; }

    .kids-core-main-zh.kids-text-zh,.kids-core-main-gloss.kids-text-gloss{ cursor:pointer; }
    .kids-core-main-zh.kids-text-zh:hover,.kids-core-main-gloss.kids-text-gloss:hover{ opacity:.85; }
    .lesson-extension-zh.kids-text-zh,.lesson-extension-meaning.kids-text-gloss{ cursor:pointer; }
    .lesson-extension-zh.kids-text-zh:hover,.lesson-extension-meaning.kids-text-gloss:hover{ opacity:.85; }
    .speaker-badge{
      min-width:22px;
      height:22px;
      border-radius:999px;
      background:#e0f2fe;
      color:#0369a1;
      font-size:12px;
      font-weight:800;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .kids-bubble-row.right .speaker-badge{
      background:#fee2e2;
      color:#b91c1c;
    }

    .kids-extra-card-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(120px,1fr));
      gap:8px;
      margin-top:6px;
    }
    .kids-extra-item{
      border-radius:14px;
      border:1px solid #e2e8f0;
      background:#f8fafc;
      padding:8px 10px;
      font-size:13px;
    }

    .kids-game-entry-card-title{ font-size:15px; font-weight:800; color:#0f172a; margin-bottom:4px; }
    .kids-game-entry-desc{ font-size:13px; color:#64748b; margin-bottom:8px; }
    .kids-game-entry-btn{
      padding:8px 14px;
      border-radius:999px;
      border:none;
      background:#22c55e;
      color:#fff;
      font-size:13px;
      font-weight:700;
      cursor:pointer;
    }
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

const KIDS1_LESSON_TITLES = {
  "1": { cn: "第1课 · 你好！", kr: "1과 · 안녕하세요!", en: "Lesson 1 · Hello!", jp: "第1課 · こんにちは！" },
  "2": { cn: "第2课 · 你叫什么名字？", kr: "2과 · 이름이 뭐예요?", en: "Lesson 2 · What's your name?", jp: "第2課 · 名前は何ですか？" },
  "3": { cn: "第3课 · 你几岁？", kr: "3과 · 몇 살이에요?", en: "Lesson 3 · How old are you?", jp: "第3課 · 何歳ですか？" },
  "4": { cn: "第4课 · 你是哪国人？", kr: "4과 · 어느 나라 사람이에요?", en: "Lesson 4 · Where are you from?", jp: "第4課 · どこの国の方ですか？" },
  "5": { cn: "第5课 · 他是谁？", kr: "5과 · 그는 누구예요?", en: "Lesson 5 · Who is he?", jp: "第5課 · 彼は誰ですか？" },
  "6": { cn: "第6课 · 这是什么？", kr: "6과 · 이게 뭐예요?", en: "Lesson 6 · What's this?", jp: "第6課 · これは何ですか？" },
  "7": { cn: "第7课 · 你喜欢什么颜色？", kr: "7과 · 무슨 색을 좋아해요?", en: "Lesson 7 · What color do you like?", jp: "第7課 · 何色が好きですか？" },
  "8": { cn: "第8课 · 你喜欢什么动物？", kr: "8과 · 무슨 동물을 좋아해요?", en: "Lesson 8 · What animal do you like?", jp: "第8課 · どんな動物が好きですか？" },
};

function getLessonDisplayTitle(lesson, lessonNo, lang) {
  const L = normLang(lang);
  const t = lesson && typeof lesson === "object" ? lesson[`title_${L}`] || lesson[`title_${L === "cn" ? "zh" : L}`] : "";
  if (t != null && String(t).trim()) return String(t).trim();
  const map = KIDS1_LESSON_TITLES[String(lessonNo)];
  if (map && map[L]) return map[L];
  return lesson?.title ? `第${lessonNo}课 · ${lesson.title}` : `第${lessonNo}课`;
}

function getLessonTopline(lesson, lessonNo, lang, coreZh, corePy) {
  const bookName = t("kids.book1Title", "Kids Book 1");
  const full = getLessonDisplayTitle(lesson, lessonNo, lang);
  const parts = String(full).split(" · ");
  const lessonNum = parts[0] || `第${lessonNo}课`;
  const lessonTitle = parts[1] || lesson?.title || "";
  const zh = String(coreZh || "").trim();
  const py = String(corePy || "").trim();
  const out = [bookName, lessonNum, lessonTitle].filter(Boolean);
  if (zh) out.push(zh);
  if (py) out.push(py);
  return out.join(" · ");
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

// 预留：Kids 场景元数据组装（后续可接 AI 场景引擎）
export function getKidsSceneMeta(lessonData, lang) {
  const l = normLang(lang || getLang());
  const sceneKey = lessonData?.scene || "";
  const titleFallback = {
    cn: "课堂场景",
    kr: "수업 장면",
    en: "Lesson scene",
    jp: "レッスン場面",
  }[l] || "Scene";
  const descFallback = {
    cn: "老师和同学在练习本课对话。",
    kr: "선생님과 친구들이 오늘 배운 표현을 연습하고 있어요.",
    en: "The teacher and students are practicing today's dialogue.",
    jp: "先生と子どもたちが今日の会話を練習しています。",
  }[l] || "";
  return {
    scene: sceneKey,
    title: titleFallback,
    description: descFallback,
  };
}

// 场景槽：用于嵌入 .kids-dialogue-card 内部顶部
export function renderKidsSceneSlot(sceneMeta) {
  const title = sceneMeta?.title || t("kids.sceneTitle", "Scene");
  const imgLabel = t("kids1.sceneImage", "Scene Image");
  const readAll = t("kids1.readAll", "🔊 Read all");
  return `
    <div class="kids-scene-slot">
      <div class="kids-scene-image"><div></div></div>
      <div class="kids-scene-meta">
        <div class="kids-scene-title">${escapeHtml(title)}</div>
        <div class="kids-scene-desc">${escapeHtml(imgLabel)}</div>
        <button type="button" id="kids1ReadAllBtn" class="kids-read-all-btn">${escapeHtml(readAll)}</button>
      </div>
    </div>
  `;
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

function ttsLangForGloss() {
  const L = normLang(getLang());
  if (L === "kr") return "ko-KR";
  if (L === "jp") return "ja-JP";
  if (L === "cn") return "zh-CN";
  return "en";
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
      list.querySelectorAll(".kids-text-zh[data-speak-zh]").forEach((el) => {
        const t = (el.dataset?.speakZh || "").trim();
        if (t) texts.push(t);
      });
      await playSequential(texts);
      return;
    }
    const zhEl = e.target.closest(".kids-text-zh[data-speak-zh]");
    if (zhEl) {
      const text = (zhEl.dataset?.speakZh || "").trim();
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const { AUDIO_ENGINE } = await import("../platform/index.js");
        if (!AUDIO_ENGINE?.isSpeechSupported?.()) return;
        AUDIO_ENGINE.stop();
        const lineEl = zhEl.closest(".kids-scene-bubble") || zhEl.closest(".kids-bubble-row") || zhEl.closest(".kids-core-card") || zhEl.closest(".lesson-extension-card");
        if (lineEl) lineEl.classList.add("is-speaking");
        AUDIO_ENGINE.playText(text, { lang: "zh-CN", rate: 0.95, onEnd: () => { if (lineEl) lineEl.classList.remove("is-speaking"); }, onError: () => { if (lineEl) lineEl.classList.remove("is-speaking"); } });
      } catch (err) { console.warn("[kids1] speak zh failed:", err); }
      return;
    }
    const glossEl = e.target.closest(".kids-text-gloss[data-speak-gloss]");
    if (glossEl) {
      const text = (glossEl.dataset?.speakGloss || "").trim();
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const { AUDIO_ENGINE } = await import("../platform/index.js");
        if (!AUDIO_ENGINE?.isSpeechSupported?.()) return;
        AUDIO_ENGINE.stop();
        const lineEl = glossEl.closest(".kids-scene-bubble") || glossEl.closest(".kids-bubble-row") || glossEl.closest(".kids-core-card") || glossEl.closest(".lesson-extension-card");
        if (lineEl) lineEl.classList.add("is-speaking");
        AUDIO_ENGINE.playText(text, { lang: ttsLangForGloss(), rate: 0.95, onEnd: () => { if (lineEl) lineEl.classList.remove("is-speaking"); }, onError: () => { if (lineEl) lineEl.classList.remove("is-speaking"); } });
      } catch (err) { console.warn("[kids1] speak gloss failed:", err); }
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

  const lang = normLang(getLang());
  const listEl = root.querySelector("#kids1LessonList");
  entries.forEach(([no, lesson]) => {
    const card = document.createElement("div");
    card.className = "lesson-card";
    card.setAttribute("data-lesson-no", no);
    card.innerHTML = `<div class="card-title">${escapeHtml(getLessonDisplayTitle(lesson, no, lang))}</div>`;
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
  const title = getLessonDisplayTitle(lesson, lessonNo, lang);
  const coreZh = String(lesson.coreSentence || "").trim();
  const corePy = getPinyin(coreZh);
  const coreMeaning = getMeaning(glossary, coreZh, lang) || getMeaning(glossary, coreZh.replace(/[！。？，]/g, ""), lang);

  const lines = flattenDialogueLines(lesson.dialogues);
  const overlayBubbles = lines.map((line, idx) => {
    const zh = line.zh;
    const py = getPinyin(zh);
    const meaning = getMeaning(glossary, zh, lang) || getMeaning(glossary, zh.replace(/[！。？，]/g, ""), lang);
    const zhEsc = escapeAttr(zh);
    const meaningEsc = meaning ? escapeAttr(meaning) : "";
    const n = idx + 1;
    const posClass = n <= 8 ? ` bubble-${n}` : "";
    const sideClass = line.speaker === "B" ? " right" : " left";
    const zhCls = zh ? " bubble-zh kids-text-zh" : " bubble-zh";
    const zhData = zh ? ` data-speak-zh="${zhEsc}"` : "";
    const glossCls = meaning ? " bubble-gloss kids-text-gloss" : " bubble-gloss";
    const glossData = meaning ? ` data-speak-gloss="${meaningEsc}"` : "";
    return `<div class="kids-scene-bubble${sideClass}${posClass}">
      <div class="${zhCls.trim()}"${zhData}>${escapeHtml(zh)}</div>
      ${py ? `<div class="bubble-py">${escapeHtml(py)}</div>` : ""}
      ${meaning ? `<div class="${glossCls.trim()}"${glossData}>${escapeHtml(meaning)}</div>` : ""}
    </div>`;
  }).join("");

  const extensionWords = Array.isArray(lesson.extensionWords) ? lesson.extensionWords : [];
  const extensionCards = extensionWords.map((w, i) => {
    const zh = String(w).trim();
    const py = getPinyin(zh);
    const meaning = getMeaning(glossary, zh, lang);
    const zhEsc = escapeAttr(zh);
    const meaningEsc = meaning ? escapeAttr(meaning) : "";
    const zhCls = zh ? " lesson-extension-zh kids-text-zh" : " lesson-extension-zh";
    const zhData = zh ? ` data-speak-zh="${zhEsc}"` : "";
    const glossCls = meaning ? " lesson-extension-meaning kids-text-gloss" : " lesson-extension-meaning";
    const glossData = meaning ? ` data-speak-gloss="${meaningEsc}"` : "";
    const idx = String(i + 1).padStart(2, "0");
    return `
      <article class="lesson-extension-card">
        <div class="lesson-extension-card-top">
          <span class="lesson-extension-index">${idx}</span>
        </div>
        <div class="lesson-extension-body">
          <div class="${zhCls.trim()}"${zhData}>${escapeHtml(zh)}</div>
          ${py ? `<div class="lesson-extension-pinyin">${escapeHtml(py)}</div>` : ""}
          ${meaning ? `<div class="${glossCls.trim()}"${glossData}>${escapeHtml(meaning)}</div>` : ""}
        </div>
      </article>`;
  }).join("");

  const extensionTitle = t("kids.extraTitle", "Extension");
  const extensionSubtitle = t("kids1.extensionUsage", "用于：数字游戏、跟读练习");
  const practiceTitle = t("kids1.practiceTitle", "Practice");
  const practicePlaceholder = t("kids1.practiceHint", "本课练习即将接入。可用于图片选择 / 配对 / 点击颜色等。");
  const aiTitle = t("kids1.aiTutorTitle", "AI Tutor");
  const aiDesc = t("kids1.aiTutorHint", "与 AI 老师练习本课句型和词汇。");
  const aiStartLabel = t("kids1.aiStart", "开始练习");
  const coreTitle = t("kids.coreSentenceTitle", "Core Sentence");
  const dialogueSectionTitle = t("kids.dialogueTitle", "Dialogue");
  const readAllLabel = t("kids1.readAll", "🔊 Read all");
  const backToListLabel = t("kids.backToList", "课程列表");
  const toplineText = getLessonTopline(lesson, lessonNo, lang, coreZh, corePy);
  const sceneLabel = t("kids1.sceneImage", "场景图片");

  root.innerHTML = `
    <div class="lumina-kids1">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <button type="button" class="btn-back" id="kids1BackToList">← ${escapeHtml(backToListLabel)}</button>
              <section class="kids-lesson-page">
                <div class="kids-lesson-topline">${escapeHtml(toplineText)}</div>

                <section class="kids-core-card kids-card">
                  <h3 class="lesson-section-title">${escapeHtml(coreTitle)}</h3>
                  <div class="kids-core-main-zh kids-text-zh" data-speak-zh="${escapeAttr(coreZh)}">${escapeHtml(coreZh)}</div>
                  ${corePy ? `<div class="kids-core-main-py">${escapeHtml(corePy)}</div>` : ""}
                  ${coreMeaning ? `<div class="kids-core-main-gloss kids-text-gloss" data-speak-gloss="${escapeAttr(coreMeaning)}">${escapeHtml(coreMeaning)}</div>` : ""}
                </section>

                <section class="kids-dialogue-scene-card kids-card">
                  <div class="kids-dialogue-head">
                    <h3 class="lesson-section-title">${escapeHtml(dialogueSectionTitle)}</h3>
                    <button type="button" id="kids1ReadAllBtn" class="kids-read-all-btn">${escapeHtml(readAllLabel)}</button>
                  </div>
                  <div class="kids-scene-stage">
                    <div class="kids-scene-image-wrap">
                      <div class="kids-scene-image-placeholder">${escapeHtml(sceneLabel)}</div>
                      <div class="kids-dialogue-bubbles-overlay" id="kids1DialogueList">
                        ${overlayBubbles || ""}
                      </div>
                    </div>
                  </div>
                </section>

                <section class="kids-extra-card kids-card">
                  <h3 class="lesson-section-title">${escapeHtml(extensionTitle)}</h3>
                  <p class="lesson-section-subtitle">${escapeHtml(extensionSubtitle)}</p>
                  <div class="kids-extra-card-grid">
                    ${extensionCards || `<div class="lesson-extension-empty">${escapeHtml(t("kids1.noExtension", "暂无扩展词"))}</div>`}
                  </div>
                </section>

              </section>
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
