// /ui/pages/page.kids1.js
// Kids Book1 课程：从 data/pedagogy/kids1-blueprint.json 生成列表与课内页
// 每课顺序：Title → Core Sentence → Dialogue → Extension → Practice → AI Tutor

import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-kids1-style";

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
    .replaceAll('"', "&quot;");
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
    .lumina-kids1 .block{ margin-bottom:20px; }
    .lumina-kids1 .block-title{ font-size:14px; font-weight:800; color:#64748b; margin-bottom:8px; }
    .lumina-kids1 .core-sentence{ font-size:20px; font-weight:700; color:#0f172a; padding:12px; background:#f1f5f9; border-radius:12px; }
    .lumina-kids1 .dialogue-line{ padding:10px 14px; border-radius:10px; margin-bottom:6px; }
    .lumina-kids1 .dialogue-line.a{ background:#dbeafe; }
    .lumina-kids1 .dialogue-line.b{ background:#fce7f3; }
    .lumina-kids1 .dialogue-line .speaker{ font-size:12px; font-weight:700; color:#64748b; margin-bottom:4px; }
    .lumina-kids1 .extension-words{ display:flex; flex-wrap:wrap; gap:8px; }
    .lumina-kids1 .extension-word{ padding:8px 14px; background:#e0f2fe; border-radius:999px; font-weight:600; }
    .lumina-kids1 .practice-box{ padding:14px; background:#f0fdf4; border-radius:12px; }
    .lumina-kids1 .ai-tutor-box{ padding:14px; background:#fef3c7; border-radius:12px; }
    .lumina-kids1 .btn-back{ padding:8px 16px; border-radius:10px; background:#e2e8f0; font-weight:700; cursor:pointer; border:none; }
    .lumina-kids1 .btn-back:hover{ background:#cbd5e1; }
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

async function fetchBlueprint() {
  const url = getBlueprintUrl();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Blueprint load failed: ${res.status}`);
  return res.json();
}

function renderList(root, blueprint) {
  ensureStyles();
  const lessons = blueprint?.lessons || {};
  const entries = Object.entries(lessons)
    .filter(([k]) => /^\d+$/.test(k))
    .sort(([a], [b]) => Number(a) - Number(b));

  const backLabel = t("kids1.backToKids", "← 少儿中文");
  const title = t("kids1.book1Title", "Kids Book1");
  const subtitle = t("kids1.book1Subtitle", "8 课 · 句型 · 对话 · 扩展 · 练习 · AI 辅导");

  root.innerHTML = `
    <div class="lumina-kids1">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <button type="button" class="btn-back" id="kids1BackToKids">${escapeHtml(backLabel)}</button>
              <h1 class="page-title mt-3">${escapeHtml(title)}</h1>
              <p class="text-sm text-slate-600">${escapeHtml(subtitle)}</p>
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

  root.querySelector("#kids1BackToKids")?.addEventListener("click", () => {
    window.location.hash = "#kids";
  });

  listEl.querySelectorAll(".lesson-card").forEach((el) => {
    el.addEventListener("click", () => {
      const no = el.getAttribute("data-lesson-no");
      renderLessonDetail(root, blueprint, no);
    });
  });
}

function renderLessonDetail(root, blueprint, lessonNo) {
  ensureStyles();
  const lessons = blueprint?.lessons || {};
  const lesson = lessons[lessonNo];
  if (!lesson) return renderList(root, blueprint);

  const title = lesson.title || `第 ${lessonNo} 课`;
  const coreSentence = lesson.coreSentence || "";
  const dialogues = Array.isArray(lesson.dialogues) ? lesson.dialogues : [];
  const extensionWords = Array.isArray(lesson.extensionWords) ? lesson.extensionWords : [];

  const dialogueHtml = dialogues.map((pair) => {
    const lines = [];
    for (let i = 0; i < pair.length; i += 2) {
      const a = pair[i];
      const b = pair[i + 1];
      if (a != null) lines.push(`<div class="dialogue-line a"><div class="speaker">A</div><div>${escapeHtml(a)}</div></div>`);
      if (b != null) lines.push(`<div class="dialogue-line b"><div class="speaker">B</div><div>${escapeHtml(b)}</div></div>`);
    }
    return lines.join("");
  }).join('<div class="my-2"></div>');

  const extensionHtml = extensionWords.length
    ? `<div class="extension-words">${extensionWords.map((w) => `<span class="extension-word">${escapeHtml(w)}</span>`).join("")}</div>`
    : "";

  const practiceHint = t("kids1.practiceHint", "数字游戏、跟读练习等（可在此接入练习引擎）");
  const aiHint = t("kids1.aiTutorHint", "与 AI 老师练习本课句型和词汇。");

  root.innerHTML = `
    <div class="lumina-kids1">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <button type="button" class="btn-back" id="kids1BackToList">← ${escapeHtml(t("kids1.backToList", "课程列表"))}</button>

              <div class="block mt-4">
                <div class="block-title">${escapeHtml(t("kids1.blockTitle", "标题"))}</div>
                <h2 class="text-xl font-bold">${escapeHtml(title)}</h2>
              </div>

              <div class="block">
                <div class="block-title">Core Sentence</div>
                <div class="core-sentence">${escapeHtml(coreSentence)}</div>
              </div>

              <div class="block">
                <div class="block-title">Dialogue</div>
                <div class="dialogue-list">${dialogueHtml || `<p class="text-sm text-slate-500">(暂无对话)</p>`}</div>
              </div>

              <div class="block">
                <div class="block-title">Extension</div>
                <div class="extension-block">${extensionHtml || ""}</div>
                <p class="text-xs text-slate-500 mt-2">${escapeHtml(t("kids1.extensionUsage", "用于：数字游戏、跟读练习"))}</p>
              </div>

              <div class="block">
                <div class="block-title">Practice</div>
                <div class="practice-box">${escapeHtml(practiceHint)}</div>
              </div>

              <div class="block">
                <div class="block-title">AI Tutor</div>
                <div class="ai-tutor-box">${escapeHtml(aiHint)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  root.querySelector("#kids1BackToList")?.addEventListener("click", () => {
    renderList(root, blueprint);
  });
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
    const blueprint = await fetchBlueprint();
    renderList(root, blueprint);
  } catch (e) {
    console.error("[kids1] blueprint load error", e);
    root.innerHTML = `
      <div class="lumina-kids1 wrap p-4">
        <p class="text-red-600">${escapeHtml(t("kids1.loadError", "无法加载课程蓝图"))}: ${escapeHtml(e?.message || String(e))}</p>
        <button type="button" class="btn-back mt-3" id="kids1Retry">${escapeHtml(t("common.retry", "重试"))}</button>
      </div>
    `;
    root.querySelector("#kids1Retry")?.addEventListener("click", () => pageKids1(ctxOrRoot));
  }
}

export function mount(ctxOrRoot) {
  return pageKids1(ctxOrRoot);
}
export function render(ctxOrRoot) {
  return pageKids1(ctxOrRoot);
}
