// #teacher-status 教师申请状态（pending / rejected）

import { i18n } from "../i18n.js";
import {
  getCurrentSessionAuthUser,
  getTeacherNavRoleState,
  setMockTeacherRoleActiveForTest,
  devSetMockTeacherState,
  devResetOnboardingForTest,
} from "../auth/authService.js";
import { findUserById } from "../auth/authStore.js";
import { shouldEnableLuminaDevUi } from "../lumina-commerce/devRuntimeFlags.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";

function tx(k, p) {
  return safeUiText(k, p);
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function pageTeacherStatus(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  if (!getCurrentSessionAuthUser()) {
    const { navigateTo } = await import("../router.js");
    navigateTo("#auth-login", { force: true });
    return;
  }

  const state = getTeacherNavRoleState() ?? "none";
  const dev = await shouldEnableLuminaDevUi();

  if (state === "active") {
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher", { force: true });
    return;
  }

  if (state === "none") {
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher-apply", { force: true });
    return;
  }

  const au0 = getCurrentSessionAuthUser();
  const prof = au0 ? findUserById(au0.id)?.teacherProfile : null;
  const submitted = prof?.submittedAt
    ? escapeHtml(new Date(String(prof.submittedAt)).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }))
    : "";

  const isRejected = state === "rejected";
  const pillKey = isRejected ? "roleStatus.teacher_rejected" : "roleStatus.teacher_pending";
  const titleKey = isRejected ? "teacherStatus.title_rejected" : "teacherStatus.title";
  const leadKey = isRejected ? "teacherStatus.lead_rejected" : "teacherStatus.lead";
  const reapplyBlock = isRejected
    ? `<p class="auth-lead">${escapeHtml(tx("teacherStatus.reapply_lead"))}</p>
       <div class="lumina-teacher-status__actions" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:8px">
         <button type="button" class="auth-submit" id="tsReapplyBtn" data-i18n="teacherStatus.reapply_cta">${escapeHtml(tx("teacherStatus.reapply_cta"))}</button>
       </div>`
    : "";

  const devBlock = dev
    ? `<div class="lumina-teacher-status__dev" data-lumina-dev>
        <p class="auth-label" data-i18n="teacherStatus.dev_title">${escapeHtml(tx("teacherStatus.dev_title"))}</p>
        <div class="lumina-dev-btns">
          <button type="button" class="badge" data-dev="none">teacher: none</button>
          <button type="button" class="badge" data-dev="pending">pending</button>
          <button type="button" class="badge" data-dev="rejected">rejected</button>
          <button type="button" class="badge" data-dev="active">active</button>
        </div>
        <p class="lumina-teacher-status__dev">
          <button type="button" class="badge" id="devOnboardingReset" data-i18n="teacherStatus.dev_reset_onb">${escapeHtml(tx("teacherStatus.dev_reset_onb"))}</button>
        </p>
        <p class="lumina-teacher-status__dev"><button type="button" class="badge" id="devMockTeacherActive">${escapeHtml(
          tx("teacherStatus.dev_mock_active"),
        )}</button></p>
      </div>`
    : "";

  root.innerHTML = `
    <div class="wrap auth-page">
      <section class="card auth-card lumina-teacher-status">
        <p class="role-pill ${isRejected ? "role-pill--rejected" : "role-pill--pending"}" data-i18n="${pillKey}">${escapeHtml(tx(pillKey))}</p>
        <h1 class="auth-title">${escapeHtml(tx(titleKey))}</h1>
        <p class="auth-lead">${escapeHtml(tx(leadKey))}</p>
        <p class="auth-lead">${escapeHtml(tx("teacherStatus.still_learn"))}</p>
        ${submitted ? `<p class="lumina-teacher-status__meta">${escapeHtml(tx("teacherStatus.submitted_at"))} ${submitted}</p>` : ""}
        ${reapplyBlock}
        <div class="lumina-teacher-status__actions" style="margin-top:12px">
          <a class="auth-submit" style="display:inline-block;text-align:center;text-decoration:none; cursor:pointer" href="#my" id="tsBackMy" data-i18n="teacherStatus.back_my">${escapeHtml(
            tx("teacherStatus.back_my"),
          )}</a>
        </div>
        ${devBlock}
      </section>
    </div>
  `;
  i18n.apply?.(root);

  root.querySelector("#tsReapplyBtn")?.addEventListener("click", () => {
    import("../router.js").then((r) => r.navigateTo("#teacher-apply", { force: true }));
  });
  root.querySelector("#tsBackMy")?.addEventListener("click", (e) => {
    e.preventDefault();
    import("../router.js").then((r) => r.navigateTo("#my", { force: true }));
  });
  root.querySelector("#devMockTeacherActive")?.addEventListener("click", async () => {
    const r = await setMockTeacherRoleActiveForTest();
    if (r?.ok) {
      const { navigateTo } = await import("../router.js");
      navigateTo("#teacher", { force: true });
    }
  });
  root.querySelector("#devOnboardingReset")?.addEventListener("click", async () => {
    await devResetOnboardingForTest();
    const { navigateTo } = await import("../router.js");
    navigateTo("#onboarding-role", { force: true });
  });
  root.querySelectorAll(".lumina-dev-btns [data-dev]").forEach((b) => {
    b.addEventListener("click", async () => {
      const s = b.getAttribute("data-dev");
      if (!s) return;
      await devSetMockTeacherState(/** @type {'none'|'pending'|'rejected'|'active'} */ (s));
      const { navigateTo } = await import("../router.js");
      if (s === "active") navigateTo("#teacher", { force: true });
      else navigateTo("#teacher-status", { force: true });
    });
  });
}

export function mount(c) {
  return pageTeacherStatus(c);
}
export function render(c) {
  return pageTeacherStatus(c);
}
