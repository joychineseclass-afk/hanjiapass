// #teacher-profile 老师档案：扩展资料 + 资质占位 + 提交审核

import { i18n } from "../i18n.js";
import {
  normalizeBirthdayIso,
  normalizeName,
  normalizePhoneDigits,
  ageFromBirthdayIso,
} from "../auth/teacherRegistrationUtils.js";
import { updateTeacherRegistrationSnapshot } from "../auth/authService.js";
import { findUserById } from "../auth/authStore.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { getMergedProfileForUser } from "../lumina-commerce/teacherProfileStore.js";
import {
  saveTeacherProfileFields,
  submitTeacherProfileForReview,
  addTeacherCredentialPlaceholder,
  removeTeacherCredentialItem,
} from "../lumina-commerce/teacherProfileService.js";
import { USER_ROLE, VERIFICATION_STATUS } from "../lumina-commerce/enums.js";
import { currentUserCanAccessTeacherReviewConsoleSync, renderTeacherAdminShell } from "./teacherPathNav.js";

const TARGET_OPTS = /** @type {const} */ (["kids", "hsk", "adults", "business"]);
const LANG_OPTS = /** @type {const} */ (["zh", "kr", "en", "jp"]);
const KIND_OPTS = /** @type {const} */ (["language_certificate", "teaching_certificate", "identity", "other"]);

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
 * @param {Record<string, unknown>|null|undefined} snap
 */
function registrationCredentialsHtml(snap) {
  const list =
    snap && typeof snap === "object" && Array.isArray(snap.credentials)
      ? /** @type {{ labelKey?: string; fileName?: string }[]} */ (snap.credentials)
      : [];
  if (list.length === 0)
    return `<p class="teacher-reg-muted">${escapeHtml(tx("teacher.profile.registration_cred_empty"))}</p>`;
  return `<ul class="teacher-reg-cred-ul">${list
    .map((c) => {
      const k = String(c.labelKey || "");
      const lab = k && tx(k) !== k ? tx(k) : k || "—";
      const fn =
        c.fileName && String(c.fileName).trim() !== ""
          ? escapeHtml(String(c.fileName))
          : `<span class="teacher-reg-muted-inline">${escapeHtml(tx("teacher.profile.registration_cred_no_file"))}</span>`;
      return `<li><span class="teacher-reg-cred-label">${escapeHtml(lab)}</span> · ${escapeHtml(tx("teacher.profile.registration_cred_file"))} ${fn}</li>`;
    })
    .join("")}</ul>`;
}

/** @param {string} [iso] */
function fmtTime(iso) {
  if (!iso) return "—";
  const s = String(iso);
  return s.includes("T") ? s.replace("T", " ").slice(0, 19) : s.slice(0, 19);
}

/**
 * @param {string[]} selected
 * @param {string} name
 * @param {readonly string[]} options
 * @param {(c: string) => string} labelFn
 * @param {boolean} [disabled]
 */
function checkboxesRow(selected, name, options, labelFn, disabled) {
  const d = disabled ? "disabled" : "";
  return options
    .map((c) => {
      const on = selected.includes(c) ? "checked" : "";
      return `<label class="teacher-profile-check"><input type="checkbox" name="${name}" value="${c}" ${on} ${d} />${escapeHtml(labelFn(c))}</label>`;
    })
    .join(" ");
}

/**
 * @param {import('../lumina-commerce/teacherProfileStore.js').TeacherCredentialItemV1} c
 * @param {boolean} readOnly
 * @param {(k: string) => string} label
 */
function credCardHtml(c, readOnly, label) {
  const kindKey = `teacher.profile.cred_kind.${c.kind || "other"}`;
  return `<li class="teacher-credential-card" data-cred-id="${escapeHtml(c.id)}">
    <div class="teacher-credential-card-main">
      <span class="teacher-credential-title">${escapeHtml(c.title || "")}</span>
      <span class="teacher-credential-meta">${escapeHtml(label(kindKey) !== kindKey ? label(kindKey) : String(c.kind))}</span>
      <span class="teacher-credential-file">${escapeHtml(c.file_name || "—")}</span>
      <span class="teacher-credential-time">${escapeHtml(label("teacher.profile.uploaded_at"))}: ${escapeHtml(fmtTime(c.uploaded_at))}</span>
    </div>
    ${
      readOnly
        ? ""
        : `<div class="teacher-credential-card-actions">
      <button type="button" class="teacher-cred-remove" data-remove-cred="${escapeHtml(c.id)}">${escapeHtml(label("common.delete"))}</button>
    </div>`
    }
  </li>`;
}

/**
 * @param { HTMLElement } root
 */
async function reloadPage(root) {
  const app = document.getElementById("app") || root;
  const mod = await import("./page.teacherProfile.js");
  await mod.default({ root: app, app });
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

  const { profile, commerceRow } = await getMergedProfileForUser();
  if (!profile || !commerceRow) {
    root.innerHTML = `<div class="wrap"><p>${escapeHtml(tx("common.loading"))}</p></div>`;
    return;
  }

  const tagsStr = (profile.expertise_tags || []).join(", ");
  const statusKey = profile.workbench_status;
  const v = String(commerceRow.verification_status);
  const pending = v === VERIFICATION_STATUS.pending;
  const approved = v === VERIFICATION_STATUS.approved;
  const rejected = v === VERIFICATION_STATUS.rejected;
  const readOnly = pending;
  const showSubmit = !pending && !approved;
  const submitLabelKey = rejected ? "teacher.profile.resubmit_review" : "teacher.profile.submit_review";
  const statusLabel = escapeHtml(tx(`teacher.wbstate.${statusKey}`));

  const tLabel = (k) => (tx(k) !== k ? tx(k) : k);
  const showReviewConsole = currentUserCanAccessTeacherReviewConsoleSync();
  const targets = Array.isArray(profile.teaching_targets) ? profile.teaching_targets : [];
  const langs = Array.isArray(profile.teaching_languages) ? profile.teaching_languages : [];
  const creds = Array.isArray(profile.credential_items) ? profile.credential_items : [];
  const credsHtml = creds.length
    ? `<ul class="teacher-credential-list">${creds.map((c) => credCardHtml(c, readOnly, tLabel)).join("")}</ul>`
    : `<p class="teacher-credential-empty">${escapeHtml(tx("teacher.profile.credential_empty"))}</p>`;

  const authFull = findUserById(u.id);
  const tpAuth = authFull?.teacherProfile;
  /** @type {Record<string, unknown>|null} */
  const regSnap =
    tpAuth?.registration_snapshot && typeof tpAuth.registration_snapshot === "object"
      ? /** @type {Record<string, unknown>} */ (tpAuth.registration_snapshot)
      : null;
  const regLegal = regSnap?.legal_name != null ? String(regSnap.legal_name).trim() : "";
  const regGender = regSnap?.gender === "m" || regSnap?.gender === "f" ? String(regSnap.gender) : "";
  const regBirth = regSnap?.birthday_iso != null ? String(regSnap.birthday_iso).trim() : "";
  const regPhone = regSnap?.phone_digits != null ? String(regSnap.phone_digits).replace(/\D/g, "") : "";
  const regAge = regBirth ? ageFromBirthdayIso(regBirth) : null;
  const hasStructuredReg = !!(regSnap && (regLegal !== "" || regBirth !== "" || regPhone !== ""));
  const legacyIntro = tpAuth?.intro ? String(tpAuth.intro) : "";
  const legacyNote = tpAuth?.note != null ? String(tpAuth.note) : "";

  const regSnapshotCard = hasStructuredReg
    ? `<section class="card teacher-reg-card" data-teacher-reg="1">
        <h2 class="teacher-profile-section-title">${escapeHtml(tx("teacher.profile.section_registration"))}</h2>
        <p class="teacher-reg-lead">${escapeHtml(tx("teacher.profile.registration_lead"))}</p>
        <div class="teacher-reg-grid">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.registration_legal_name"))}</span>
            <input id="tpRegLegalName" type="text" autocomplete="name" maxlength="80" value="${escapeHtml(regLegal)}" disabled />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.field_gender"))}</span>
            <select id="tpRegGender" disabled>
              <option value="" ${regGender === "" ? "selected" : ""}>${escapeHtml(tx("teacherApply.gender_ph"))}</option>
              <option value="m" ${regGender === "m" ? "selected" : ""}>${escapeHtml(tx("teacherApply.gender_m"))}</option>
              <option value="f" ${regGender === "f" ? "selected" : ""}>${escapeHtml(tx("teacherApply.gender_f"))}</option>
            </select>
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.registration_birthday"))}</span>
            <input id="tpRegBirthday" type="date" autocomplete="bday" value="${escapeHtml(regBirth)}" disabled />
          </label>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.registration_age"))}</span>
            <p id="tpRegAgeLine" class="teacher-reg-age">${regAge != null ? escapeHtml(tx("teacher.profile.registration_age_line", { n: regAge })) : "—"}</p>
          </div>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.registration_phone"))}</span>
            <input id="tpRegPhoneDigits" type="tel" inputmode="tel" value="${escapeHtml(regPhone)}" maxlength="22" disabled />
          </label>
        </div>
        <div class="teacher-reg-cred-box">
          <h3 class="teacher-reg-subtitle">${escapeHtml(tx("teacher.profile.registration_credentials"))}</h3>
          ${registrationCredentialsHtml(regSnap)}
        </div>
        <p class="teacher-reg-hint">${escapeHtml(tx("teacher.profile.registration_unlock_hint"))}</p>
        <button type="button" id="tpRegGate" class="auth-submit auth-submit--secondary">${escapeHtml(tx("teacher.profile.reg_verify_start"))}</button>
        <div id="tpRegOtpWrap" class="teacher-reg-otp" hidden>
          <p class="teacher-reg-mini">${escapeHtml(tx("teacher.profile.registration_phone_gate"))}</p>
          <div class="teacher-apply__phone-send-row teacher-reg-otp-row">
            <button type="button" class="auth-submit auth-submit--secondary" id="tpRegSendSms">${escapeHtml(tx("teacher.profile.reg_send_sms"))}</button>
          </div>
          <p class="teacher-apply__otp-banner" id="tpRegOtpBanner" hidden></p>
          <div class="teacher-apply__phone-send-row">
            <input type="text" id="tpRegOtpInput" maxlength="8" autocomplete="one-time-code" placeholder="${escapeHtml(tx("teacher.profile.reg_sms_placeholder"))}" />
            <button type="button" class="auth-submit auth-submit--secondary" id="tpRegVerifySms">${escapeHtml(tx("teacher.profile.reg_verify"))}</button>
          </div>
        </div>
        <p class="teacher-reg-ok" id="tpRegOkLine" role="status" hidden></p>
        <div class="teacher-reg-actions-row">
          <button type="button" class="auth-submit auth-submit--secondary" id="tpRegSaveSnap" disabled>${escapeHtml(tx("teacher.profile.reg_save"))}</button>
        </div>
        <p class="auth-error" id="tpRegErr" hidden></p>
      </section>`
    : `<section class="card teacher-reg-card teacher-reg-card--legacy">
        <h2 class="teacher-profile-section-title">${escapeHtml(tx("teacher.profile.section_registration"))}</h2>
        <p class="teacher-reg-muted">${escapeHtml(tx("teacher.profile.registration_no_snapshot_lead"))}</p>
        ${legacyIntro.trim() !== "" ? `<pre class="teacher-reg-intro-pre">${escapeHtml(legacyIntro)}</pre>` : ""}
        ${legacyNote.trim() !== "" && legacyNote !== legacyIntro ? `<pre class="teacher-reg-intro-pre">${escapeHtml(legacyNote)}</pre>` : ""}
      </section>`;

  const main = `
      <section class="card teacher-profile-hero">
        <h1 class="teacher-profile-title">${escapeHtml(tx("teacher.profile.page_title"))}</h1>
        <p class="teacher-profile-status">${escapeHtml(tx("teacher.profile.status_label"))}: <strong>${statusLabel}</strong></p>
        ${profile.submitted_at ? `<p class="teacher-profile-meta-line">${escapeHtml(tx("teacher.profile.submitted_at"))}: ${escapeHtml(fmtTime(profile.submitted_at))}</p>` : ""}
        ${profile.reviewed_at && (approved || rejected) ? `<p class="teacher-profile-meta-line">${escapeHtml(tx("teacher.profile.reviewed_at"))}: ${escapeHtml(fmtTime(profile.reviewed_at))}</p>` : ""}
        ${profile.review_note && (approved || rejected) ? `<p class="teacher-profile-meta-line teacher-profile-review-note"><span>${escapeHtml(tx("teacher.profile.review_note_label"))}:</span> ${escapeHtml(profile.review_note)}</p>` : ""}
      </section>
      ${regSnapshotCard}
      ${
        readOnly
          ? `<p class="teacher-profile-locked card">${escapeHtml(tx("teacher.profile.pending_readonly"))} <a href="#teacher">${escapeHtml(
              tx("teacher.profile.to_workbench"),
            )}</a></p>`
          : ""
      }
      ${
        rejected
          ? `<div class="teacher-profile-reject-banner card">
        <p class="teacher-profile-reject-title">${escapeHtml(tx("teacher.gate.rejected_status_title"))}</p>
        <p class="teacher-profile-reject-body">${escapeHtml(tx("teacher.gate.rejected_explain"))}</p>
        <p class="teacher-profile-reject-reason"><strong>${escapeHtml(tx("teacher.profile.rejection_label"))}:</strong> ${escapeHtml(
            profile.rejection_reason || "—",
          )}</p>
      </div>`
          : ""
      }
      <section class="card teacher-profile-form-card">
        <h2 class="teacher-profile-section-title">${escapeHtml(tx("teacher.profile.section_basic"))}</h2>
        <form id="teacherProfileForm" class="teacher-profile-form${readOnly ? " teacher-profile-form--readonly" : ""}">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.display_name"))}</span>
            <input name="display_name" type="text" required value="${escapeHtml(commerceRow.display_name || "")}" ${readOnly ? "disabled" : ""} />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.bio"))}</span>
            <textarea name="bio" rows="3" class="teacher-profile-textarea" ${readOnly ? "disabled" : ""}>${escapeHtml(
              commerceRow.bio || "",
            )}</textarea>
          </label>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.expertise_tags"))}</span>
            <input name="expertise_tags" type="text" value="${escapeHtml(tagsStr)}" placeholder="${escapeHtml(
              tx("teacher.profile.expertise_placeholder"),
            )}" ${readOnly ? "disabled" : ""} />
          </div>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.teaching_targets"))}</span>
            <div class="teacher-profile-checkgroup">
              ${checkboxesRow(targets, "teaching_target", TARGET_OPTS, (c) => tx(`teacher.profile.target.${c}`), readOnly)}
            </div>
          </div>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.teaching_languages"))}</span>
            <div class="teacher-profile-checkgroup">
              ${checkboxesRow(langs, "teaching_lang", LANG_OPTS, (c) => tx(`teacher.profile.lang.${c}`), readOnly)}
            </div>
          </div>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.experience_note"))}</span>
            <textarea name="experience_note" rows="3" class="teacher-profile-textarea" ${readOnly ? "disabled" : ""}>${escapeHtml(
              profile.experience_note || "",
            )}</textarea>
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.introduction_note"))}</span>
            <textarea name="introduction_note" rows="3" class="teacher-profile-textarea" ${readOnly ? "disabled" : ""}>${escapeHtml(
              profile.introduction_note || "",
            )}</textarea>
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.contact_note"))} <span class="teacher-profile-optional">(${escapeHtml(
              tx("teacher.profile.optional"),
            )})</span></span>
            <input name="contact_note" type="text" value="${escapeHtml(profile.contact_note || "")}" ${readOnly ? "disabled" : ""} />
          </label>

          <h2 class="teacher-profile-section-title teacher-profile-section-title--sub">${escapeHtml(tx("teacher.profile.credential_section"))}</h2>
          <p class="teacher-credential-hint">${escapeHtml(tx("teacher.profile.credential_hint"))}</p>
          ${credsHtml}
          ${
            readOnly
              ? ""
              : `<div class="teacher-credential-add card teacher-credential-add-form">
            <h3 class="teacher-credential-add-title">${escapeHtml(tx("teacher.profile.add_credential"))}</h3>
            <label class="auth-field">
              <span class="auth-label">${escapeHtml(tx("teacher.profile.cred_title"))}</span>
              <input type="text" id="newCredTitle" />
            </label>
            <label class="auth-field">
              <span class="auth-label">${escapeHtml(tx("teacher.profile.cred_kind"))}</span>
              <select id="newCredKind">${KIND_OPTS.map((k) => `<option value="${k}">${escapeHtml(tLabel(`teacher.profile.cred_kind.${k}`))}</option>`).join("")}</select>
            </label>
            <label class="auth-field">
              <span class="auth-label">${escapeHtml(tx("teacher.profile.cred_note"))}</span>
              <input type="text" id="newCredNote" />
            </label>
            <button type="button" class="auth-submit auth-submit--secondary" id="tpAddCred">${escapeHtml(tx("teacher.profile.cred_add_btn"))}</button>
          </div>`
          }

          <div class="teacher-profile-actions">
            <button type="button" class="auth-submit teacher-profile-save" id="tpSave" ${readOnly ? "disabled" : ""}>${escapeHtml(
              tx("common.save"),
            )}</button>
            <button type="button" class="auth-submit auth-submit--secondary" id="tpSubmit" ${showSubmit ? "" : "hidden"}>${escapeHtml(
              tx(submitLabelKey),
            )}</button>
          </div>
          <p class="auth-toast" id="tpToast" hidden></p>
        </form>
      </section>
      <p class="teacher-profile-back"><a href="#teacher">${escapeHtml(tx("teacher.nav.back_mine_workbench"))}</a></p>
  `;
  root.innerHTML = renderTeacherAdminShell({
    active: "profile",
    tx,
    showReviewConsole,
    mainHtml: main,
    shellClass: "teacher-profile-page teacher-page teacher-admin-shell",
  });
  i18n.apply?.(root);

  const toast = root.querySelector("#tpToast");
  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
  };

  function getTargetsFromForm() {
    return TARGET_OPTS.filter((v) => root.querySelector(`input[name="teaching_target"][value="${v}"]`)?.checked);
  }
  function getLangsFromForm() {
    return LANG_OPTS.filter((v) => root.querySelector(`input[name="teaching_lang"][value="${v}"]`)?.checked);
  }

  const collectFields = (fd) => {
    return {
      display_name: String(fd.get("display_name") || ""),
      bio: String(fd.get("bio") || ""),
      expertiseTagsStr: String(fd.get("expertise_tags") || ""),
      teachingTargetsStr: getTargetsFromForm().join(","),
      teachingLanguagesStr: getLangsFromForm().join(","),
      experience_note: String(fd.get("experience_note") || ""),
      introduction_note: String(fd.get("introduction_note") || ""),
      contact_note: String(fd.get("contact_note") || ""),
    };
  };

  /** @type {{ phone: string; code: string; nameLocked: string; birthdayLocked: string; exp: number } | null} */
  let profileOtpSession = null;
  let registrationEditUnlocked = false;

  const showRegErr = (msg) => {
    const el = root.querySelector("#tpRegErr");
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    }
  };
  const clearRegErr = () => {
    const el = root.querySelector("#tpRegErr");
    if (el) el.hidden = true;
  };

  const updateRegAgeLine = () => {
    const b = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegBirthday"));
    const ageEl = root.querySelector("#tpRegAgeLine");
    if (!b || !ageEl) return;
    const iso = normalizeBirthdayIso(b.value);
    const age = iso ? ageFromBirthdayIso(iso) : null;
    ageEl.textContent = age != null ? tx("teacher.profile.registration_age_line", { n: age }) : "—";
  };

  if (hasStructuredReg) {
    const legalIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegLegalName"));
    const bdIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegBirthday"));
    const phIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegPhoneDigits"));
    const genderSel = /** @type {HTMLSelectElement | null} */ (root.querySelector("#tpRegGender"));
    const otpIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegOtpInput"));
    const otpBanner = root.querySelector("#tpRegOtpBanner");
    const otpWrap = root.querySelector("#tpRegOtpWrap");
    const saveSnapBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpRegSaveSnap"));

    if (bdIn) {
      const now = new Date();
      const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
      bdIn.max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const minD = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
      bdIn.min = `${minD.getFullYear()}-${pad(minD.getMonth() + 1)}-${pad(minD.getDate())}`;
    }
    bdIn?.addEventListener("input", updateRegAgeLine);

    root.querySelector("#tpRegGate")?.addEventListener("click", () => {
      clearRegErr();
      otpWrap?.removeAttribute("hidden");
    });

    root.querySelector("#tpRegSendSms")?.addEventListener("click", () => {
      clearRegErr();
      const realName = normalizeName(legalIn?.value || "");
      const birthdayIso = normalizeBirthdayIso(bdIn?.value ?? "");
      const phone = normalizePhoneDigits(phIn?.value || "");
      if (!realName || !birthdayIso || phone.length < 5) {
        showRegErr(tx("teacher.profile.reg_err_need_fields"));
        return;
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      profileOtpSession = {
        phone,
        code,
        nameLocked: realName,
        birthdayLocked: birthdayIso,
        exp: Date.now() + 10 * 60 * 1000,
      };
      if (otpBanner) {
        otpBanner.hidden = false;
        otpBanner.textContent = tx("teacher.profile.reg_otp_banner", { code });
      }
    });

    root.querySelector("#tpRegVerifySms")?.addEventListener("click", () => {
      clearRegErr();
      const sess = profileOtpSession;
      if (!sess || Date.now() > sess.exp) {
        showRegErr(tx("teacherApply.error_otp_expired"));
        profileOtpSession = null;
        if (otpBanner) {
          otpBanner.hidden = true;
          otpBanner.textContent = "";
        }
        return;
      }
      const phone = normalizePhoneDigits(phIn?.value || "");
      const codeIn = String(otpIn?.value || "").replace(/\s/g, "");
      const realName = normalizeName(legalIn?.value || "");
      const birthdayNow = normalizeBirthdayIso(bdIn?.value ?? "") || "";
      if (phone !== sess.phone) {
        showRegErr(tx("teacherApply.error_phone_mismatch_session"));
        return;
      }
      if (codeIn !== sess.code) {
        showRegErr(tx("teacherApply.error_otp_wrong"));
        return;
      }
      if (realName !== sess.nameLocked) {
        showRegErr(tx("teacherApply.error_realname_vs_otp"));
        return;
      }
      if (birthdayNow !== sess.birthdayLocked) {
        showRegErr(tx("teacherApply.error_birthday_vs_otp"));
        return;
      }
      registrationEditUnlocked = true;
      profileOtpSession = null;
      if (otpBanner) {
        otpBanner.hidden = true;
        otpBanner.textContent = "";
      }
      otpWrap?.setAttribute("hidden", "");
      if (legalIn) legalIn.disabled = false;
      if (bdIn) bdIn.disabled = false;
      if (phIn) phIn.disabled = false;
      if (genderSel) genderSel.disabled = false;
      if (saveSnapBtn) saveSnapBtn.disabled = false;
      const ok = root.querySelector("#tpRegOkLine");
      if (ok) {
        ok.hidden = false;
        ok.textContent = tx("teacher.profile.reg_unlocked");
      }
    });

    saveSnapBtn?.addEventListener("click", async () => {
      if (!registrationEditUnlocked) {
        showRegErr(tx("teacher.profile.reg_err_verify_first"));
        return;
      }
      clearRegErr();
      const birthdayIso = normalizeBirthdayIso(bdIn?.value ?? "");
      const phoneDigits = normalizePhoneDigits(phIn?.value || "");
      if (!normalizeName(legalIn?.value || "") || !birthdayIso || phoneDigits.length < 5) {
        showRegErr(tx("teacher.profile.reg_err_need_fields"));
        return;
      }
      const g = String(genderSel?.value || "");
      const gender = g === "m" || g === "f" ? /** @type {'m'|'f'} */ (g) : /** @type {''|'m'|'f'} */ ("");
      const r = await updateTeacherRegistrationSnapshot({
        legal_name: normalizeName(legalIn?.value || ""),
        gender,
        birthday_iso: birthdayIso,
        phone_digits: phoneDigits,
      });
      if (!r.ok) {
        showRegErr(tx("auth.error.unknown"));
        return;
      }
      showToast(tx("teacher.profile.reg_saved"));
      await reloadPage(root);
    });
  }

  root.querySelector("#tpSave")?.addEventListener("click", async () => {
    if (readOnly) return;
    const form = root.querySelector("#teacherProfileForm");
    if (!form) return;
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const r = await saveTeacherProfileFields(u.teacherProfileId, collectFields(fd), u.id);
    showToast(r.ok ? tx("auth.save_ok") : tx("auth.error.unknown"));
  });

  root.querySelector("#tpAddCred")?.addEventListener("click", async () => {
    const title = String(root.querySelector("#newCredTitle")?.value || "").trim();
    const kind = String(root.querySelector("#newCredKind")?.value || "other");
    const note = String(root.querySelector("#newCredNote")?.value || "");
    if (!title) {
      showToast(tx("teacher.profile.cred_title_required"));
      return;
    }
    const r = await addTeacherCredentialPlaceholder(u.teacherProfileId, u.id, { title, kind, note });
    if (r.ok) {
      await reloadPage(root);
    } else {
      showToast(tx("auth.error.unknown"));
    }
  });

  root.querySelectorAll(".teacher-cred-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-remove-cred");
      if (!id) return;
      const r = await removeTeacherCredentialItem(u.teacherProfileId, u.id, id);
      if (r.ok) await reloadPage(root);
      else showToast(tx("auth.error.unknown"));
    });
  });

  root.querySelector("#tpSubmit")?.addEventListener("click", async () => {
    if (readOnly || approved || !u.teacherProfileId) return;
    const form = root.querySelector("#teacherProfileForm");
    if (form) {
      const fd = new FormData(/** @type {HTMLFormElement} */ (form));
      const sr = await saveTeacherProfileFields(u.teacherProfileId, collectFields(fd), u.id);
      if (!sr.ok) {
        showToast(tx("auth.error.unknown"));
        return;
      }
    }
    const r = await submitTeacherProfileForReview(u.teacherProfileId, u.id);
    if (!r.ok) {
      const key = `teacher.profile.error.${r.code || "unknown"}`;
      const msg = tx(key) !== key ? tx(key) : tx("auth.error.unknown");
      showToast(msg);
      return;
    }
    const msg =
      r.softWarning === "no_credentials"
        ? `${tx("teacher.profile.submit_ok")} ${tx("teacher.profile.warn_no_credential")}`
        : tx("teacher.profile.submit_ok");
    showToast(msg);
    const { navigateTo } = await import("../router.js");
    navigateTo("#teacher", { force: true });
  });
}

export function mount(c) {
  return pageTeacherProfile(c);
}
export function render(c) {
  return pageTeacherProfile(c);
}
