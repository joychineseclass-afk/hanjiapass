// ui/pages/page.catalog.js
import { i18n } from "../i18n.js";

const DATA_ROOT = "./data/lessons/hsk2.0"; // ✅ 你的数据路径

function langPick(obj, lang = "kr") {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.kr || obj.ko || obj.zh || obj.cn || obj.en || "";
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return await res.json();
}

function normalizeLesson(item, idx) {
  // 兼容不同字段命名
  const file = item.file || item.path || item.url || item.json || "";
  const lessonId = item.lessonId || item.id || (file ? file.replace(/\.json$/i, "") : "");
  const lessonNo = item.lessonNo ?? item.no ?? item.index ?? (idx + 1);

  return {
    lessonNo,
    lessonId,
    file,
    title: item.title || item.name || item.topic || "",
    subtitle: item.subtitle || item.desc || item.description || "",
    tags: item.tags || [],
  };
}

function sortLessons(list, mode) {
  const arr = [...list];
  if (mode === "no_asc") arr.sort((a, b) => (a.lessonNo ?? 0) - (b.lessonNo ?? 0));
  if (mode === "no_desc") arr.sort((a, b) => (b.lessonNo ?? 0) - (a.lessonNo ?? 0));
  if (mode === "title") arr.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return arr;
}

function renderUI(root) {
  root.innerHTML = `
    <section class="card" style="margin-top:14px;">
      <div class="hero">
        <div class="title">📚 课程目录（家长可查）</div>
        <p class="desc">HSK 2.0 课程索引 · 搜索/筛选/排序 · 点击进入学习</p>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          <input id="q" placeholder="搜索：打招呼 / 인사 / lesson..." 
                 style="flex:1; min-width:240px; padding:10px 12px; border-radius:12px; border:1px solid #e2e8f0;"/>
          <select id="level" style="padding:10px 12px; border-radius:12px; border:1px solid #e2e8f0;">
            <option value="hsk1">HSK 1</option>
            <!-- 以后你加 hsk2/hsk3，就在这里追加 -->
          </select>
          <select id="sort" style="padding:10px 12px; border-radius:12px; border:1px solid #e2e8f0;">
            <option value="no_asc">按课次 ↑</option>
            <option value="no_desc">按课次 ↓</option>
            <option value="title">按标题</option>
          </select>
        </div>

        <div style="margin-top:10px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div class="badge" id="meta">loading...</div>
          <a class="badge" href="#home">← 返回主页</a>
        </div>
      </div>
    </section>

    <section id="list" style="margin:12px 0 24px; display:grid; gap:10px;"></section>
  `;
}

function lessonCardHTML(lesson, lang) {
  const t = langPick(lesson.title, lang) || `Lesson ${lesson.lessonNo}`;
  const s = langPick(lesson.subtitle, lang);
  const tags = Array.isArray(lesson.tags) ? lesson.tags : [];

  return `
    <div class="card" style="padding:14px;">
      <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <div class="badge">Lesson ${lesson.lessonNo}</div>
          <div style="font-weight:900; font-size:16px; margin-top:6px;">${escapeHtml(t)}</div>
          ${s ? `<div style="color:#475569; margin-top:4px;">${escapeHtml(s)}</div>` : ""}
          ${tags.length ? `
            <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
              ${tags.slice(0, 6).map(x => `<span class="badge">${escapeHtml(x)}</span>`).join("")}
            </div>
          ` : ""}
        </div>

        <div style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">
          <button class="badge" data-act="learn" data-id="${escapeHtml(lesson.lessonId)}" data-file="${escapeHtml(lesson.file)}">
            ▶ 开始学习
          </button>
          <button class="badge" data-act="words" data-id="${escapeHtml(lesson.lessonId)}" data-file="${escapeHtml(lesson.file)}">
            단어
          </button>
          <button class="badge" data-act="dialogue" data-id="${escapeHtml(lesson.lessonId)}" data-file="${escapeHtml(lesson.file)}">
            회화
          </button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function mount({ root } = {}) {
  const app = root || document.getElementById("app");
  if (!app) return;

  renderUI(app);

  const qEl = app.querySelector("#q");
  const levelEl = app.querySelector("#level");
  const sortEl = app.querySelector("#sort");
  const listEl = app.querySelector("#list");
  const metaEl = app.querySelector("#meta");

  const lang =
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr";

  // 当前只做 HSK1（你后面加 hsk2.json、hsk3.json 直接扩展）
  async function loadIndex(levelKey) {
    const url = `${DATA_ROOT}/${levelKey}.json`; // e.g. ./data/lessons/hsk2.0/hsk1.json
    return await fetchJson(url);
  }

  let indexRaw = await loadIndex(levelEl.value);
  let lessons = (indexRaw.lessons || indexRaw.items || []).map(normalizeLesson);

  function render() {
    const kw = (qEl.value || "").trim().toLowerCase();
    const mode = sortEl.value;

    let filtered = lessons;

    if (kw) {
      filtered = lessons.filter(ls => {
        const t = langPick(ls.title, lang).toLowerCase();
        const s = langPick(ls.subtitle, lang).toLowerCase();
        const id = String(ls.lessonId || "").toLowerCase();
        const file = String(ls.file || "").toLowerCase();
        return t.includes(kw) || s.includes(kw) || id.includes(kw) || file.includes(kw);
      });
    }

    filtered = sortLessons(filtered, mode);

    metaEl.textContent = `총 ${filtered.length}개 수업 · ${levelEl.value.toUpperCase()} · lang=${lang}`;

    listEl.innerHTML = filtered.map(ls => lessonCardHTML(ls, lang)).join("");
  }

  // UI events
  qEl.addEventListener("input", render);
  sortEl.addEventListener("change", render);

  levelEl.addEventListener("change", async () => {
    metaEl.textContent = "loading...";
    indexRaw = await loadIndex(levelEl.value);
    lessons = (indexRaw.lessons || indexRaw.items || []).map(normalizeLesson);
    render();
  });

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const lessonId = btn.dataset.id;
    const file = btn.dataset.file;

    // 如果 lessonId 没有，就用 file 推导
    const finalLessonId = lessonId || (file ? file.replace(/\.json$/i, "") : "");

    // ✅ 你已经有全局 joyOpenStep(step, lessonId)
    // act 映射到你 Lesson Engine 的 step 名称（按你项目实际可调整）
    if (act === "learn") {
      // 默认打开 words 或 lesson 的第一步
      window.joyOpenStep?.("words", finalLessonId);
      return;
    }
    if (act === "words") {
      window.joyOpenStep?.("words", finalLessonId);
      return;
    }
    if (act === "dialogue") {
      window.joyOpenStep?.("dialogue", finalLessonId);
      return;
    }
  });

  // 初次渲染
  render();

  // 翻译
  try { i18n.apply(app); } catch {}
}

export async function unmount() {
  // 目前没有全局监听需要清理（都绑在 app 容器上，切页会销毁 DOM）
}
