// #teacher-apply 教师申请（轻量）

import { i18n } from "../i18n.js";
import { getCurrentSessionAuthUser, submitTeacherApplication } from "../auth/authService.js";
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

const TYPE_VALUES = ["kids", "hsk", "conversation", "business", "travel", "other"];

export default async function pageTeacherApply(ctxOrRoot) {
  const root =
    ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;

  if (!getCurrentSessionAuthUser()) {
    const { navigateTo } = await import("../router.js");
    navigateTo("#auth-login", { force: true });
    return;
  }

  const checks = TYPE_VALUES.map(
    (v) => `
    <label class="teacher-apply__check">
      <input type="checkbox" name="teachingTypes" value="${escapeHtml(v)}" />
      <span data-i18n="teacherApply.type_${v}">${escapeHtml(tx(`teacherApply.type_${v}`))}</span>
    </label>
  `,
  ).join("");

  root.innerHTML = `
    <div class="wrap auth-page lumina-teacher-apply">
      <section class="card auth-card">
        <h1 class="auth-title">${escapeHtml(tx("teacherApply.title"))}</h1>
        <p class="auth-lead">${escapeHtml(tx("teacherApply.lead"))}</p>
        <p class="lumina-teacher-apply__tip">${escapeHtml(tx("teacherApply.tip_student_ready"))}</p>
        <form class="auth-form" id="teacherApplyForm">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.display_name"))}</span>
            <input name="displayName" type="text" required />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.intro"))}</span>
            <textarea name="intro" class="teacher-profile-textarea" rows="3" required></textarea>
          </label>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.teaching_directions"))}</span>
            <div class="teacher-apply__types">${checks}</div>
          </div>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.experience"))}</span>
            <label class="teacher-apply__radio"><input type="radio" name="experience" value="has_experience" required /> <span data-i18n="teacherApply.exp_yes">${escapeHtml(tx("teacherApply.exp_yes"))}</span></label>
            <label class="teacher-apply__radio"><input type="radio" name="experience" value="no_experience" /> <span data-i18n="teacherApply.exp_no">${escapeHtml(tx("teacherApply.exp_no"))}</span></label>
          </div>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.note"))}</span>
            <textarea name="note" class="teacher-profile-textarea" rows="2" placeholder=""></textarea>
          </label>
          <p class="auth-error" id="teacherApplyErr" hidden></p>
          <button type="submit" class="auth-submit">${escapeHtml(tx("teacherApply.submit"))}</button>
        </form>
        <p class="auth-footer">
          <a href="#my" class="auth-link">${escapeHtml(tx("teacherApply.back_learning"))}</a>
        </p>
      </section>
    </div>
  `;
  i18n.apply?.(root);

  const form = root.querySelector("#teacherApplyForm");
  const errEl = root.querySelector("#teacherApplyErr");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errEl) errEl.hidden = true;
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const types = /** @type {string[]} */ ([]);
    fd.getAll("teachingTypes").forEach((v) => types.push(String(v)));
    if (types.length === 0) {
      if (errEl) {
        errEl.textContent = tx("teacherApply.error_types");
        errEl.hidden = false;
      }
      return;
    }
    const res = await submitTeacherApplication({
      displayName: String(fd.get("displayName") || ""),
      intro: String(fd.get("intro") || ""),
      teachingTypes: types,
      experienceLevel: String(fd.get("experience") || ""),
      note: String(fd.get("note") || ""),
    });
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = tx("auth.error.unknown");
        errEl.hidden = false;
      }
      return;
    }
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher-status", { force: true });
  });
}

export function mount(c) {
  return pageTeacherApply(c);
}
export function render(c) {
  return pageTeacherApply(c);
}
