// #teacher-apply 教师申请（轻量）

import { i18n } from "../i18n.js";
import { getCurrentSessionAuthUser, getTeacherNavRoleState, submitTeacherApplication } from "../auth/authService.js";
import { findUserById } from "../auth/authStore.js";
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

  const tState = getTeacherNavRoleState() ?? "none";
  if (tState === "pending") {
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher", { force: true });
    return;
  }
  if (tState === "active") {
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher", { force: true });
    return;
  }
  // none or rejected: show form; rejected 可重填
  const au = getCurrentSessionAuthUser();
  const full = au ? findUserById(au.id) : null;
  const tp = full?.teacherProfile;
  const typesSel = new Set(tp?.teachingTypes || []);
  const exp = String(tp?.experienceLevel || "");
  const checks = TYPE_VALUES.map((v) => {
    const c = typesSel.has(v) ? " checked" : "";
    return `
    <label class="teacher-apply__check">
      <input type="checkbox" name="teachingTypes" value="${escapeHtml(v)}"${c} />
      <span data-i18n="teacherApply.type_${v}">${escapeHtml(tx(`teacherApply.type_${v}`))}</span>
    </label>
  `;
  }).join("");

  const exHas = exp === "has_experience" ? " checked" : "";
  const exNo = exp === "no_experience" ? " checked" : "";

  root.innerHTML = `
    <div class="wrap auth-page lumina-teacher-apply">
      <div class="lumina-teacher-apply__container card auth-card">
        <header class="lumina-teacher-apply__hero">
          <h1 class="lumina-teacher-apply__title auth-title" data-i18n="teacherApply.title">${escapeHtml(tx("teacherApply.title"))}</h1>
          <p class="lumina-teacher-apply__hero-lead" data-i18n="teacherApply.hero_lead">${escapeHtml(tx("teacherApply.hero_lead"))}</p>
          <p class="lumina-teacher-apply__status" data-i18n-aria-label="teacherApply.status_aria" data-i18n="teacherApply.status_line" aria-label="${escapeHtml(tx("teacherApply.status_aria"))}">${escapeHtml(tx("teacherApply.status_line"))}</p>
        </header>

        <aside class="lumina-teacher-apply__info" role="region" data-i18n-aria-label="teacherApply.info_region_aria" aria-label="${escapeHtml(tx("teacherApply.info_region_aria"))}">
          <p class="lumina-teacher-apply__info-line" data-i18n="teacherApply.info_target">${escapeHtml(tx("teacherApply.info_target"))}</p>
          <p class="lumina-teacher-apply__info-line" data-i18n="teacherApply.info_review">${escapeHtml(tx("teacherApply.info_review"))}</p>
          <p class="lumina-teacher-apply__info-line" data-i18n="teacherApply.info_learning">${escapeHtml(tx("teacherApply.info_learning"))}</p>
        </aside>

        <form class="auth-form lumina-teacher-apply__form" id="teacherApplyForm">
          <section class="lumina-teacher-apply__section" aria-labelledby="ta-sec-basic">
            <h2 class="lumina-teacher-apply__section-title" id="ta-sec-basic" data-i18n="teacherApply.section_basic">${escapeHtml(tx("teacherApply.section_basic"))}</h2>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.display_name">${escapeHtml(tx("teacherApply.display_name"))}</span>
              <input name="displayName" type="text" required autocomplete="name" value="${escapeHtml(tp?.displayName || full?.displayName || "")}" />
            </label>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.intro">${escapeHtml(tx("teacherApply.intro"))}</span>
              <textarea name="intro" class="teacher-profile-textarea" rows="4" required>${escapeHtml(tp?.intro || "")}</textarea>
            </label>
          </section>

          <section class="lumina-teacher-apply__section" aria-labelledby="ta-sec-directions">
            <h2 class="lumina-teacher-apply__section-title" id="ta-sec-directions" data-i18n="teacherApply.section_directions">${escapeHtml(tx("teacherApply.section_directions"))}</h2>
            <div class="auth-field lumina-teacher-apply__field--choice">
              <span class="auth-label" id="ta-label-types" data-i18n="teacherApply.teaching_directions">${escapeHtml(tx("teacherApply.teaching_directions"))}</span>
              <div class="teacher-apply__types teacher-apply__types--grid" role="group" aria-labelledby="ta-label-types">${checks}</div>
            </div>
          </section>

          <section class="lumina-teacher-apply__section" aria-labelledby="ta-sec-exp">
            <h2 class="lumina-teacher-apply__section-title" id="ta-sec-exp" data-i18n="teacherApply.section_experience">${escapeHtml(tx("teacherApply.section_experience"))}</h2>
            <div class="auth-field lumina-teacher-apply__field--choice">
              <span class="auth-label" id="ta-label-exp" data-i18n="teacherApply.experience">${escapeHtml(tx("teacherApply.experience"))}</span>
              <div class="teacher-apply__radio-group" role="radiogroup" aria-labelledby="ta-label-exp">
                <label class="teacher-apply__radio">
                  <input type="radio" name="experience" value="has_experience" required${exHas} />
                  <span data-i18n="teacherApply.exp_yes">${escapeHtml(tx("teacherApply.exp_yes"))}</span>
                </label>
                <label class="teacher-apply__radio">
                  <input type="radio" name="experience" value="no_experience"${exNo} />
                  <span data-i18n="teacherApply.exp_no">${escapeHtml(tx("teacherApply.exp_no"))}</span>
                </label>
              </div>
            </div>
          </section>

          <section class="lumina-teacher-apply__section" aria-labelledby="ta-sec-note">
            <h2 class="lumina-teacher-apply__section-title" id="ta-sec-note" data-i18n="teacherApply.section_note">${escapeHtml(tx("teacherApply.section_note"))}</h2>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.note">${escapeHtml(tx("teacherApply.note"))}</span>
              <textarea name="note" class="teacher-profile-textarea lumina-teacher-apply__note" rows="3">${escapeHtml(tp?.note != null ? String(tp.note) : "")}</textarea>
            </label>
          </section>

          <div class="lumina-teacher-apply__actions">
            <p class="auth-error" id="teacherApplyErr" hidden></p>
            <button type="submit" class="auth-submit lumina-teacher-apply__submit">${escapeHtml(
              tState === "rejected" ? tx("teacherApply.resubmit") : tx("teacherApply.submit"),
            )}</button>
          </div>
        </form>

        <p class="auth-footer lumina-teacher-apply__footer">
          <a href="#my-learning" class="auth-link" id="taBackMy" data-i18n="teacherApply.back_learning">${escapeHtml(tx("teacherApply.back_learning"))}</a>
        </p>
      </div>
    </div>
  `;
  i18n.apply?.(root);
  const back = root.querySelector("#taBackMy");
  back?.addEventListener("click", (e) => {
    e.preventDefault();
    import("../router.js").then((r) => r.navigateTo("#my-learning", { force: true }));
  });

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
