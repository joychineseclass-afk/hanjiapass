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
  // 如果有定时器，可以在这里清理，例如：clearInterval(window.hskTimer);
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
    // 如果找不到容器，输出详细错误方便调试
    const errorMsg = `Missing root containers: ${!navRoot ? "#siteNav " : ""}${!app ? "#app" : ""}`;
    console.error("HSK Page Error:", errorMsg);
    return false;
  }

  // 挂载导航栏
  mountNavBar(navRoot);

  // 注入主体 HTML 结构
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
   3️⃣ 启动本页功能模块（保留你跑通的逻辑）
================================== */
function initPageModules() {
  try {
    // 确保 initHSKUI 在这里是可用的
    // 如果你使用了 import { initHSKUI } ...，那么这样调用没问题
    initHSKUI({
      lang: "ko",            // 建议显式传入语言，因为你的 hskUI 内部用了这个参数
      defaultLevel: 1,
      autoFocusSearch: false // 保持 false 是对的，避免 Vercel 焦点报错
    });

    console.log("HSK Page Modules Initialized.");
  } catch (e) {
    console.error("HSK UI Init Failed:", e);
  }
}
/* ===============================
   🌐 i18n：应用多语言
================================== */
function applyI18nIfAvailable() {
  try {
    // 确保 i18n 已经初始化并应用到当前 DOM
    if (i18n) {
      i18n.apply(document);
    }
  } catch (e) {
    console.warn("HSK Page: i18n apply failed:", e);
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

/**
 * 🚀 智能自启动逻辑
 */
(function autoInit() {
  // 检查当前环境是否需要手动启动
  // 1. 如果有 #app 容器
  // 2. 如果 router 没有管理（window.currentModule 为空）
  const appExists = !!document.getElementById("app");
  
  if (appExists) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      mount();
    } else {
      document.addEventListener("DOMContentLoaded", mount);
    }
  }
})();
