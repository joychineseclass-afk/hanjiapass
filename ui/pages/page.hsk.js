// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — Slim (router-compatible)
// ✅ 关键：不再调用 initHSKUI（旧方格目录就是它渲染的）

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
  try {
    localStorage.setItem(
      "hsk_vocab_version",
      localStorage.getItem("hsk_vocab_version") || "hsk2.0"
    );
  } catch {}

  // ✅ Sync version select UI
  const verSel = document.getElementById("hskVersion");
  if (verSel) verSel.value = getCurrentVersion();

  // ✅ Bind events (level/version changes)
  bindHSKEvents();

  // ✅ Initial render lessons
  await refreshLessons();

  // ✅ Modal mode: tabs open modals only (kids mode)
  enableHSKModalMode();
}

export async function unmount() {
  mounted = false;
}

/* ===============================
   Layout + Global components
================================== */
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
   Events
================================== */
function bindHSKEvents() {
  const levelSel = document.getElementById("hskLevel");
  const verSel = document.getElementById("hskVersion");

  levelSel?.addEventListener("change", async () => {
    await refreshLessons(true);
  });

  verSel?.addEventListener("change", async () => {
    const v = verSel.value || "hsk2.0";
    try {
      localStorage.setItem("hsk_vocab_version", v);
    } catch {}
    await refreshLessons(true);
  });
}

/* ===============================
   Helpers
================================== */
function getCurrentLevel() {
  const levelSel = document.getElementById("hskLevel");
  const v = levelSel?.value || "1";
  const m = String(v).match(/(\d+)/);
  return m ? Number(m[1]) : 1;
}

function getCurrentVersion() {
  const verSel = document.getElementById("hskVersion");
  return (
    verSel?.value ||
    localStorage.getItem("hsk_vocab_version") ||
    "hsk2.0"
  );
}

/* ===============================
   Refresh lessons list (纵向目录)
================================== */
async function refreshLessons(scrollIntoView = false) {
  const lv = getCurrentLevel();
  const version = getCurrentVersion();

  const lessonsWrap = document.getElementById("hskLessonsWrap");
  const lessonsEl = document.getElementById("hskLessons");
  const grid = document.getElementById("hskGrid");
  const err = document.getElementById("hskError");
  const status = document.getElementById("hskStatus");

  if (err) err.classList.add("hidden");

  if (!lessonsWrap || !lessonsEl) {
    console.warn("[HSK] missing lessons containers: #hskLessonsWrap/#hskLessons");
    return;
  }

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
    if (status) status.textContent = "";
    if (grid) grid.innerHTML = "";
    return;
  }

  lessonsWrap.classList.remove("hidden");

  // ✅ 纵向目录渲染（不是方格）
  renderLessonList(
    lessonsEl,
    lessons,
    async (lesson) => {
      setCurrentLessonGlobal(lesson, { lv, version });
      await openLesson(lesson, { lv, version });
    },
    { lang: "ko" }
  );

  if (status) status.textContent = `HSK ${lv} (${lessons.length})`;

  if (scrollIntoView) {
    lessonsWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ===============================
   Open one lesson → load detail → filter vocab → render word cards
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
      file, // ✅ 优先走 file
    });

    setLessonDataOnCurrent({ lesson, lv, version, file, lessonData });

    const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
    const words = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(words);

    const lessonWords = Array.isArray(vocab)
      ? vocab.filter((x) => set.has(x.word))
      : [];

    renderWordCards(grid, lessonWords, undefined, { lang: "ko" });

    if (status) {
      const label = lesson?.title?.ko || lesson?.title?.zh || lesson?.lesson || lesson?.id || lessonNo;
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
