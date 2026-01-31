/* =========================================
   🌍 APP ENTRY — GLOBAL BOOTSTRAP
   全站唯一入口（只在 index.html 引入这一个）
========================================= */

import { startRouter, registerRoute } from "./router.js";
import { mountNavBar } from "./components/navBar.js";
import { mountAIPanel } from "./components/aiPanel.js";
import { mountLearnPanel } from "./components/learnPanel.js";

/* ===============================
   🧭 注册页面路由（懒加载）
   只有切换到该页面才会加载 JS
================================== */
registerRoute("#home", () => import("./pages/page.home.js"));
registerRoute("#hsk", () => import("./pages/page.hsk.js"));
registerRoute("#stroke", () => import("./pages/page.stroke.js"));
registerRoute("#travel", () => import("./pages/page.travel.js"));

/* ===============================
   🚀 页面启动入口
================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ 挂载顶部导航栏（品牌 + 语言切换 + 菜单）
  mountNavBar(document.getElementById("siteNav"));

  // 2️⃣ 挂载全局浮动面板（只执行一次）
  mountAIPanel();     // 🤖 AI 老师
  mountLearnPanel();  // 📘 单词学习面板

  // 3️⃣ 启动路由系统（根据 hash 加载页面）
  startRouter();
});
