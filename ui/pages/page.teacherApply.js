// #teacher-apply 教师申请（轻量，Round 2：基础资料 + 身份说明 + 可选资质）

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

/**
 * 将新表单字段写回既有的 teacherProfile 结构（不改 auth 层接口）。
 * intro：结构化基本资料行；note：身份确认 + 可选资质说明
 */
function buildProfileIntro(/** @type {FormData} */ fd) {
  const g = String(fd.get("gender") || "");
  const gmap = {
    m: "teacherApply.gender_m",
    f: "teacherApply.gender_f",
    o: "teacherApply.gender_o",
    p: "teacherApply.gender_pns",
  };
  const gKey = g === "m" || g === "f" || g === "o" || g === "p" ? g : "o";
  const gLabel = tx(gmap[gKey]);
  const age = String(fd.get("age") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  return [`${tx("teacherApply.pack_gender")}: ${gLabel}`, `${tx("teacherApply.pack_age")}: ${age}`, `${tx("teacherApply.pack_phone")}: ${phone}`].join(
    "\n",
  );
}

function buildProfileNote(/** @type {FormData} */ fd) {
  const cred = String(fd.get("credentials") || "").trim();
  const head = String(tx("teacherApply.note_identity_line") || "").trim();
  if (!cred) return head;
  return `${head}\n\n${cred}`;
}

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

  const au = getCurrentSessionAuthUser();
  const full = au ? findUserById(au.id) : null;
  const tp = full?.teacherProfile;
  const accountEmail = String(au?.email != null && au.email !== "" ? au.email : full?.email != null ? full.email : "").trim();
  const showEmail = accountEmail || "";
  const realNameValue = String(tp?.displayName || full?.displayName || "").trim();

  root.innerHTML = `
    <div class="wrap auth-page lumina-teacher-apply lumina-teacher-apply--r2">
      <section class="card auth-card">
        <h1 class="auth-title" data-i18n="teacherApply.title">${escapeHtml(tx("teacherApply.title"))}</h1>
        <p class="auth-lead" data-i18n="teacherApply.lead">${escapeHtml(tx("teacherApply.lead"))}</p>
        <form class="auth-form" id="teacherApplyForm" novalidate>
          <div class="teacher-apply__section">
            <h2 class="teacher-apply__h2" data-i18n="teacherApply.section_basic">${escapeHtml(tx("teacherApply.section_basic"))}</h2>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.real_name">${escapeHtml(tx("teacherApply.real_name"))}</span>
              <input name="realName" type="text" required autocomplete="name" value="${escapeHtml(realNameValue)}" maxlength="80" />
            </label>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_gender">${escapeHtml(tx("teacherApply.field_gender"))}</span>
              <select name="gender" required>
                <option value="" data-i18n="teacherApply.gender_ph">${escapeHtml(tx("teacherApply.gender_ph"))}</option>
                <option value="m" data-i18n="teacherApply.gender_m">${escapeHtml(tx("teacherApply.gender_m"))}</option>
                <option value="f" data-i18n="teacherApply.gender_f">${escapeHtml(tx("teacherApply.gender_f"))}</option>
                <option value="o" data-i18n="teacherApply.gender_o">${escapeHtml(tx("teacherApply.gender_o"))}</option>
                <option value="p" data-i18n="teacherApply.gender_pns">${escapeHtml(tx("teacherApply.gender_pns"))}</option>
              </select>
            </label>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_age">${escapeHtml(tx("teacherApply.field_age"))}</span>
              <input name="age" type="number" inputmode="numeric" min="1" max="120" required step="1" />
            </label>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_phone">${escapeHtml(tx("teacherApply.field_phone"))}</span>
              <input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="32" />
            </label>
            <div class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_email">${escapeHtml(tx("teacherApply.field_email"))}</span>
              <input
                class="teacher-apply__input-readonly"
                type="email"
                name="emailReadonly"
                value="${escapeHtml(showEmail)}"
                readonly
                aria-readonly="true"
              />
              <p class="teacher-apply__field-hint">${escapeHtml(showEmail ? tx("teacherApply.email_hint") : tx("teacherApply.email_empty"))}</p>
            </div>
          </div>

          <div class="teacher-apply__section">
            <h2 class="teacher-apply__h2" data-i18n="teacherApply.section_identity">${escapeHtml(tx("teacherApply.section_identity"))}</h2>
            <div class="teacher-apply__static" role="region" data-i18n-aria-label="teacherApply.section_identity">
              <p class="teacher-apply__static-p" data-i18n="teacherApply.identity_body">${escapeHtml(tx("teacherApply.identity_body"))}</p>
            </div>
            <label class="auth-field teacher-apply__ack">
              <span class="teacher-apply__ack-row">
                <input type="checkbox" name="identityAck" value="1" required />
                <span data-i18n="teacherApply.identity_ack">${escapeHtml(tx("teacherApply.identity_ack"))}</span>
              </span>
            </label>
          </div>

          <div class="teacher-apply__section">
            <h2 class="teacher-apply__h2" data-i18n="teacherApply.section_credentials">${escapeHtml(tx("teacherApply.section_credentials"))}</h2>
            <p class="teacher-apply__cred-lead" data-i18n="teacherApply.cred_intro">${escapeHtml(tx("teacherApply.cred_intro"))}</p>
            <ul class="teacher-apply__cred-list">
              <li data-i18n="teacherApply.cred_b1">${escapeHtml(tx("teacherApply.cred_b1"))}</li>
              <li data-i18n="teacherApply.cred_b2">${escapeHtml(tx("teacherApply.cred_b2"))}</li>
              <li data-i18n="teacherApply.cred_b3">${escapeHtml(tx("teacherApply.cred_b3"))}</li>
              <li data-i18n="teacherApply.cred_b4">${escapeHtml(tx("teacherApply.cred_b4"))}</li>
            </ul>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.credentials_label">${escapeHtml(tx("teacherApply.credentials_label"))}</span>
              <textarea
                name="credentials"
                class="teacher-profile-textarea"
                rows="4"
                data-i18n-placeholder="teacherApply.credentials_placeholder"
                placeholder="${escapeHtml(tx("teacherApply.credentials_placeholder"))}"
              >${escapeHtml(tp?.note != null ? String(tp.note) : "")}</textarea>
            </label>
          </div>

          <p class="auth-error" id="teacherApplyErr" hidden></p>
          <button type="submit" class="auth-submit" data-teacher-apply-submit="1">
            ${escapeHtml(tState === "rejected" ? tx("teacherApply.resubmit") : tx("teacherApply.submit"))}
          </button>
        </form>
        <p class="auth-footer">
          <a href="#my-learning" class="auth-link" id="taBackMy" data-i18n="teacherApply.back_learning">${escapeHtml(tx("teacherApply.back_learning"))}</a>
        </p>
      </section>
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
    if (!fd.get("identityAck")) {
      if (errEl) {
        errEl.textContent = tx("teacherApply.error_ack");
        errEl.hidden = false;
      }
      return;
    }
    const realName = String(fd.get("realName") || "").trim();
    if (!realName) {
      if (errEl) {
        errEl.textContent = tx("teacherApply.error_name");
        errEl.hidden = false;
      }
      return;
    }
    const ageRaw = String(fd.get("age") || "").trim();
    const ageN = parseInt(ageRaw, 10);
    if (!ageRaw || Number.isNaN(ageN) || ageN < 1 || ageN > 120) {
      if (errEl) {
        errEl.textContent = tx("teacherApply.error_age");
        errEl.hidden = false;
      }
      return;
    }
    const phone = String(fd.get("phone") || "").trim();
    if (phone.length < 3) {
      if (errEl) {
        errEl.textContent = tx("teacherApply.error_phone");
        errEl.hidden = false;
      }
      return;
    }
    const res = await submitTeacherApplication({
      displayName: realName,
      intro: buildProfileIntro(fd),
      teachingTypes: ["other"],
      experienceLevel: "no_experience",
      note: buildProfileNote(fd),
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
