// #teacher-status 教师申请审核中

import { i18n } from "../i18n.js";
import { getCurrentSessionAuthUser, getTeacherNavRoleState, setMockTeacherRoleActiveForTest } from "../auth/authService.js";
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

  const au0 = getCurrentSessionAuthUser();
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

  const prof = au0 ? findUserById(au0.id)?.teacherProfile : null;
  const submitted = prof?.submittedAt
    ? escapeHtml(new Date(String(prof.submittedAt)).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }))
    : "";

  const isRejected = state === "rejected";
  const pillKey = isRejected ? "roleStatus.teacher_rejected" : "roleStatus.teacher_pending";
  const titleKey = isRejected ? "teacherStatus.title_rejected" : "teacherStatus.title";
  const leadKey = isRejected ? "teacherStatus.lead_rejected" : "teacherStatus.lead";

  root.innerHTML = `
    <div class="wrap auth-page">
      <section class="card auth-card lumina-teacher-status">
        <p class="role-pill ${isRejected ? "role-pill--rejected" : "role-pill--pending"}" data-i18n="${pillKey}">${escapeHtml(tx(pillKey))}</p>
        <h1 class="auth-title">${escapeHtml(tx(titleKey))}</h1>
        <p class="auth-lead">${escapeHtml(tx(leadKey))}</p>
        <p class="auth-lead">${escapeHtml(tx("teacherStatus.still_learn"))}</p>
        ${submitted ? `<p class="lumina-teacher-status__meta">${escapeHtml(tx("teacherStatus.submitted_at"))} ${submitted}</p>` : ""}
        <div class="lumina-teacher-status__actions">
          <a class="auth-submit" style="display:inline-block;text-align:center;text-decoration:none;" href="#my" data-i18n="teacherStatus.back_my">${escapeHtml(
            tx("teacherStatus.back_my"),
          )}</a>
        </div>
        ${
          dev
            ? `<p class="lumina-teacher-status__dev"><button type="button" class="badge" id="devMockTeacherActive">${escapeHtml(
                tx("teacherStatus.dev_mock_active"),
              )}</button></p>`
            : ""
        }
      </section>
    </div>
  `;
  i18n.apply?.(root);

  root.querySelector("#devMockTeacherActive")?.addEventListener("click", async () => {
    const r = await setMockTeacherRoleActiveForTest();
    if (r?.ok) {
      const { navigateTo } = await import("../router.js");
      navigateTo("#teacher", { force: true });
    }
  });
}

export function mount(c) {
  return pageTeacherStatus(c);
}
export function render(c) {
  return pageTeacherStatus(c);
}
