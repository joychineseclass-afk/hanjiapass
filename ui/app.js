/* =========================================
   🌍 APP ENTRY — GLOBAL BOOTSTRAP
   全站唯一入口（只在 index.html 引入这一个）
========================================= */
import { LESSON_ENGINE } from "./core/lessonEngine.js";
window.LESSON_ENGINE = LESSON_ENGINE;

import { mountLessonBridge } from "./core/lessonBridge.js";
mountLessonBridge();

import { mountLessonStepRunner } from "./core/lessonStepRunner.js";
mountLessonStepRunner();

import "./components/wordPanel.js";

import { i18n } from "./i18n.js";
import { startRouter, registerRoute } from "./router.js";
import { mountNavBar } from "./components/navBar.js";
import { mountAIPanel } from "./components/aiPanel.js";
import { mountLearnPanel } from "./components/learnPanel.js";

// ✅ Global helper: open step modal by Lesson Engine + StepRunner
window.joyOpenStep = function joyOpenStep(step, lessonId, opts = {}) {
  const engine = window.LESSON_ENGINE;
  if (!engine) {
    console.warn("[joyOpenStep] LESSON_ENGINE missing");
    return;
  }
  if (!lessonId) {
    console.warn("[joyOpenStep] lessonId missing", { step, lessonId });
    return;
  }

  const lang =
    opts.lang ||
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr";

  // Ensure engine has state for this lesson
  engine.start({ lessonId, lang });

  // Jump to requested step (words/dialogue/grammar/practice/ai)
  if (step) engine.go(step);

  console.log("[joyOpenStep] ok:", { step, lessonId, lang });
};

/* ===============================
   🌐 i18n 全站初始化
   - 默认韩语
   - 切换语言自动刷新整页
   - 新增 DOM 自动翻译（配合 router 懒加载页面）
================================== */
i18n.init({
  defaultLang: "kr",
  storageKey: "joy_lang",
  autoApplyRoot: document,
  observe: true
});

// 首次应用翻译
i18n.apply(document);


/* ===============================
   🧭 注册页面路由（懒加载）
     ⚠️ 注意：这里的路径是从 ui/app.js 出发
================================== */
registerRoute("#home",      () => import("./pages/page.home.js"));
registerRoute("#hsk",       () => import("./pages/page.hsk.js"));
registerRoute("#stroke",    () => import("./pages/page.stroke.js"));

registerRoute("#hanja",     () => import("./pages/page.hanja.js"));
registerRoute("#speaking",  () => import("./pages/page.speaking.js"));
registerRoute("#travel",    () => import("./pages/page.travel.js"));
registerRoute("#culture",   () => import("./pages/page.culture.js"));
registerRoute("#review",    () => import("./pages/page.review.js"));
registerRoute("#resources", () => import("./pages/page.resources.js"));
registerRoute("#teacher",   () => import("./pages/page.teacher.js"));
registerRoute("#my",        () => import("./pages/page.my.js"));


/* ===============================
   🚀 页面启动入口
================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ 顶部导航栏（品牌 + 语言切换 + 菜单）
  mountNavBar(document.getElementById("siteNav"));

  // 2️⃣ 全局浮动面板（只挂一次）
  mountAIPanel();     // 🤖 AI 老师
  mountLearnPanel();  // 📘 单词学习面板

  // 3️⃣ 启动路由
  if (!location.hash) location.hash = "#home";
  startRouter();
});
