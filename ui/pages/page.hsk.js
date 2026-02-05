// /ui/pages/page.hsk.js
import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";

let hskApi = null;

export async function mount() {
  const ok = mountLayout();
  if (!ok) return;

  mountGlobalComponents();
  applyI18nIfAvailable();

  // ✅ 关键：先加载 HSK 依赖脚本
  await ensureHSKScriptsLoaded();

  // 再启动 UI
  initPageModules();
}

export function unmount() {
  hskApi = null;
}

/* =============================== */
function mountLayout() {
  const navRoot = document.getElementById("siteNav");
  const app = document.getElementById("app");

  if (!navRoot || !app) return false;

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
  if (!document.getElementById("portal-root")) {
    const portal = document.createElement("div");
    portal.id = "portal-root";
    document.body.appendChild(portal);
  }
}

/* =============================== */
/* 🧠 动态加载全局 HSK 脚本 */
async function ensureHSKScriptsLoaded() {
  if (window.HSK_LOADER && window.HSK_RENDER && window.HSK_HISTORY) return;

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });

  await loadScript("/ui/modules/hsk/hskLoader.js");
  await loadScript("/ui/modules/hsk/hskRenderer.js");
  await loadScript("/ui/modules/hsk/hskHistory.js");
}

/* =============================== */
function initPageModules() {
  try {
    hskApi = initHSKUI({
      defaultLevel: 1,
      autoFocusSearch: false,
      lang: "ko",
    });
  } catch (e) {
    console.error("HSK UI Init Failed:", e);
  }
}

function applyI18nIfAvailable() {
  try {
    i18n?.apply?.(document);
  } catch {}
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

          <input id="hskSearch" class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="검색" autocomplete="off"/>
        </div>
      </div>
    </div>

    <div id="hskError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm"></div>
    <div id="hskGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    <div id="portal-root"></div>
  `;
}

function renderLevelOptions() {
  return Array.from({ length: 9 }, (_, i) => {
    const level = i + 1;
    return `<option value="${level}" ${level === 1 ? "selected" : ""}>HSK ${level}급</option>`;
  }).join("");
}
