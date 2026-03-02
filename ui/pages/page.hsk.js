// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — SLIM v2.2 (Lang-following + safe cleanup + re-render on lang change)

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

window.__HSK_PAGE_FILE__ = "page.hsk.js SLIM v2.2";
console.log("[HSK] SLIM page loaded ✅", window.__HSK_PAGE_FILE__);

let mounted = false;

// ✅ for cleanup
let aborter = null;

// ✅ state cache (for re-render on lang change)
let lastLessons = [];
let lastLv = 1;
let lastVersion = "hsk2.0";
let currentOpen = null; // { lesson, lv, version }

/* ===============================
   ✅ Public mount/unmount
================================== */
export async function mount() {
  if (mounted) return;
  mounted = true;

  aborter = new AbortController();

  const ok = mountLayout();
  if (!ok) return;

  mountGlobalComponents();
  applyI18nIfAvailable();

  await ensureHSKDeps();

  localStorage.setItem(
    "hsk_vocab_version",
    localStorage.getItem("hsk_vocab_version") || "hsk2.0"
  );

  const verSel = document.getElementById("hskVersion");
  if (verSel) verSel.value = getCurrentVersion();

  bindHSKEvents();

  await refreshLessons(true);

  enableHSKModalMode();
}

export async function unmount() {
  mounted = false;
  try {
    aborter?.abort?.();
  } catch {}
  aborter = null;

  // reset page-local caches
  lastLessons = [];
  currentOpen = null;
}

/* ===============================
   ✅ Layout / global components
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
   ✅ Events
================================== */
function bindHSKEvents() {
  const levelSel = document.getElementById("hskLevel");
  const verSel = document.getElementById("hskVersion");
  const search = document.getElementById("hskSearch");

  // guard
  const signal = aborter?.signal;

  levelSel?.addEventListener(
    "change",
    async () => {
      await refreshLessons(true);
    },
    { signal }
  );

  verSel?.addEventListener(
    "change",
    async () => {
      const v = verSel.value || "hsk2.0";
      localStorage.setItem("hsk_vocab_version", v);
      await refreshLessons(true);
    },
    { signal }
  );

  search?.addEventListener(
    "input",
    async () => {
      const q = String(search.value || "").trim();
      await refreshVocabPreview(q);
    },
    { signal }
  );

  // ✅ Language follow: re-apply i18n + re-render list + re-render opened lesson/cards
  const onLangChanged = async () => {
    if (!mounted) return;
    applyI18nIfAvailable();

    // re-render list using cached lessons
    rerenderLessonListOnly();

    // re-render opened lesson words/cards if any
    if (currentOpen?.lesson) {
      try {
        await openLesson(currentOpen.lesson, {
          lv: currentOpen.lv,
          version: currentOpen.version,
          __skipSetCurrent: true,
        });
      } catch {}
    }
  };

  // support multiple event names (whichever your system emits)
  window.addEventListener("languageChanged", onLangChanged, { signal });
  window.addEventListener("i18n:changed", onLangChanged, { signal });
  window.addEventListener("joy:lang", onLangChanged, { signal });
}

/* ===============================
   ✅ Helpers
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

function getCurrentLang() {
  // best-effort, compatible with your existing system
  const fromI18n =
    (typeof i18n?.getLang === "function" && i18n.getLang()) ||
    i18n?.lang ||
    i18n?.current ||
    "";

  const fromLS =
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    localStorage.getItem("lang") ||
    "";

  const raw = String(fromI18n || fromLS || "ko").trim().toLowerCase();
  // normalize common variants
  if (raw === "kr") return "ko";
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ko")) return "ko";
  return raw || "ko";
}

// ✅ 兼容：新容器 / 旧容器 都能用
function getLessonListNodes() {
  // new
  let wrap = document.getElementById("hskLessonListWrap");
  let el = document.getElementById("hskLessonList");

  // old fallback
  if (!wrap) wrap = document.getElementById("hskLessonsWrap");
  if (!el) el = document.getElementById("hskLessons");

  return { wrap, el };
}

function setStatusText(text) {
  const status = document.getElementById("hskStatus");
  if (status) status.textContent = text || "";
}

function setLoadingLessons() {
  // translate if your i18n has t(), else fallback
  const txt =
    (typeof i18n?.t === "function" && i18n.t("hsk_loading_lessons")) ||
    "Loading lessons...";
  setStatusText(txt);
}

function setLessonsHeader(lv, version) {
  const lang = getCurrentLang();
  const txt =
    (typeof i18n?.t === "function" &&
      i18n.t("hsk_header", { lv, version, lang })) ||
    `HSK ${lv} · ${version}`;
  setStatusText(txt);
}

function rerenderLessonListOnly() {
  const { wrap: listWrap, el: listEl } = getLessonListNodes();
  if (!listEl) return;

  const lessons = Array.isArray(lastLessons) ? lastLessons : [];
  if (!lessons.length) return;

  listWrap?.classList.remove("hidden");

  const lv = lastLv || getCurrentLevel();
  const version = lastVersion || getCurrentVersion();
  const lang = getCurrentLang();

  renderLessonList(
    listEl,
    lessons,
    async (lesson) => {
      setCurrentLessonGlobal(lesson, { lv, version });
      await openLesson(lesson, { lv, version });
    },
    { lang }
  );
}

/* ===============================
   ✅ Refresh lessons list
================================== */
async function refreshLessons(scrollIntoView = false) {
  const lv = getCurrentLevel();
  const version = getCurrentVersion();
  const lang = getCurrentLang();

  lastLv = lv;
  lastVersion = version;

  const err = document.getElementById("hskError");
  const { wrap: listWrap, el: listEl } = getLessonListNodes();
  const grid = document.getElementById("hskGrid");

  try {
    err?.classList.add("hidden");
    setLoadingLessons();

    let lessons = [];
    try {
      lessons = await window.HSK_LOADER?.loadLessons?.(lv, { version });
    } catch (e) {
      console.warn("Lessons load failed:", e);
      lessons = [];
    }

    lastLessons = Array.isArray(lessons) ? lessons : [];

    if (!lastLessons.length) {
      setStatusText("");
      if (listWrap) listWrap.classList.add("hidden");
      if (listEl) listEl.innerHTML = "";
      if (grid) grid.innerHTML = "";
      return;
    }

    setLessonsHeader(lv, version);

    listWrap?.classList.remove("hidden");

    renderLessonList(
      listEl,
      lastLessons,
      async (lesson) => {
        setCurrentLessonGlobal(lesson, { lv, version });
        await openLesson(lesson, { lv, version });
      },
      { lang }
    );

    if (scrollIntoView) {
      listWrap?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (e) {
    console.error(e);
    setStatusText("");
    if (err) {
      err.textContent = `Lessons load failed: ${e.message || e}`;
      err.classList.remove("hidden");
    }
  }
}

/* ===============================
   ✅ Open one lesson → load lesson file → render cards
================================== */
async function openLesson(lesson, { lv, version, __skipSetCurrent = false }) {
  const grid = document.getElementById("hskGrid");
  const err = document.getElementById("hskError");
  if (!grid) return;

  const lang = getCurrentLang();

  try {
    err?.classList.add("hidden");

    if (!__skipSetCurrent) {
      currentOpen = { lesson, lv, version };
    }

    const file = lesson?.file || lesson?.path || "";
    const lessonNo = Number(lesson?.lessonNo || lesson?.lesson || lesson?.id || 1);

    const lessonData = await window.HSK_LOADER.loadLessonDetail(lv, lessonNo, {
      version,
      file,
    });

    setLessonDataOnCurrent({ lesson, lv, version, file, lessonData });

    const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
    const words = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(words);

    const lessonWords = Array.isArray(vocab) ? vocab.filter((x) => set.has(x.word)) : [];

    renderWordCards(grid, lessonWords, undefined, { lang });

    // status (translated if available)
    const label = lesson?.lesson || lesson?.id || lessonNo;
    const txt =
      (typeof i18n?.t === "function" &&
        i18n.t("hsk_lesson_status", {
          label,
          got: lessonWords.length,
          total: words.length,
        })) ||
      `Lesson ${label} (${lessonWords.length}/${words.length})`;

    setStatusText(txt);
  } catch (e) {
    console.error(e);
    setStatusText("");
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
  const lang = getCurrentLang();

  if (!q) return;

  try {
    const vocab = await window.HSK_LOADER.loadVocab(lv, { version });
    const qq = q.toLowerCase();

    const filtered = (Array.isArray(vocab) ? vocab : []).filter((x) => {
      const w = String(x.word || "");
      const p = String(x.pinyin || "");
      const k = String(x.ko || x.kr || x.en || "");
      return (
        w.includes(q) ||
        p.toLowerCase().includes(qq) ||
        k.toLowerCase().includes(qq)
      );
    });

    renderWordCards(grid, filtered.slice(0, 60), undefined, { lang });
  } catch (e) {
    console.warn("search preview failed:", e);
  }
}
