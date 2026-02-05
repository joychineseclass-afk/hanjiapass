/* =========================================
   📘 HSK PAGE CONTROLLER — STABLE++ EDITION
   页面总控制器（长期扩展不返工）
========================================= */

import { i18n } from "../i18n.js";
import { mountNavBar } from "../components/navBar.js";
import { mountAIPanel } from "../components/aiPanel.js";
import { mountLearnPanel } from "../components/learnPanel.js";
import { initHSKUI } from "../modules/hsk/hskUI.js";

// ❌ 删除这句：document.addEventListener("DOMContentLoaded", bootHSKPage);

export function mount() {
  bootHSKPage();
}

export function unmount() {
  // 先留空也行，后面再加清理逻辑
}

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
    // ✅ 不只 console：也给用户一个可见提示（方便手机调试）
    document.body.innerHTML = `
      <div style="padding:16px;font-family:system-ui">
        <h2 style="margin:0 0 8px 0;">HSK Page Error</h2>
        <div style="color:#b91c1c">
          Missing root containers: ${!navRoot ? "#siteNav " : ""}${!app ? "#app" : ""}
        </div>
      </div>
    `;
    console.error("HSK Page: Missing root containers.", { navRoot, app });
    return false;
  }

  // ✅ Nav 只 mount 一次
  mountNavBar(navRoot);

  // ✅ 页面主体（包含 portal-root：给 AI / Learn Panel 用）
  app.innerHTML = getHSKLayoutHTML();
  return true;
}

/* ===============================
   2️⃣ 挂载全局组件（AI / Learn）
================================== */
function mountGlobalComponents() {
  // ✅ 给全局组件一个固定的“挂载点”，避免以后每页到处插 DOM
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
  // ✅ 允许未来扩展参数（不改 hskUI 内部也行）
  initHSKUI({
    defaultLevel: 1,
    autoFocusSearch: true,
  });
}

/* ===============================
   🌐 i18n：如果存在就应用一次
   （确保 data-i18n 立刻生效）
================================== */
function applyI18nIfAvailable() {
  try {
    // ✅ 和你笔顺那块一致：joy_lang / kr
    i18n.init({
      defaultLang: "kr",
      storageKey: "joy_lang",
      autoApplyRoot: document
    });

    i18n.apply(); // ✅ 立即应用 data-i18n
  } catch (e) {
    console.warn("HSK Page: i18n init/apply failed:", e);
  }
}

/* ===============================
   📦 页面HTML结构模板
================================== */
function getHSKLayoutHTML() {
  return `
    <!-- ✅ HSK 顶部栏 -->
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

    <!-- ✅ Error -->
    <div id="hskError"
      class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
    </div>

    <!-- ✅ HSK 主容器 -->
    <div id="hskGrid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
    <div class="h-24"></div>

    <!-- ✅ Portal 预留（也可不放这里，ensurePortalRoot 会兜底）
         放这里的好处：结构更清晰 -->
    <div id="portal-root"></div>
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
