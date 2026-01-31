/* =========================================
   📘 HSK PAGE CONTROLLER — STABLE EDITION
   页面总控制器（可长期扩展不返工）
========================================= */

import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";

/* ===============================
   页面启动总入口
================================== */
document.addEventListener("DOMContentLoaded", bootHSKPage);

function bootHSKPage() {
  mountLayout();
  mountGlobalComponents();
  initPageModules();
}

/* ===============================
   1️⃣ 渲染页面结构
================================== */
function mountLayout() {
  const navRoot = document.getElementById("siteNav");
  const app = document.getElementById("app");

  if (!navRoot || !app) {
    console.error("HSK Page: Missing root containers.");
    return;
  }

  mountNavBar(navRoot);
  app.innerHTML = getHSKLayoutHTML();
}

/* ===============================
   2️⃣ 挂载全局组件
================================== */
function mountGlobalComponents() {
  mountAIPanel();
  mountLearnPanel();
}

/* ===============================
   3️⃣ 启动本页功能模块
================================== */
function initPageModules() {
  initHSKUI(); // 旧 hskUI.js 里的核心逻辑入口
}

/* ===============================
   📦 页面HTML结构模板
================================== */
function getHSKLayoutHTML() {
  return `
    <div class="bg-white rounded-2xl shadow p-4 mb-4">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold" data-i18n="hsk_title">HSK 학습 콘텐츠</span>
          <span id="hskStatus" class="text-xs text-gray-500"></span>
        </div>

        <div class="flex-1"></div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600" data-i18n="hsk_level">레벨</label>
          <select id="hskLevel" class="border rounded-lg px-3 py-2 text-sm bg-white">
            ${renderLevelOptions()}
          </select>

          <input
            id="hskSearch"
            class="border rounded-lg px-3 py-2 text-sm w-48"
            placeholder="검색 (예: 你好 / 숫자 / 가족)"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="mt-3 text-xs text-gray-500" data-i18n="hsk_tip">
        💡 카드 클릭 → 배우기 → AI 선생님에게 질문하기
      </div>
    </div>

    <div id="hskError"
      class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
    </div>

    <div id="hskGrid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
    <div class="h-24"></div>
  `;
}

/* ===============================
   🎚 HSK 等级选项生成
================================== */
function renderLevelOptions() {
  return Array.from({ length: 9 }, (_, i) => {
    const level = i + 1;
    return `<option value="${level}" ${level === 1 ? "selected" : ""}>HSK ${level}</option>`;
  }).join("");
}
