// /ui/pages/page.hsk.js
// ✅ HSK Page Controller — Stable++ (router-compatible)
// - exports: mount(), unmount()
// - router controls lifecycle
// - ensures global deps: HSK_LOADER / HSK_RENDER / HSK_HISTORY

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
  try {
    // 如果你未来让 initHSKUI() 返回 destroy/unmount，这里会自动清理
    if (hskApi?.destroy) await hskApi.destroy();
    if (hskApi?.unmount) await hskApi.unmount();
  } catch (e) {
    console.warn("HSK Page unmount cleanup error:", e);
  } finally {
    hskApi = null;
  }
}

function mountLayout() {
  const navRoot = document.getElementById("siteNav");
  const app = document.getElementById("app");

  if (!navRoot || !app) {
    const errorMsg = `Missing root containers: ${!navRoot ? "#siteNav " : ""}${!app ? "#app" : ""}`;
    console.error("HSK Page Error:", errorMsg);
    return false;
  }

  // 导航栏（幂等）
  mountNavBar(navRoot);

  // 页面主体（每次进入页面都重建 DOM）
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
    // 让 router 显示 “페이지 로드 실패” 时更明确
    throw new Error(msg);
  }
}

/* ===============================
   ✅ Load global deps safely
   tries both folder layouts:
   - /ui/modules/hsk/*.js
   - /ui/modules/*.js
================================== */
async function ensureHSKDeps() {
  // ✅ 已经具备就直接返回
  if (window.HSK_LOADER?.loadVocab && window.HSK_RENDER && window.HSK_HISTORY) return;

  // ✅ 并发锁
  if (depsPromise) return depsPromise;

  depsPromise = (async () => {
    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        // ✅ already loaded? (basename or full)
        const base = src.split("/").pop();
        const exists = [...document.scripts].some((s) => {
          const u = String(s.src || "");
          return u === src || u.endsWith("/" + base) || u.includes(base);
        });
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

    // ✅ 这里的路径要对齐你仓库结构
    // 你截图里真实文件在: /ui/modules/hsk/hskLoader.js 等
    const loadedLoader = await loadFirstThatWorks([
      "/ui/modules/hsk/hskLoader.js",
      "/ui/modules/hskLoader.js",
    ]);

    const loadedRenderer = await loadFirstThatWorks([
      "/ui/modules/hsk/hskRenderer.js",
      "/ui/modules/hskRenderer.js",
    ]);

    const loadedHistory = await loadFirstThatWorks([
      "/ui/modules/hsk/hskHistory.js",
      "/ui/modules/hskHistory.js",
    ]);

    // ✅ verify globals
    if (!window.HSK_LOADER?.loadVocab) {
      throw new Error(
        `HSK_LOADER.loadVocab 가 없습니다.\n(로드된 파일: ${loadedLoader})\n` +
          `hskLoader.js가 window.HSK_LOADER = { loadVocab, loadLessons } 형태로 등록해야 합니다.`
      );
    }
    if (!window.HSK_RENDER) {
      throw new Error(
        `HSK_RENDER 가 없습니다.\n(로드된 파일: ${loadedRenderer})\n` +
          `hskRenderer.js가 window.HSK_RENDER 를 전역 등록해야 합니다.`
      );
    }
    if (!window.HSK_HISTORY) {
      throw new Error(
        `HSK_HISTORY 가 없습니다.\n(로드된 파일: ${loadedHistory})\n` +
          `hskHistory.js가 window.HSK_HISTORY 를 전역 등록해야 합니다.`
      );
    }
  })();

  // ✅ 如果失败，允许用户“再次进入页面”时重试
  try {
    return await depsPromise;
  } catch (e) {
    depsPromise = null;
    throw e;
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
