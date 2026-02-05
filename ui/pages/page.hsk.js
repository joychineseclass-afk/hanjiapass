// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — Stable++ (router-compatible)
// - exports: mount(), unmount()
// - router controls lifecycle

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";

let hskApi = null;
let depsPromise = null;

export async function mount() {
  const ok = mountLayout();
  if (!ok) return;

  mountGlobalComponents();
  applyI18nIfAvailable();

  // ✅ must have HSK_LOADER / HSK_RENDER / HSK_HISTORY
  await ensureHSKDeps();

  // ✅ then init UI
  initPageModules();
}

export async function unmount() {
  hskApi = null;
}

function mountLayout() {
  const navRoot = document.getElementById("siteNav");
  const app = document.getElementById("app");

  if (!navRoot || !app) {
    const errorMsg = `Missing root containers: ${!navRoot ? "#siteNav " : ""}${!app ? "#app" : ""}`;
    console.error("HSK Page Error:", errorMsg);
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

function initPageModules() {
  try {
    hskApi = initHSKUI({
      defaultLevel: 1,
      autoFocusSearch: false,
      lang: "ko",
    });
    console.log("HSK Page Modules Initialized.");
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("HSK UI Init Failed:", msg, e);
    throw new Error(msg);
  }
}

/* ===============================
   ✅ Load global deps safely
   tries both:
   - /ui/modules/hsk/*.js
   - /ui/modules/*.js
================================== */
async function ensureHSKDeps() {
  if (window.HSK_LOADER?.loadVocab && window.HSK_RENDER && window.HSK_HISTORY) return;
  if (depsPromise) return depsPromise;

  depsPromise = (async () => {
    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        // already loaded?
        const exists = [...document.scripts].some((s) => (s.src || "").endsWith(src));
        if (exists) return resolve();

        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(s);
      });

    async function loadFirstThatWorks(candidates) {
      let lastErr = null;
      for (const src of candidates) {
        try {
          await loadScript(src);
          return src;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error("Failed to load scripts");
    }

    // ✅ try both folder layouts
    await loadFirstThatWorks([
      "/ui/modules/hsk/hskLoader.js",
      "/ui/modules/hskLoader.js",
    ]);
    await loadFirstThatWorks([
      "/ui/modules/hsk/hskRenderer.js",
      "/ui/modules/hskRenderer.js",
    ]);
    await loadFirstThatWorks([
      "/ui/modules/hsk/hskHistory.js",
      "/ui/modules/hskHistory.js",
    ]);

    // ✅ verify globals
    if (!window.HSK_LOADER?.loadVocab) {
      throw new Error("HSK_LOADER.loadVocab 가 없습니다. (hskLoader.js가 window.HSK_LOADER를 등록해야 합니다)");
    }
    if (!window.HSK_RENDER) {
      throw new Error("HSK_RENDER 가 없습니다. (hskRenderer.js 전역 등록 확인)");
    }
    if (!window.HSK_HISTORY) {
      throw new Error("HSK_HISTORY 가 없습니다. (hskHistory.js 전역 등록 확인)");
    }
  })();

  return depsPromise;
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
