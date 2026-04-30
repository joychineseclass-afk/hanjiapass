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

console.log("[app] build navbar-logout-doc-2026-04-30 loaded");

/** document 级登出兜底：先于 mountNavBar，避免 ESM 子模块缓存导致 navBar 未更新时无监听 */
if (!window.__LUMINA_LOGOUT_DOC_BOUND__) {
  window.__LUMINA_LOGOUT_DOC_BOUND__ = true;
  document.addEventListener(
    "click",
    (ev) => {
      const raw = ev.target;
      const btn =
        raw && typeof raw.closest === "function" ? raw.closest("[data-joy-auth-logout]") : null;
      if (!btn || !(btn instanceof HTMLElement)) return;
      console.log("[Lumina Logout doc] clicked");
      ev.preventDefault();
      void (async () => {
        const mod = await import("./auth/authService.js");
        const store = await import("./auth/authStore.js");
        console.log("[Lumina Logout doc] before logoutUser");
        try {
          await mod.logoutUser();
        } catch (e) {
          console.warn("[Lumina Logout doc] logoutUser threw:", e?.message || e);
        }
        console.log("[Lumina Logout doc] after logoutUser");
        try {
          console.log("[Lumina Logout doc] auth session after logout", {
            loadSession: store.loadSession(),
            getCurrentSessionAuthUser: mod.getCurrentSessionAuthUser(),
          });
        } catch (e) {
          console.warn("[Lumina Logout doc] session snapshot failed:", e?.message || e);
        }
        console.log("[Lumina Logout doc] before navigateTo");
        try {
          const r = await import("./router.js");
          if (typeof r.navigateTo === "function") {
            r.navigateTo("#auth-login", { force: true });
            console.log("[Lumina Logout doc] after navigateTo (ok)");
          } else {
            console.log("[Lumina Logout doc] after navigateTo (skip: no fn)");
          }
        } catch (e) {
          console.warn("[Lumina Logout doc] navigateTo failed:", e?.message || e);
        }
        try {
          location.replace("/index.html#auth-login");
          console.log("[Lumina Logout doc] after location.replace requested");
        } catch (e) {
          console.warn("[Lumina Logout doc] location.replace failed:", e?.message || e);
        }
      })();
    },
    true,
  );
  console.log("[app] document logout handler bound");
}

/**
 * 分支 3：若点了 로그아웃 却看不到 [Lumina Logout doc] clicked，在控制台调用：
 * __luminaDebugLogoutFromLastClick() —— 须先点此函数定义后再点按钮；或
 * __luminaDebugLogoutAt(clientX, clientY) —— 传入鼠标事件 e.clientX/Y。
 */
window.__luminaDebugLogoutAt = function __luminaDebugLogoutAt(clientX, clientY) {
  const top = document.elementFromPoint(clientX, clientY);
  const logoutBtn = document.querySelector("[data-joy-auth-logout]");
  const path = [];
  for (let el = top; el && el instanceof HTMLElement && path.length < 12; el = el.parentElement) {
    const cs = getComputedStyle(el);
    path.push({
      tag: el.tagName,
      id: el.id || undefined,
      class: (el.className && String(el.className).slice(0, 80)) || undefined,
      pointerEvents: cs.pointerEvents,
      position: cs.position,
      zIndex: cs.zIndex,
    });
  }
  return {
    elementFromPoint: top,
    logoutButtonExists: Boolean(logoutBtn),
    logoutButtonMatchesFromPoint: Boolean(top && logoutBtn && (top === logoutBtn || logoutBtn.contains(top))),
    chainFromPoint: path,
  };
};
window.__luminaDebugLogoutFromLastClick = function __luminaDebugLogoutFromLastClick() {
  const last = window.__LUMINA_LAST_POINTER__;
  if (!last || typeof last.clientX !== "number") {
    console.warn("[Lumina debug] 无记录：请先在控制台执行 document.addEventListener('click',e=>{window.__LUMINA_LAST_POINTER__={clientX:e.clientX,clientY:e.clientY};},true); 再点 로그아웃");
    return null;
  }
  return window.__luminaDebugLogoutAt(last.clientX, last.clientY);
};
document.addEventListener(
  "click",
  (e) => {
    window.__LUMINA_LAST_POINTER__ = { clientX: e.clientX, clientY: e.clientY };
  },
  true,
);

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

const STARTUP_HYDRATE_BUDGET_MS = 2500;

/**
 * P0：首屏最多等待该时间即认为「不阻塞」；会话恢复仍在后台继续。
 * P2：在 startRouter 之后执行；结束后再次跑 guards，避免 Supabase 慢时误把已登录用户挡去登录页。
 */
async function runStartupHydrateWithBudget() {
  const { hydrateCurrentUserFromSession } = await import("./auth/authService.js");
  const work = hydrateCurrentUserFromSession();
  const settled = work.then(
    () => ({ error: null }),
    (error) => ({ error }),
  );
  let tid = 0;
  const budgetP = new Promise((resolve) => {
    tid = setTimeout(() => resolve("timeout"), STARTUP_HYDRATE_BUDGET_MS);
  });
  let raceResult;
  try {
    raceResult = await Promise.race([settled.then(() => "done"), budgetP]);
  } finally {
    clearTimeout(tid);
  }
  if (raceResult === "timeout") {
    console.warn(
      `[app] startup hydrate: still pending after ${STARTUP_HYDRATE_BUDGET_MS}ms (session restore continues in background)`,
    );
  }
  const outcome = await settled;
  if (outcome.error) {
    console.warn("[app] hydrate error:", outcome.error?.message || outcome.error);
  }
  try {
    const { runSessionRouteGuards } = await import("./auth/authFlow.js");
    requestAnimationFrame(() => runSessionRouteGuards());
  } catch (e) {
    console.warn("[app] post-hydrate route guards failed:", e?.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[app] DOMContentLoaded");

  // 0) 加载 /lang 语言包
  try {
    await i18n.load();
  } catch (e) {
    console.warn("[app] i18n.load failed:", e?.message);
  }

  // 1) Nav（先于 hydrate，避免 Supabase 阻塞顶栏首屏）
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
    // Hydrate 前不跑 guards（避免 Supabase _cachedUser 未就绪误判）；首屏守卫在 runStartupHydrateWithBudget 完成后执行。
    const { bindOnboardingHashGuard, attachLuminaAuthDevGlobal } = await import("./auth/authFlow.js");
    bindOnboardingHashGuard();
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

  // 4) 后台恢复会话（不阻塞首屏路由）；P0 预算内未结束则 warn，仍等待完成以同步状态
  void runStartupHydrateWithBudget();

  // 5) Helpful debug hint
  // If stuck on loading, likely page module export mismatch or wrong file path.

});
