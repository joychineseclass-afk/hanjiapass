// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — Stable++ (router-compatible)
// - exports: mount(), unmount()
// - router controls lifecycle
//
// ✅ Updates in this full version:
// 1) Adds Lessons UI container (#hskLessonsWrap/#hskLessons)
// 2) Syncs HSK version select with localStorage (hsk2.0 / hsk3.0)
// 3) Loads lessons via window.HSK_LOADER.loadLessons(level,{version})
// 4) Clicking a lesson loads its lesson file and filters vocab -> renders cards
// 5) Version/Level change reloads vocab + lessons (simple & stable)

import { renderWordCards, renderLessonList } from "../modules/hsk/hskRenderer.js";
import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { mountDialoguePanel } from "../components/dialoguePanel.js";
import { mountDialogueModal, openDialogueModal } from "../components/dialogueModal.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";

let hskApi = null;
let depsPromise = null;

export async function mount() {
  const ok = mountLayout();
  if (!ok) return;

  mountDialoguePanel({ container: document.body });
  applyI18nIfAvailable();

  // ✅ ensure globals exist (loader/renderer/history)
  await ensureHSKDeps();

  // ✅ Default version (keep user's last selection)
  localStorage.setItem(
    "hsk_vocab_version",
    localStorage.getItem("hsk_vocab_version") || "hsk2.0"
  );

  // ✅ Sync version select UI
  const verSel = document.getElementById("hskVersion");
  if (verSel) verSel.value = localStorage.getItem("hsk_vocab_version") || "hsk2.0";

  // ✅ init UI (your existing stable UI)
  hskApi = initHSKUI({
    defaultLevel: 1,
    autoFocusSearch: false,
    lang: "ko",
  });

  // ✅ Bind events (level/version changes)
  bindHSKEvents();

  // ✅ Initial render lessons (and keep vocab already rendered by initHSKUI)
  await refreshLessons();
  bindDialogueTabOpen();
}

export async function unmount() {
  try {
    hskApi?.destroy?.();
  } catch {}
  hskApi = null;
}

function mountLayout() {
  const navRoot = document.getElementById("siteNav");
  const app = document.getElementById("app");

  if (!navRoot || !app) {
    console.error(
      "HSK Page Error:",
      `Missing: ${!navRoot ? "#siteNav " : ""}${!app ? "#app" : ""}`
    );
    return false;
  }

  mountNavBar(navRoot);
  app.innerHTML = getHSKLayoutHTML();
  return true;
}

function mountGlobalComponents() {
  ensurePortalRoot();
  mountAIPanel();
  mountLearnPanel();
  // ✅ 新增：dialogue modal
  mountDialogueModal();
}

function ensurePortalRoot() {
  let portal = document.getElementById("portal-root");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "portal-root";
    document.body.appendChild(portal);
  }
}

function applyI18nIfAvailable() {
  try {
    i18n?.apply?.(document);
  } catch (e) {
    console.warn("HSK Page: i18n apply failed:", e);
  }
}

/* ===============================
   ✅ Load global deps safely
   MUST be classic scripts (no `export`)
================================== */
async function ensureHSKDeps() {
  // Note: renderer is ESM import; loader/history are globals
  if (window.HSK_LOADER?.loadVocab && window.HSK_HISTORY) return;
  if (depsPromise) return depsPromise;

  depsPromise = (async () => {
    const loadScriptOnce = (src) =>
      new Promise((resolve, reject) => {
        const already = [...document.scripts].some((s) =>
          (s.src || "").endsWith(src)
        );
        if (already) return resolve();

        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(s);
      });

    // 1) ✅ Loader：classic script（无 export）
    await loadScriptOnce("/ui/modules/hsk/hskLoader.js");

    // 2) ✅ History：classic script OR ESM（按你实际文件来）
    // 如果你的 hskHistory.js 是 classic script，请改为 loadScriptOnce
    // 这里按你现在代码：ESM import()
    await import("../modules/hsk/hskHistory.js");

    // 3) Renderer is already imported at top (ESM)
  })();

  return depsPromise;
}

/* ===============================
   ✅ Events
================================== */
function bindHSKEvents() {
  const levelSel = document.getElementById("hskLevel");
  const verSel = document.getElementById("hskVersion");

  levelSel?.addEventListener("change", async () => {
    // initHSKUI should already respond; we just refresh lessons + (optional) grid
    await refreshLessons(true);
  });

  verSel?.addEventListener("change", async () => {
    const v = verSel.value || "hsk2.0";
    localStorage.setItem("hsk_vocab_version", v);

    // Let initHSKUI do its thing if it watches localStorage;
    // Still, we refresh lessons and re-render grid for stability.
    await refreshAll();
  });
}

/* ===============================
   ✅ Helpers to read current UI
================================== */
function getCurrentLevel() {
  const levelSel = document.getElementById("hskLevel");
  const v = levelSel?.value || "1";
  const m = String(v).match(/(\d+)/);
  return m ? Number(m[1]) : 1;
}

function getCurrentVersion() {
  const verSel = document.getElementById("hskVersion");
  const v =
    verSel?.value ||
    localStorage.getItem("hsk_vocab_version") ||
    "hsk2.0";
  return v;
}

/* ===============================
   ✅ Refresh lessons list
================================== */
async function refreshLessons(scrollIntoView = false) {
  const lv = getCurrentLevel();
  const version = getCurrentVersion();

  const lessonsWrap = document.getElementById("hskLessonsWrap");
  const lessonsEl = document.getElementById("hskLessons");

  if (!lessonsWrap || !lessonsEl) return;

  let lessons = null;
  try {
    lessons = await window.HSK_LOADER?.loadLessons?.(lv, { version });
  } catch (e) {
    console.warn("Lessons load failed:", e);
    lessons = null;
  }

  if (!lessons || !lessons.length) {
    lessonsWrap.classList.add("hidden");
    lessonsEl.innerHTML = "";
    return;
  }

  lessonsWrap.classList.remove("hidden");

  renderLessonList(
    lessonsEl,
    lessons,
    async (lesson) => {
      await openLesson(lesson, { lv, version });
    },
    { lang: "ko" }
  );

  if (scrollIntoView) {
    lessonsWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ===============================
   ✅ Open one lesson → load lesson file → filter vocab → render cards
================================== */
async function openLesson(lesson, { lv, version }) {
  const grid = document.getElementById("hskGrid");
  const err = document.getElementById("hskError");
  const status = document.getElementById("hskStatus");

  if (!grid) return;

  const file = lesson?.file || lesson?.path || "";
  if (!file) return;

  const lessonUrl = `/data/lessons/${version}/${file}`;

  try {
    err?.classList.add("hidden");
    if (status) status.textContent = "Loading lesson...";

    const lessonData = await fetch(lessonUrl, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} - ${lessonUrl}`);
      return r.json();
    });
    window.__HSK_CURRENT_LESSON = { lv, version, lesson, lessonData };
    
    const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
    const words = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(words);

    const lessonWords = vocab.filter((x) => set.has(x.word));

    // ✅ Render using ESM renderer (click opens modal by default)
    renderWordCards(grid, lessonWords, undefined, { lang: "ko" });

    if (status) status.textContent = `Lesson ${lesson.lesson || lesson.id || ""} (${lessonWords.length}/${words.length})`;
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "";
    if (err) {
      err.textContent = `Lesson load failed: ${e.message || e}`;
      err.classList.remove("hidden");
    }
  }
}

/* ===============================
   ✅ Full refresh on version change
================================== */
async function refreshAll() {
  const lv = getCurrentLevel();
  const version = getCurrentVersion();

  const err = document.getElementById("hskError");
  const status = document.getElementById("hskStatus");
  const grid = document.getElementById("hskGrid");

  try {
    err?.classList.add("hidden");
    if (status) status.textContent = "Reloading...";

    // 1) refresh lessons
    await refreshLessons(false);

    // 2) refresh vocab grid (all words)
    if (grid) {
      const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
      renderWordCards(grid, vocab, undefined, { lang: "ko" });
      if (status) status.textContent = `HSK ${lv} (${vocab.length}/${vocab.length})`;
    } else {
      if (status) status.textContent = "";
    }
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "";
    if (err) {
      err.textContent = `Reload failed: ${e.message || e}`;
      err.classList.remove("hidden");
    }
  }
}

/* =============================== */
function getHSKLayoutHTML() {
  return `
    <div class="bg-white rounded-2xl shadow p-4 mb-4">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-blue-600" data-i18n="hsk_title">HSK 학습 콘텐츠</span>
          <span id="hskStatus" class="text-xs text-gray-400"></span>
        </div>

        <div class="flex-1"></div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600" data-i18n="hsk_level">레벨</label>
          <select id="hskLevel" class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
            ${renderLevelOptions()}
          </select>

          <select id="hskVersion" class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="hsk2.0">HSK 2.0</option>
            <option value="hsk3.0">HSK 3.0</option>
          </select>

          <input
            id="hskSearch"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="검색 (예: 你好 / 숫자)"
            data-i18n-placeholder="hsk_search_placeholder"
            autocomplete="off"
          />
        </div>
      </div>

      <div class="mt-3 text-xs text-gray-500 flex items-center gap-1">
        <span>💡</span>
        <span data-i18n="hsk_tip">카드 클릭 → 배우기 → AI 선생님에게 질문하기</span>
      </div>
    </div>

    <div id="hskError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm"></div>

    <!-- ✅ Word grid -->
    <div id="hskGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>

    <div class="h-20"></div>
    <div id="portal-root"></div>
  `;
}

function renderLevelOptions() {
  return Array.from({ length: 9 }, (_, i) => {
    const level = i + 1;
    return `<option value="${level}" ${level === 1 ? "selected" : ""}>HSK ${level}급</option>`;
  }).join("");
}
function bindDialogueTabOpen() {
  // 只绑定一次
  if (document.body.dataset.__bindDiaTab) return;
  document.body.dataset.__bindDiaTab = "1";

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    // 1) 优先：你以后可以给会话按钮加 data-tab="dialogue" 或 data-key="dialogue"
    const tab = t.getAttribute("data-tab") || t.getAttribute("data-key");

    // 2) 兼容：按钮文字是 "회화" 或 "会话"
    const txt = (t.textContent || "").trim();

    const isDialogue =
      tab === "dialogue" ||
      txt === "회화" ||
      txt === "会话";

    if (!isDialogue) return;

    // 必须有当前课数据
    const cur = window.__HSK_CURRENT_LESSON;
    const lessonData = cur?.lessonData;

    const dialogue =
      lessonData?.dialogue ||
      lessonData?.conversation ||
      lessonData?.content ||
      [];

    openDialogueModal({
      title: lessonData?.title || cur?.lesson?.title || "회화 학습",
      subtitle: `HSK ${cur?.lv || ""} · ${cur?.version || ""}`,
      dialogue,
      lang: "ko",
    });
  });
}
