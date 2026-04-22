// #teacher-profile 老师档案编辑（最小字段 + 提交审核）

import { i18n } from "../i18n.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { getMergedProfileForUser } from "../lumina-commerce/teacherProfileStore.js";
import { saveTeacherProfileFields, submitTeacherProfileForReview } from "../lumina-commerce/teacherProfileService.js";
import { USER_ROLE } from "../lumina-commerce/enums.js";

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

export default async function pageTeacherProfile(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  const u = getCurrentUser();
  if (u.isGuest || u.id === "u_guest") {
    root.innerHTML = `<div class="wrap teacher-profile-page"><section class="card teacher-gate"><p>${escapeHtml(
      tx("auth.must_login_profile"),
    )}</p><p><a class="auth-link" href="#login?next=teacher-profile">${escapeHtml(tx("auth.go_login"))}</a></p></section></div>`;
    i18n.apply?.(root);
    return;
  }
  if (!u.roles?.includes(USER_ROLE.teacher) || !u.teacherProfileId) {
    root.innerHTML = `<div class="wrap teacher-profile-page"><section class="card teacher-gate"><p>${escapeHtml(
      tx("teacher.profile.apply_first"),
    )}</p><p><a class="auth-link" href="#teacher">${escapeHtml(tx("teacher.nav.back_mine_workbench"))}</a></p></section></div>`;
    i18n.apply?.(root);
    return;
  }

  const { profile, commerceRow } = await getMergedProfileForUser(u);
  if (!profile || !commerceRow) {
    root.innerHTML = `<div class="wrap"><p>${escapeHtml(tx("common.loading"))}</p></div>`;
    return;
  }

  const tagsStr = (profile.expertise_tags || []).join(", ");
  const statusKey = profile.workbench_status;
  const pending = statusKey === "pending_review" || String(commerceRow.verification_status) === "pending";
  const approved = statusKey === "approved" || String(commerceRow.verification_status) === "approved";
  const readOnly = pending;
  const submitDisabled = pending || approved;
  const statusLabel = escapeHtml(tx(`teacher.wbstate.${statusKey}`));

  root.innerHTML = `
    <div class="wrap teacher-profile-page">
      <section class="card teacher-profile-hero">
        <h1 class="teacher-profile-title">${escapeHtml(tx("teacher.profile.page_title"))}</h1>
        <p class="teacher-profile-status">${escapeHtml(tx("teacher.profile.status_label"))}: <strong>${statusLabel}</strong></p>
      </section>
      ${
        readOnly
          ? `<p class="teacher-profile-locked card">${escapeHtml(tx("teacher.profile.pending_readonly"))} <a href="#teacher">${escapeHtml(
              tx("teacher.profile.to_workbench"),
            )}</a></p>`
          : ""
      }
      <section class="card teacher-profile-form-card">
        <form id="teacherProfileForm" class="teacher-profile-form${readOnly ? " teacher-profile-form--readonly" : ""}">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.display_name"))}</span>
            <input name="display_name" type="text" required value="${escapeHtml(commerceRow.display_name || "")}" ${readOnly ? "disabled" : ""} />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.bio"))}</span>
            <textarea name="bio" rows="4" class="teacher-profile-textarea" ${readOnly ? "disabled" : ""}>${escapeHtml(
              commerceRow.bio || "",
            )}</textarea>
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.expertise_tags"))}</span>
            <input name="expertise_tags" type="text" value="${escapeHtml(tagsStr)}" placeholder="${escapeHtml(
              tx("teacher.profile.expertise_placeholder"),
            )}" ${readOnly ? "disabled" : ""} />
          </label>
          <div class="teacher-profile-actions">
            <button type="button" class="auth-submit teacher-profile-save" id="tpSave" ${readOnly ? "disabled" : ""}>${escapeHtml(
              tx("common.save"),
            )}</button>
            <button type="button" class="auth-submit auth-submit--secondary" id="tpSubmit" ${submitDisabled ? "hidden" : ""}>${escapeHtml(
              tx("teacher.profile.submit_review"),
            )}</button>
          </div>
          <p class="auth-toast" id="tpToast" hidden></p>
        </form>
      </section>
      <p class="teacher-profile-back"><a href="#teacher">${escapeHtml(tx("teacher.nav.back_mine_workbench"))}</a></p>
    </div>
  `;
  i18n.apply?.(root);

  const toast = root.querySelector("#tpToast");
  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
  };

  root.querySelector("#tpSave")?.addEventListener("click", async () => {
    if (readOnly) return;
    const form = root.querySelector("#teacherProfileForm");
    if (!form) return;
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const r = await saveTeacherProfileFields(
      u.teacherProfileId,
      {
        display_name: String(fd.get("display_name") || ""),
        bio: String(fd.get("bio") || ""),
        expertiseTagsStr: String(fd.get("expertise_tags") || ""),
      },
      u.id,
    );
    showToast(r.ok ? tx("auth.save_ok") : tx("auth.error.unknown"));
  });

  root.querySelector("#tpSubmit")?.addEventListener("click", async () => {
    if (readOnly || approved || !u.teacherProfileId) return;
    const r = await submitTeacherProfileForReview(u.teacherProfileId, u.id);
    showToast(
      r.ok
        ? tx("teacher.profile.submit_ok")
        : tx("auth.error.unknown"),
    );
    if (r.ok) {
      const { navigateTo } = await import("../router.js");
      navigateTo("#teacher", { force: true });
    }
  });
}

export function mount(c) {
  return pageTeacherProfile(c);
}
export function render(c) {
  return pageTeacherProfile(c);
}
