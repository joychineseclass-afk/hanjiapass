// /ui/pages/page.hsk.js ✅ FINAL (Clean HSK + Directory<->Study switch)
// ✅ No mountGlobalComponents() => prevents AI/Dialogue/Learn panels from appearing
// ✅ Clicking a lesson switches to study mode (same page), renders into #hskGrid
// ✅ Back button returns to directory
import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import { renderLessonList, renderWordCards } from "../modules/hsk/hskRenderer.js";

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null, // {lessonNo,file,lessonData}
};

function getLang() {
  const l = (i18n?.getLang?.() || "kr").toLowerCase();
  return (l === "cn" || l === "zh") ? "zh" : "ko";
}

function $(id) { return document.getElementById(id); }

function setError(msg = "") {
  const err = $("hskError");
  if (!err) return;
  if (!msg) { err.classList.add("hidden"); err.textContent = ""; return; }
  err.classList.remove("hidden");
  err.textContent = msg;
}

function setSubTitle() {
  const el = $("hskSubTitle");
  if (!el) return;
  el.textContent = `HSK ${state.lv} · ${state.version}`;
}

function showStudyMode(titleText = "", metaText = "") {
  $("hskLessonListWrap")?.classList.add("hidden");
  $("hskStudyBar")?.classList.remove("hidden");
  if ($("hskStudyTitle")) $("hskStudyTitle").textContent = titleText || "";
  if ($("hskStudyMeta")) $("hskStudyMeta").textContent = metaText || "";
}

function showListMode() {
  $("hskStudyBar")?.classList.add("hidden");
  $("hskLessonListWrap")?.classList.remove("hidden");
  const grid = $("hskGrid");
  if (grid) grid.innerHTML = "";
  state.current = null;
}

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) listEl.innerHTML = `<div class="text-sm opacity-70">${i18n.t("common_loading")}</div>`;

  try {
    if (!window.HSK_LOADER?.loadLessons) {
      throw new Error("HSK_LOADER.loadLessons not found");
    }

    const lessons = await window.HSK_LOADER.loadLessons(state.lv, { version: state.version });
    state.lessons = Array.isArray(lessons) ? lessons : [];

    // render directory
    renderLessonList(listEl, state.lessons, { lang });

  } catch (e) {
    console.error(e);
    setError(`Lessons load failed: ${e?.message || e}`);
  }
}

async function openLesson({ lessonNo, file }) {
  const grid = $("hskGrid");
  if (!grid) return;

  setError("");
  const lang = getLang();

  try {
    // switch to study mode first (so user sees it instantly)
    showStudyMode(`Lesson ${lessonNo}`, `HSK ${state.lv} · ${state.version}`);
    $("hskStudyBar")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // load lesson detail
    if (!window.HSK_LOADER?.loadLessonDetail) {
      throw new Error("HSK_LOADER.loadLessonDetail not found");
    }

    const lessonData = await window.HSK_LOADER.loadLessonDetail(state.lv, Number(lessonNo || 1), {
      version: state.version,
      file: file || "",
    });

    state.current = { lessonNo: Number(lessonNo || 1), file: file || "", lessonData };

    // load vocab and map lesson words
    let vocab = [];
    if (window.HSK_LOADER?.loadVocab) {
      vocab = await window.HSK_LOADER.loadVocab(state.lv, { version: state.version });
    }

    const lessonWordsRaw = Array.isArray(lessonData?.words) ? lessonData.words : [];
    const set = new Set(lessonWordsRaw.map((w) => String(w ?? "").trim()).filter(Boolean));

    const lessonWords =
      Array.isArray(vocab)
        ? vocab.filter((x) => {
            const word = String(x?.word ?? x?.han ?? x?.zh ?? x?.cn ?? "").trim();
            return word && set.has(word);
          })
        : [];

    // render cards into study area (NOT bottom-of-site; it's in layout)
    renderWordCards(grid, lessonWords, undefined, { lang });

  } catch (e) {
    console.error(e);
    setError(`Lesson load failed: ${e?.message || e}`);
  }
}

function bindEvents() {
  const controller = new AbortController();
  const { signal } = controller;

  $("hskLevel")?.addEventListener("change", async (e) => {
    state.lv = Number(e.target.value || 1);
    showListMode();
    await loadLessons();
  }, { signal });

  $("hskVersion")?.addEventListener("change", async (e) => {
    state.version = String(e.target.value || "hsk2.0");
    showListMode();
    await loadLessons();
  }, { signal });

  $("hskBackToList")?.addEventListener("click", () => {
    showListMode();
    $("hskLessonListWrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { signal });

  // Lesson click (delegate)
  $("hskLessonList")?.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-open-lesson="1"]');
    if (!btn) return;
    const lessonNo = Number(btn.dataset.lessonNo || 1);
    const file = btn.dataset.file || "";
    openLesson({ lessonNo, file });
  }, { signal });

  // Search filter (client-side)
  $("hskSearch")?.addEventListener("input", () => {
    const q = String($("hskSearch")?.value || "").trim().toLowerCase();
    const lang = getLang();
    const listEl = $("hskLessonList");
    if (!listEl) return;

    const filtered = !q
      ? state.lessons
      : state.lessons.filter((it) => {
          const title = JSON.stringify(it?.title || it?.name || "").toLowerCase();
          const pinyin = String(it?.pinyinTitle || it?.pinyin || "").toLowerCase();
          const file = String(it?.file || "").toLowerCase();
          return title.includes(q) || pinyin.includes(q) || file.includes(q);
        });

    renderLessonList(listEl, filtered, { lang });
  }, { signal });

  // When language changes: re-render directory and update placeholders/labels
  window.addEventListener("joy:langchanged", () => {
    try { i18n.apply(document); } catch {}
    setSubTitle();

    const lang = getLang();
    renderLessonList($("hskLessonList"), state.lessons, { lang });

    // If currently in study mode, re-render cards in new language (meaning text)
    if (state.current?.lessonData) {
      // re-open using cached info
      openLesson({ lessonNo: state.current.lessonNo, file: state.current.file });
    }
  }, { signal });

  // Also listen i18n bus (if used)
  try {
    i18n?.on?.("change", () => {
      window.dispatchEvent(new CustomEvent("joy:langchanged"));
    });
  } catch {}
}

export async function mount() {
  const navRoot = $("siteNav");
  const app = $("app");

  if (!navRoot || !app) {
    console.error("HSK Page Error: missing #siteNav or #app");
    return false;
  }

  // ✅ Mini nav for HSK (Home + Lang only)
  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  // ✅ HSK layout
  app.innerHTML = getHSKLayoutHTML();

  // Init controls from state
  if ($("hskLevel")) $("hskLevel").value = String(state.lv);
  if ($("hskVersion")) $("hskVersion").value = String(state.version);

  // Apply i18n to page
  try { i18n.apply(document); } catch {}

  bindEvents();
  await loadLessons();
  showListMode(); // start at directory

  return true;
}

// Auto mount if loaded directly
try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount());
  } else {
    mount();
  }
} catch {}
