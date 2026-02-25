// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — Slim (router-compatible)

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { mountDialoguePanel } from "../components/dialoguePanel.js";
import { mountDialogueModal } from "../components/dialogueModal.js";

import { initHSKUI } from "../modules/hsk/hskUI.js";
import { renderWordCards, renderLessonList } from "../modules/hsk/hskRenderer.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import {
  setCurrentLessonGlobal,
  setLessonDataOnCurrent,
} from "../modules/hsk/lessonSession.js";
import { enableHSKModalMode } from "../modules/hsk/hskModalMode.js";

let hskApi = null;

export async function mount() {
  const ok = mountLayout();
  if (!ok) return;

  mountGlobalComponents();
  applyI18nIfAvailable();

  // ✅ ensure globals exist (loader/history/etc)
  await ensureHSKDeps();

  // ✅ Default version (keep user's last selection)
  try {
    localStorage.setItem(
      "hsk_vocab_version",
      localStorage.getItem("hsk_vocab_version") || "hsk2.0"
    );
  } catch {}

  // ✅ Sync version select UI
  const verSel = document.getElementById("hskVersion");
  if (verSel) verSel.value = getCurrentVersion();

  // ✅ init UI
  hskApi = initHSKUI({
    defaultLevel: 1,
    autoFocusSearch: false,
    lang: "ko",
  });

  // ✅ Bind events
  bindHSKEvents();

  // ✅ Initial render lessons
  await refreshLessons();

  // ✅ Modal mode
  enableHSKModalMode();
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
  mountDialoguePanel({ container: document.body });
  mountDialogueModal();
  mountAIPanel();
  mountLearnPanel();
}

function applyI18nIfAvailable() {
  try {
    i18n?.apply?.(document);
  } catch (e) {
    console.warn("HSK Page: i18n apply failed:", e);
  }
}

/* ===============================
   ✅ Events
================================== */
function bindHSKEvents() {
  const levelSel = document.getElementById("hskLevel");
  const verSel = document.getElementById("hskVersion");

  levelSel?.addEventListener("change", async () => {
    await refreshLessons(true);
  });

  verSel?.addEventListener("change", async () => {
    const v = verSel?.value || "hsk2.0";
    try {
      localStorage.setItem("hsk_vocab_version", v);
    } catch {}
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
  return verSel?.value || safeText(tryGetLS("hsk_vocab_version")) || "hsk2.0";
}

function tryGetLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return "";
  }
}

function safeText(x) {
  return String(x ?? "").trim();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
  return res.json();
}

function fallbackLessonDetailUrl(lv, lessonNo, version) {
  const L = safeText(lv || "1");
  const N = Number(lessonNo) || 1;
  const V = safeText(version || "hsk2.0");
  return `/data/lessons/${V}/hsk${L}_lesson${N}.json`;
}

async function loadLessonDetailSafe(lv, lessonNo, { version, file } = {}) {
  // 1) loader provides it
  if (window.HSK_LOADER?.loadLessonDetail) {
    return window.HSK_LOADER.loadLessonDetail(lv, lessonNo, { version, file });
  }

  // 2) file path provided (absolute or relative)
  const f = safeText(file);
  if (f) {
    const url = f.startsWith("/") ? f : `/data/lessons/${safeText(version)}/${f}`;
    return fetchJson(url);
  }

  // 3) fallback naming
  return fetchJson(fallbackLessonDetailUrl(lv, lessonNo, version));
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

  if (!Array.isArray(lessons) || lessons.length === 0) {
    lessonsWrap.classList.add("hidden");
    lessonsEl.innerHTML = "";
    return;
  }

  lessonsWrap.classList.remove("hidden");

  renderLessonList(
    lessonsEl,
    lessons,
    async (lesson) => {
      setCurrentLessonGlobal(lesson, { lv, version });
      await openLesson(lesson, { lv, version });
    },
    { lang: "ko" }
  );

  if (scrollIntoView) {
    try {
      lessonsWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
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

  try {
    err?.classList.add("hidden");

    const file = safeText(lesson?.file || lesson?.path || "");
    const lessonNo = Number(lesson?.lessonNo || lesson?.lesson || lesson?.id || 1);

    if (status) status.textContent = "Loading lesson...";

    // ✅ load lesson detail (file first, then fallback)
    const lessonData = await loadLessonDetailSafe(lv, lessonNo, { version, file });

    // ✅ store on current session (single source of truth)
    setLessonDataOnCurrent({ lesson, lv, version, file, lessonData });

    // ✅ vocab for this level/version
    const vocab = await window.HSK_LOADER?.loadVocab?.(lv, { version });
    const vocabList = Array.isArray(vocab) ? vocab : [];

    const words = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(words.map((x) => safeText(x)).filter(Boolean));

    const lessonWords = vocabList.filter((x) => set.has(safeText(x?.word)));

    renderWordCards(grid, lessonWords, undefined, { lang: "ko" });

    if (status) {
      const label = lesson?.lesson || lesson?.id || lessonNo || "";
      status.textContent = `Lesson ${label} (${lessonWords.length}/${words.length})`;
    }
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "";
    if (err) {
      err.textContent = `Lesson load failed: ${e?.message || e}`;
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

    await refreshLessons(false);

    if (grid) {
      const vocab = await window.HSK_LOADER?.loadVocab?.(lv, { version });
      const vocabList = Array.isArray(vocab) ? vocab : [];
      renderWordCards(grid, vocabList, undefined, { lang: "ko" });
      if (status) status.textContent = `HSK ${lv} (${vocabList.length})`;
    } else {
      if (status) status.textContent = "";
    }
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "";
    if (err) {
      err.textContent = `Reload failed: ${e?.message || e}`;
      err.classList.remove("hidden");
    }
  }
}
