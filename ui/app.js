/* =========================================
   🌍 APP ENTRY — GLOBAL BOOTSTRAP
========================================= */

import { LESSON_ENGINE } from "./core/lessonEngine.js";
window.LESSON_ENGINE = LESSON_ENGINE;

import { mountLessonBridge } from "./core/lessonBridge.js";
import { mountLessonStepRunner } from "./core/lessonStepRunner.js";

import "./components/wordPanel.js";

import { i18n } from "./i18n.js";
import { startRouter, registerRoute } from "./router.js";
import { mountNavBar } from "./components/navBar.js";
import { mountAIPanel } from "./components/aiPanel.js";
import { mountLearnPanel } from "./components/learnPanel.js";

console.log("[HSK-REAL-ENTRY-BOOT]", {
  file: "ui/app.js",
  ts: "2026-03-27-real-entry",
});

console.log("[LUMINA-BUILD-MARK]", {
  build: "practice-debug-2026-03-27-a",
  file: "ui/app.js",
});

/* ---------- Global helper: open step modal ---------- */
window.joyOpenStep = function joyOpenStep(step, lessonId, opts = {}) {
  const engine = window.LESSON_ENGINE;
  if (!engine) return console.warn("[joyOpenStep] LESSON_ENGINE missing");
  if (!lessonId) return console.warn("[joyOpenStep] lessonId missing", { step, lessonId });

  const lang =
    opts.lang ||
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr";

  engine.start({
    lessonId,
    lang,
    steps: opts.steps,
    stepKeys: opts.stepKeys,
  });
  if (step) engine.go(step);

  console.log("[joyOpenStep] ok:", { step, lessonId, lang });
};

/* ---------- i18n init ---------- */
i18n.init({
  defaultLang: "kr",
  storageKey: "joy_lang",
  autoApplyRoot: document,
  observe: true
});
i18n.apply(document);
window.i18n = i18n;

/* ---------- Mount once (bridge / step runner) ---------- */
try {
  mountLessonBridge();
  mountLessonStepRunner();
} catch (e) {
  console.error("[app] bridge/stepRunner mount error:", e);
}

/* ===============================
   🧭 Routes (lazy)
================================== */
registerRoute("#home",      () => import("./pages/page.home.js"));
registerRoute("#exam",      () => import("./pages/page.examLearning.js"));
registerRoute("#exam-learning", () => import("./pages/page.examLearning.js"));
registerRoute("#hsk",       () => import("./pages/page.hsk.js"));
registerRoute("#kids",      () => import("./pages/page.kids.js"));
registerRoute("#kids-kids1", () => import("./pages/page.kids1.js"));
registerRoute("#business",  () => import("./pages/page.business.js"));
registerRoute("#stroke",    () => import("./pages/page.stroke.js"));
registerRoute("#dictionary", () => import("./pages/page.dictionary.js"));
registerRoute("#hanja",     () => import("./pages/page.hanja.js"));
registerRoute("#conversation", () => import("./pages/page.speaking.js"));
registerRoute("#speaking",  () => import("./pages/page.speaking.js"));
registerRoute("#travel",    () => import("./pages/page.travel.js"));
registerRoute("#culture",   () => import("./pages/page.culture.js"));
registerRoute("#review",    () => import("./pages/page.review.js"));
registerRoute("#resources", () => import("./pages/page.resources.js"));
registerRoute("#teacher",   () => import("./pages/page.teacher.js"));
registerRoute("#teacher-materials", () => import("./pages/page.teacherMaterials.js"));
registerRoute("#teacher-create-material", () => import("./pages/page.teacherCreateMaterial.js"));
registerRoute("#teacher-courses", () => import("./pages/page.teacherCourses.js"));
registerRoute("#teacher-assets", () => import("./pages/page.teacherAssets.js"));
registerRoute("#teacher-asset-editor", () => import("./pages/page.teacherAssetEditor.js"));
registerRoute("#classroom", () => import("./pages/page.classroom.js"));
registerRoute("#game",      () => import("./pages/page.game.js"));
registerRoute("#my-learning", () => import("./pages/page.my.js"));
registerRoute("#my",        () => import("./pages/page.my.js"));
registerRoute("#my-content", () => import("./pages/page.myLearningContent.js"));
registerRoute("#my-orders", () => import("./pages/page.myOrders.js"));
registerRoute("#catalog", () => import("./pages/page.catalog.js"));
registerRoute("#lumina-teacher-stage0", () => import("./pages/page.luminaTeacherStage0.js"));
registerRoute("#teacher-publishing", () => import("./pages/page.teacherPublishing.js"));
registerRoute("#teacher-review", () => import("./pages/page.teacherReview.js"));
registerRoute("#teacher-listing", () => import("./pages/page.teacherListingDetail.js"));
registerRoute("#auth-login", () => import("./pages/page.authLogin.js"));
registerRoute("#auth-register", () => import("./pages/page.authRegister.js"));
registerRoute("#onboarding-role", () => import("./pages/page.onboardingRole.js"));
registerRoute("#teacher-apply", () => import("./pages/page.teacherApply.js"));
registerRoute("#teacher-status", () => import("./pages/page.teacherStatus.js"));
registerRoute("#login", () => import("./pages/page.authLogin.js"));
registerRoute("#register", () => import("./pages/page.authRegister.js"));
registerRoute("#teacher-profile", () => import("./pages/page.teacherProfile.js"));
registerRoute("#teacher-ai", () => import("./pages/page.teacherAiAssistant.js"));
registerRoute("#teacher-console", () => import("./pages/page.teacherClassroomConsole.js"));

/* ===============================
   🚀 Boot
================================== */
function ensureRoot() {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[app] #app not found. Check index.html has <main id='app'>");
  }
  return root;
}

function showFatal(err) {
  const root = ensureRoot();
  if (!root) return;
  root.innerHTML = `
    <div style="padding:16px; border:1px solid #e2e8f0; background:#fff; border-radius:14px;">
      <b style="display:block; margin-bottom:8px;">페이지 로딩 오류</b>
      <div style="color:#475569; line-height:1.6; font-size:13px;">
        콘솔(Console)에서 에러를 확인해 주세요.<br/>
        <pre style="white-space:pre-wrap; margin:10px 0 0; background:#f8fafc; padding:10px; border-radius:12px; border:1px solid #e2e8f0;">${String(err?.stack || err)}</pre>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[app] DOMContentLoaded");

  // 0) 加载 /lang 语言包
  try {
    await i18n.load();
  } catch (e) {
    console.warn("[app] i18n.load failed:", e?.message);
  }

  try {
    const { hydrateCurrentUserFromSession } = await import("./auth/authService.js");
    await hydrateCurrentUserFromSession();
  } catch (e) {
    console.warn("[app] auth hydrate failed:", e?.message);
  }

  // 1) Nav
  try {
    mountNavBar(document.getElementById("siteNav"));
  } catch (e) {
    console.error("[app] mountNavBar error:", e);
  }

  // 2) Global panels
  try {
    mountAIPanel();
    mountLearnPanel();
  } catch (e) {
    console.error("[app] mount panels error:", e);
  }

// 3) Start router (router will ensure defaultHash + first render)
try {
  console.log("[app] startRouter (boot)");
  startRouter({ defaultHash: "#home", appId: "app", scrollTop: true });
} catch (e) {
  console.error("[app] startRouter error:", e);
  showFatal(e);
}

  try {
    const { runSessionRouteGuards, bindOnboardingHashGuard, attachLuminaAuthDevGlobal } = await import("./auth/authFlow.js");
    bindOnboardingHashGuard();
    requestAnimationFrame(() => runSessionRouteGuards());
    const { shouldEnableLuminaDevUi } = await import("./lumina-commerce/devRuntimeFlags.js");
    if (shouldEnableLuminaDevUi()) {
      const mod = await import("./auth/authService.js");
      const rs = await import("./auth/resolveSessionRoute.js");
      attachLuminaAuthDevGlobal({
        getResolvedSessionLandingHash: rs.getResolvedSessionLandingHash,
        devSetMockTeacherState: mod.devSetMockTeacherState,
        devResetOnboardingForTest: mod.devResetOnboardingForTest,
        setMockTeacherRoleActiveForTest: mod.setMockTeacherRoleActiveForTest,
        /** 说明见 docs/auth-onboarding-teacher-regression-checklist.md */
        __doc: "Lumina auth dev: devSetMockTeacherState('none'|'pending'|'rejected'|'active'), devResetOnboardingForTest()",
      });
    }
  } catch (e) {
    console.warn("[app] session route guards / dev failed:", e?.message);
  }

  // 4) Helpful debug hint
  // If stuck on loading, likely page module export mismatch or wrong file path.

});
