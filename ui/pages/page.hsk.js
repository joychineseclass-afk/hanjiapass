/* =========================================
   📘 HSK PAGE CONTROLLER — STABLE++ EDITION
   页面总控制器
========================================= */

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";

/**
 * 暴露给 router.js 的生命周期函数
 */
export function mount() {
  bootHSKPage();
}

export function unmount() {
  console.log("HSK Page: Unmounting...");
  // 如果有定时器或全局监听器，可以在这里清除
}

/**
 * 启动页面
 */
function bootHSKPage() {
  const ok = mountLayout();
  if (!ok) return;

  mountGlobalComponents();
  applyI18nIfAvailable();
  initPageModules();
}

/* ===============================
   1️⃣ 渲染页面结构
================================== */
function mountLayout() {
  const navRoot = document.getElementById("siteNav");
  const app = document.getElementById("app");

  if (!navRoot || !app) {
    const errorMsg = `Missing root containers: ${!navRoot ? "#siteNav " : ""}${!app ? "#app" : ""}`;
    document.body.innerHTML = `
      <div style="padding:16px;font-family:system-ui;text-align:center;">
        <h2 style="color:#b91c1c;">HSK Page Error</h2>
        <p>${errorMsg}</p>
      </div>
    `;
    console.error("HSK Page:", errorMsg);
    return false;
  }

  // 挂载导航栏
  mountNavBar(navRoot);

  // 注入主体 HTML
  app.innerHTML = getHSKLayoutHTML();
  return true;
}

/* ===============================
   2️⃣ 挂载全局组件（AI / Learn）
================================== */
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

/* ===============================
   3️⃣ 启动本页功能模块
================================== */
function initPageModules() {
  try {
    initHSKUI({
      defaultLevel: 1,
      autoFocusSearch: true,
    });
  } catch (e) {
    console.error("HSK UI Init Failed:", e);
  }
}

/* ===============================
   🌐 i18n：应用多语言
================================== */
function applyI18nIfAvailable() {
  try {
    i18n.init({
      defaultLang: "kr",
      storageKey: "joy_lang"
    });
    // apply 传入 document 确保全页扫描 data-i18n 标签
    i18n.apply(document); 
  } catch (e) {
    console.warn("HSK Page: i18n failed:", e);
  }
}

/* ===============================
   📦 页面HTML结构模板
================================== */
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

    <div id="hskGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       </div>
    
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

/**
 * 🚀 自启动逻辑
 * 如果不是作为模块被 router 加载，则在 DOMReady 后自动运行
 */
if (document.readyState === "complete" || document.readyState === "interactive") {
  mount();
} else {
  document.addEventListener("DOMContentLoaded", mount);
}
