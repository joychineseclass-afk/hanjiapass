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
import { modalTpl, createModalSystem } from "../components/modalBase.js";
import { mountDialogueModal, openDialogueModal } from "../components/dialogueModal.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";
import { deriveLessonId } from "../core/deriveLessonId.js";

function setCurrentLessonGlobal(lesson, opts = {}) {
  const version =
    opts.version ||
    lesson?.version ||
    localStorage.getItem("hsk_vocab_version") ||
    "hsk2.0";

  const lv = opts.lv ?? lesson?.lv ?? lesson?.level;

  const lessonId = deriveLessonId(lesson, { lv, version });

  const cur = { ...(lesson || {}), lv, version, lessonId, openedAt: Date.now() };

  window.__HSK_CURRENT_LESSON_ID = lessonId;
  window.__HSK_CURRENT_LESSON = cur;

  // 可选：刷新后还能恢复“上次选中的课”
  try {
    localStorage.setItem(
      "hsk_last_lesson",
      JSON.stringify({
        lessonId,
        lv,
        version,
        file: lesson?.file || lesson?.path || lesson?.url || ""
      })
    );
  } catch {}

  console.log("[page.hsk] SET current lesson =>", lessonId, cur);
  return cur;
}


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
  enableHSKModalMode(); // ✅ 单词/会话/语法/练习/AI 全部改为弹窗模式
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

function joyGetLang() {
  return localStorage.getItem("joy_lang") || localStorage.getItem("site_lang") || "kr";
}

/**
 * 把旧UI按钮接到新 Lesson Engine/Runner
 * - 不依赖你旧逻辑结构
 * - 只要传入当前 lessonId 即可
 */
function joyOpenStep(stepName, lessonId) {
  const lang = joyGetLang();

  console.log("[UI] step click =", stepName);
  console.log("[UI] before start state =", window.LESSON_ENGINE?.getState?.());
  console.log("[UI] using lessonId =", lessonId, "lang=", lang);

  if (!window.LESSON_ENGINE?.start) {
    console.warn("[UI] LESSON_ENGINE not found");
    return;
  }

  // ✅ 如果 engine 还没绑定 lessonId，就 start 一次
  const st0 = window.LESSON_ENGINE.getState?.();
  if (!st0?.lessonId || st0.lessonId !== lessonId) {
    window.LESSON_ENGINE.start({ lessonId, lang });
  }

  console.log("[UI] after start state =", window.LESSON_ENGINE.getState?.());

  // ✅ 跳到指定步骤：words/dialogue/grammar/practice/ai
  try {
    window.LESSON_ENGINE.go(stepName);
  } catch (e) {
    console.warn("[UI] go(step) failed:", e);
    return;
  }

  console.log("[UI] after go state =", window.LESSON_ENGINE.getState?.());
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
  const lessonId = deriveLessonId(lesson, { lv, version });

 if (lessonId) {
  // ✅ 新统一全局（tab / runner / 其它模块都读这个）
  window.__HSK_CURRENT_LESSON_ID = lessonId;
  window.__HSK_CURRENT_LESSON = {
    ...(lesson || {}),
    lessonId,
    lv,
    version,
    openedAt: Date.now(),
  };

  // ✅ 兼容旧字段（你以前系统可能还在读这些）
  window._CURRENT_LESSON_ID = lessonId;
  window.__HSK_LAST_LESSON_ID = lessonId;

  // ✅ 持久化：刷新也能恢复“最后一课”
  try {
    localStorage.setItem("joy_current_lesson", lessonId);
    localStorage.setItem(
      "hsk_last_lesson",
      JSON.stringify({
        lessonId,
        lv,
        version,
        file: lesson?.file || lesson?.path || lesson?.url || "",
      })
    );
  } catch {}
}

  console.log("[HSK] openLesson clicked:", { lessonId, lv, version, lesson });

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
    const lessonId =
  lesson?.lessonId ||
  lesson?.id ||
  lesson?.lesson ||
  lessonData?.lessonId ||
  lessonData?.id ||
  "";

window.__HSK_CURRENT_LESSON = {
  lessonId,
  lv,
  version,
  lesson,
  lessonData
};

console.log("[HSK] current lesson set:", window.__HSK_CURRENT_LESSON);
    
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
/* =========================================================
   ✅ HSK Modal Mode: tabs open modals only, page content hidden
   - Covers: 단어/회화/문법/연습/AI
   - Only edit hsk.js once
========================================================= */
function enableHSKModalMode() {
  // bind once
  if (document.body.dataset.__hskModalMode === "1") return;
  document.body.dataset.__hskModalMode = "1";

  // 1) Inject CSS to hide the inline lesson/tab content area (best-effort selectors)
  ensureHSKModalModeCSS();

  // 2) Build 3 generic modals for: grammar / practice / ai
  const MODALS = ensureHSKGenericModals();

  // 3) Delegate click on tab buttons
document.addEventListener(
  "click",
  (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    // ✅ 1️⃣ 忽略弹窗内部点击
    if (t.closest(".joy-modal, .modal, [data-modal], .modalRoot, .modalOverlay")) {
      return;
    }

    // ✅ 2️⃣ 只处理页面顶部 tab
    const btn = t.closest("button, a, [role='tab']");
    if (!btn) return;

    const label = (btn.textContent || "").trim();
    const key = btn.getAttribute("data-tab") || btn.getAttribute("data-key") || "";

    const tab = normalizeTabKey(key, label);
    if (!tab) return;

    // ✅ Stop page switching / inline rendering
    e.preventDefault();
    e.stopPropagation();

    // ✅ 先确保有 lessonId（必要时从 localStorage 恢复）
    if (!window.__HSK_CURRENT_LESSON_ID) {
      try {
        const last = JSON.parse(
          localStorage.getItem("hsk_last_lesson") || "null"
        );
        if (last?.file) {
          setCurrentLessonGlobal({
            file: last.file,
            lv: last.lv,
            version: last.version,
            lessonId: last.lessonId,
          });
        }
      } catch {}
    }

    const cur = window.__HSK_CURRENT_LESSON || null;

    const currentLessonId =
      window.__HSK_CURRENT_LESSON_ID ||
      cur?.lessonId ||
      cur?.id ||
      "";

    // ❗如果没有 lessonId，直接停止
    if (!currentLessonId) {
      console.warn("[page.hsk] missing lessonId, keep modal as-is");
      return;
    }

    // ✅ 有 lessonId 才清理 inline
    suppressInlineLessonArea();

    // ✅ 调用 step
    if (typeof window.joyOpenStep === "function") {
      console.log("[page.hsk] joyOpenStep:", tab, currentLessonId);
      window.joyOpenStep(tab, currentLessonId);
      return;
    }

    console.warn("[page.hsk] joyOpenStep missing:", {
      tab,
      currentLessonId,
    });
  },
  true // capture = true
);

      const lessonData = cur?.lessonData || {};
      const lv = cur?.lv || "";
      const version = cur?.version || "";

      // For title/subtitle
      const titleBase = pickTextAny(lessonData?.title) || "학습";
      const subtitle = `HSK ${lv} · ${version}`;

      // 4) Route to correct modal
      if (tab === "dialogue") {
        // Use your existing dialogue panel (dialoguePanel.js)
        // Make sure it's mounted somewhere (you already do mountDialoguePanel in mount()).
        const dialogue =
          lessonData?.dialogue ||
          lessonData?.conversation ||
          lessonData?.content ||
          [];

        // Open dialogue modal (window.DIALOGUE_PANEL)
        if (window.DIALOGUE_PANEL?.open) {
          window.DIALOGUE_PANEL.open({
            title: `${titleBase} · 회화`,
            subtitle,
            dialogue,
            lang: "ko",
          });
        } else {
          // fallback: show generic
          MODALS.generic.open({
            title: `${titleBase} · 회화`,
            subtitle,
            html: `<div class="p-4 text-sm text-gray-500">DIALOGUE_PANEL not mounted.</div>`,
          });
        }
        return;
      }

      if (tab === "grammar") {
        const grammar =
          lessonData?.grammar ||
          lessonData?.grammars ||
          lessonData?.patterns ||
          lessonData?.points ||
          lessonData?.grammarPoints ||
          [];

        MODALS.grammar.open({
          title: `${titleBase} · 문법`,
          subtitle,
          data: grammar,
        });
        return;
      }

      if (tab === "practice") {
        const practice =
          lessonData?.practice ||
          lessonData?.exercises ||
          lessonData?.drills ||
          lessonData?.questions ||
          [];

        MODALS.practice.open({
          title: `${titleBase} · 연습`,
          subtitle,
          data: practice,
        });
        return;
      }

      if (tab === "ai") {
        // You may already have AI panel. We show a modal wrapper here.
        MODALS.ai.open({
          title: `${titleBase} · AI`,
          subtitle,
          lessonData,
        });
        return;
      }

      if (tab === "words") {
        // “단어” tab: in your current UI, words are already the grid.
        // We can optionally scroll to grid + show a small modal summary.
        document.querySelector("#hskGrid")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        MODALS.generic.open({
          title: `${titleBase} · 단어`,
          subtitle,
          html: `
            <div class="p-4">
              <div class="text-sm text-gray-600">단어는 아래 카드 그리드에서 학습해요.</div>
              <div class="text-xs text-gray-400 mt-2">(카드 클릭 → 배우기/AI 등)</div>
            </div>
          `,
        });
        return;
      }
    },
      true // capture = true, so we intercept before other handlers
    );
}

/* -----------------------------
   CSS: hide inline lesson content
------------------------------ */
function ensureHSKModalModeCSS() {
  const id = "__hsk_modal_mode_css__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    /* Best-effort: hide common inline lesson/content containers */
    #lessonContent, #hskLessonContent, #hskContent, #tabContent,
    .lesson-content, .hsk-lesson-content, .tab-content, .hsk-tab-content,
    #dialogueContent, #grammarContent, #practiceContent, #aiContent {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/* -----------------------------
   Generic Modals (grammar/practice/ai)
------------------------------ */
function ensureHSKGenericModals() {
  // mount once
  if (window.__HSK_GENERIC_MODALS) return window.__HSK_GENERIC_MODALS;

  // portal root
  let portal = document.getElementById("portal-root");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "portal-root";
    document.body.appendChild(portal);
  }

  // root
  const root = document.createElement("div");
  root.id = "hsk-generic-modals-root";
  root.innerHTML = `
    ${modalTpl({ id:"hsk-generic-modal", titleId:"hskGenTitle", backId:"hskGenBack", closeId:"hskGenClose", bodyId:"hskGenBody", titleText:"", maxWidth: 860 })}
    ${modalTpl({ id:"hsk-grammar-modal", titleId:"hskGrammarTitle", backId:"hskGrammarBack", closeId:"hskGrammarClose", bodyId:"hskGrammarBody", titleText:"문법", maxWidth: 860 })}
    ${modalTpl({ id:"hsk-practice-modal", titleId:"hskPracticeTitle", backId:"hskPracticeBack", closeId:"hskPracticeClose", bodyId:"hskPracticeBody", titleText:"연습", maxWidth: 860 })}
    ${modalTpl({ id:"hsk-ai-modal", titleId:"hskAiTitle", backId:"hskAiBack", closeId:"hskAiClose", bodyId:"hskAiBody", titleText:"AI", maxWidth: 860 })}
  `;
  portal.appendChild(root);

  const generic = createModalSystem(root, {
    id: "hsk-generic-modal",
    titleId: "hskGenTitle",
    backId: "hskGenBack",
    closeId: "hskGenClose",
    bodyId: "hskGenBody",
    lockScroll: true,
    escClose: true,
  });

  const grammar = createModalSystem(root, {
    id: "hsk-grammar-modal",
    titleId: "hskGrammarTitle",
    backId: "hskGrammarBack",
    closeId: "hskGrammarClose",
    bodyId: "hskGrammarBody",
    lockScroll: true,
    escClose: true,
  });

  const practice = createModalSystem(root, {
    id: "hsk-practice-modal",
    titleId: "hskPracticeTitle",
    backId: "hskPracticeBack",
    closeId: "hskPracticeClose",
    bodyId: "hskPracticeBody",
    lockScroll: true,
    escClose: true,
  });

  const ai = createModalSystem(root, {
    id: "hsk-ai-modal",
    titleId: "hskAiTitle",
    backId: "hskAiBack",
    closeId: "hskAiClose",
    bodyId: "hskAiBody",
    lockScroll: true,
    escClose: true,
  });

  // stronger overlay style
  ensureGenericModalCSS();

  window.__HSK_GENERIC_MODALS = {
    generic: {
      open: ({ title, subtitle, html }) => {
        generic.setTitle(title || "");
        generic.body.innerHTML = `
          <div class="p-4">
            ${subtitle ? `<div class="text-sm text-gray-500 mb-3">${escapeHTML(subtitle)}</div>` : ""}
            ${html || ""}
          </div>
        `;
        generic.open();
      },
      close: () => generic.close(),
    },
    grammar: {
      open: ({ title, subtitle, data }) => {
        grammar.setTitle(title || "문법");
        grammar.body.innerHTML = renderListBlock(subtitle, data, "문법 데이터가 없어요.");
        grammar.open();
      },
      close: () => grammar.close(),
    },
    practice: {
      open: ({ title, subtitle, data }) => {
        practice.setTitle(title || "연습");
        practice.body.innerHTML = renderListBlock(subtitle, data, "연습 데이터가 없어요.");
        practice.open();
      },
      close: () => practice.close(),
    },
    ai: {
      open: ({ title, subtitle, lessonData }) => {
        ai.setTitle(title || "AI");
        ai.body.innerHTML = `
          <div class="p-4">
            ${subtitle ? `<div class="text-sm text-gray-500 mb-3">${escapeHTML(subtitle)}</div>` : ""}
            <div class="rounded-2xl border p-4">
              <div class="font-extrabold mb-2">AI 선생님</div>
              <div class="text-sm text-gray-600">
                이 레슨 내용으로 질문해보세요.
              </div>
              <div class="text-xs text-gray-400 mt-2">
                (다음 단계: 여기서 바로 AI 패널/채팅 UI를 붙이면 완성!)
              </div>
            </div>
          </div>
        `;
        ai.open();
      },
      close: () => ai.close(),
    },
  };

  return window.__HSK_GENERIC_MODALS;
}

function ensureGenericModalCSS() {
  const id = "__hsk_generic_modal_css__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    #hsk-generic-modal, #hsk-grammar-modal, #hsk-practice-modal, #hsk-ai-modal{
      position: fixed !important;
      inset: 0 !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 24px !important;
      background: rgba(0,0,0,0.62) !important;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    #hsk-generic-modal.joy-modal-hidden,
    #hsk-grammar-modal.joy-modal-hidden,
    #hsk-practice-modal.joy-modal-hidden,
    #hsk-ai-modal.joy-modal-hidden{
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/* -----------------------------
   Hide inline content area (runtime)
   - best effort without knowing exact DOM
------------------------------ */
function suppressInlineLessonArea() {
  // 1) If you have a known container, hide it
  const known =
    document.getElementById("lessonContent") ||
    document.getElementById("hskLessonContent") ||
    document.getElementById("hskContent") ||
    document.querySelector(".lesson-content") ||
    document.querySelector(".hsk-lesson-content") ||
    null;

  if (known) {
    known.style.display = "none";
    return;
  }

  // 2) Otherwise, hide the block under the tab bar (best effort)
  const tabBar = findHSKTabBar();
  if (tabBar) {
    // typically content is the next block after tab bar
    const content = findNextBlock(tabBar);
    if (content) content.style.display = "none";
  }
}

function findHSKTabBar() {
  // find a container that contains all five labels
  const labels = ["단어", "회화", "문법", "연습", "AI"];
  const candidates = Array.from(document.querySelectorAll("div, nav, section"));
  for (const el of candidates) {
    const txt = (el.textContent || "").trim();
    if (!txt) continue;
    if (labels.every((x) => txt.includes(x))) return el;
  }
  return null;
}

function findNextBlock(el) {
  let cur = el;
  for (let i = 0; i < 5 && cur; i++) {
    const next = cur.nextElementSibling;
    if (next && next.getBoundingClientRect && next.getBoundingClientRect().height > 40) return next;
    cur = cur.parentElement;
  }
  return null;
}

/* -----------------------------
   tab key normalize
------------------------------ */
function normalizeTabKey(key, label) {
  const k = String(key || "").toLowerCase();
  const L = String(label || "").trim();

  if (k === "words" || L === "단어" || L === "词" || L === "单词") return "words";
  if (k === "dialogue" || L === "회화" || L === "会话" || L === "對話" || L === "对话") return "dialogue";
  if (k === "grammar" || L === "문법" || L === "语法") return "grammar";
  if (k === "practice" || L === "연습" || L === "练习") return "practice";
  if (k === "ai" || L === "AI" || L.toLowerCase() === "ai") return "ai";

  return "";
}

/* -----------------------------
   simple render helpers
------------------------------ */
function renderListBlock(subtitle, data, emptyText) {
  const list = Array.isArray(data) ? data : (data ? [data] : []);
  const items = list
    .map((x) => {
      if (typeof x === "string") return `<li class="py-2 border-b last:border-b-0">${escapeHTML(x)}</li>`;
      if (typeof x === "object") return `<li class="py-2 border-b last:border-b-0"><pre class="text-xs whitespace-pre-wrap">${escapeHTML(JSON.stringify(x, null, 2))}</pre></li>`;
      return "";
    })
    .filter(Boolean)
    .join("");

  return `
    <div class="p-4">
      ${subtitle ? `<div class="text-sm text-gray-500 mb-3">${escapeHTML(subtitle)}</div>` : ""}
      ${
        items
          ? `<ul class="rounded-2xl border px-4">${items}</ul>`
          : `<div class="rounded-2xl border p-6 text-sm text-gray-500">${escapeHTML(emptyText)}</div>`
      }
    </div>
  `;
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pickTextAny(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return v.ko || v.kr || v.zh || v.cn || v.en || "";
  return String(v);
}
