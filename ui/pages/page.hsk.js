// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — SLIM v2 (NO legacy initHSKUI render)

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { mountDialoguePanel } from "../components/dialoguePanel.js";
import { mountDialogueModal } from "../components/dialogueModal.js";

import { renderWordCards, renderLessonList } from "../modules/hsk/hskRenderer.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";

import {
  setCurrentLessonGlobal,
  setLessonDataOnCurrent,
} from "../modules/hsk/lessonSession.js";

import { enableHSKModalMode } from "../modules/hsk/hskModalMode.js";

window.__HSK_PAGE_FILE__ = "page.hsk.js SLIM v2";
console.log("[HSK] SLIM page loaded ✅", window.__HSK_PAGE_FILE__);

let mounted = false;

export async function mount() {
  if (mounted) return;
  mounted = true;

  const ok = mountLayout();
  if (!ok) return;

  mountGlobalComponents();
  applyI18nIfAvailable();

  // ✅ ensure globals exist (loader/history)
  await ensureHSKDeps();

  // ✅ Default version (keep user's last selection)
  localStorage.setItem(
    "hsk_vocab_version",
    localStorage.getItem("hsk_vocab_version") || "hsk2.0"
  );

  // ✅ Sync version select UI
  const verSel = document.getElementById("hskVersion");
  if (verSel) verSel.value = getCurrentVersion();

  // ✅ Bind events (level/version/search)
  bindHSKEvents();

  // ✅ Initial render lessons
  await refreshLessons(true);

  // ✅ Modal mode: tabs open modals only (kids mode)
  enableHSKModalMode();
}

export async function unmount() {
  mounted = false;
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
  const search = document.getElementById("hskSearch");

  levelSel?.addEventListener("change", async () => {
    await refreshLessons(true);
  });

  verSel?.addEventListener("change", async () => {
    const v = verSel.value || "hsk2.0";
    localStorage.setItem("hsk_vocab_version", v);
    await refreshLessons(true);
  });

  // ✅ search: filter current level vocab (optional)
  search?.addEventListener("input", async () => {
    const q = String(search.value || "").trim();
    await refreshVocabPreview(q);
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
  return verSel?.value || localStorage.getItem("hsk_vocab_version") || "hsk2.0";
}

/* ===============================
   ✅ Refresh lessons list (Directory style)
================================== */
async function refreshLessons(scrollIntoView = false) {
  const lv = getCurrentLevel();
  const version = getCurrentVersion();

  const err = document.getElementById("hskError");
  const status = document.getElementById("hskStatus");

  const listWrap = document.getElementById("hskLessonListWrap");
  const listEl = document.getElementById("hskLessonList");
  const grid = document.getElementById("hskGrid");

  try {
    err?.classList.add("hidden");
    if (status) status.textContent = "Loading lessons...";

    let lessons = [];
    try {
      lessons = await window.HSK_LOADER?.loadLessons?.(lv, { version });
    } catch (e) {
      console.warn("Lessons load failed:", e);
      lessons = [];
    }

    if (!lessons || !lessons.length) {
      if (status) status.textContent = "";
      if (listWrap) listWrap.classList.add("hidden");
      if (listEl) listEl.innerHTML = "";
      if (grid) grid.innerHTML = "";
      return;
    }

    if (status) status.textContent = `HSK ${lv} · ${version}`;

    listWrap?.classList.remove("hidden");

    renderLessonList(
      listEl,
      lessons,
      async (lesson) => {
        setCurrentLessonGlobal(lesson, { lv, version });
        await openLesson(lesson, { lv, version });
      },
      { lang: "ko" }
    );

    if (scrollIntoView) {
      listWrap?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "";
    if (err) {
      err.textContent = `Lessons load failed: ${e.message || e}`;
      err.classList.remove("hidden");
    }
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

    const file = lesson?.file || lesson?.path || "";
    const lessonNo = Number(lesson?.lessonNo || lesson?.lesson || lesson?.id || 1);

    const lessonData = await window.HSK_LOADER.loadLessonDetail(lv, lessonNo, {
      version,
      file, // ✅ prefer explicit file
    });

    // ✅ store on current session
    setLessonDataOnCurrent({ lesson, lv, version, file, lessonData });

    const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
    const words = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(words);

    const lessonWords = vocab.filter((x) => set.has(x.word));

    // ✅ render preview cards (teacher/web mode)
    renderWordCards(grid, lessonWords, undefined, { lang: "ko" });

    if (status) {
      const label = lesson?.lesson || lesson?.id || lessonNo;
      status.textContent = `Lesson ${label} (${lessonWords.length}/${words.length})`;
    }
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
   ✅ Optional: vocab search preview
================================== */
async function refreshVocabPreview(q) {
  const grid = document.getElementById("hskGrid");
  if (!grid) return;

  const lv = getCurrentLevel();
  const version = getCurrentVersion();

  if (!q) return; // 不输入就不强制刷

  try {
    const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
    const qq = q.toLowerCase();
    const filtered = vocab.filter((x) => {
      const w = String(x.word || "");
      const p = String(x.pinyin || "");
      const k = String(x.ko || x.kr || "");
      return (
        w.includes(q) ||
        p.toLowerCase().includes(qq) ||
        k.toLowerCase().includes(qq)
      );
    });

    renderWordCards(grid, filtered.slice(0, 60), undefined, { lang: "ko" });
  } catch (e) {
    console.warn("search preview failed:", e);
  }
}
