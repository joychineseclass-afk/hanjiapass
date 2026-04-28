// #teacher-profile 老师档案：扩展资料 + 资质占位 + 提交审核

import { i18n } from "../i18n.js";
import { normalizeBirthdayIso, normalizeName, normalizePhoneDigits } from "../auth/teacherRegistrationUtils.js";
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
import { withButtonLock } from "../lumina-commerce/uiAsync.js";
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
    return `<p class="teacher-reg-muted">${escapeHtml(tx("teacher.profile.personal_certs_placeholder"))}</p>`;
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

/**
 * 无结构化存档时，从轻量中文 intro 文本中解析性别/手机（不向用户展示原文）。
 * @param {string} intro
 */
function parseLegacyZhIntro(intro) {
  const s = String(intro ?? "").replace(/\r\n/g, "\n");
  const o = /** @type {{ gender?: '' | 'm' | 'f'; phone_digits?: string }} */ ({});
  const gm = s.match(/性别\s*[：:]\s*([^\n\r]+)/);
  if (gm) {
    const t = String(gm[1] ?? "").trim();
    if (/男/.test(t) && !/女/.test(t)) o.gender = "m";
    else if (/女/.test(t)) o.gender = "f";
  }
  const pm = s.match(/手机\s*[：:]\s*([\d\s\-+]+)/);
  if (pm) {
    const d = normalizePhoneDigits(pm[1]);
    if (d.length >= 5) o.phone_digits = d;
  }
  return o;
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
 * @param {string} [inputClass]
 */
function checkboxesRow(selected, name, options, labelFn, disabled, inputClass) {
  const d = disabled ? "disabled" : "";
  const ic = inputClass && String(inputClass).trim() !== "" ? ` class="${escapeHtml(String(inputClass))}"` : "";
  return options
    .map((c) => {
      const on = selected.includes(c) ? "checked" : "";
      return `<label class="teacher-profile-check"><input type="checkbox"${ic} name="${name}" value="${c}" ${on} ${d} />${escapeHtml(labelFn(c))}</label>`;
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
  const legacyIntro = tpAuth?.intro ? String(tpAuth.intro) : "";

  const legacyParsed = parseLegacyZhIntro(legacyIntro);
  const vLegal = regLegal;
  const vGender = regGender || legacyParsed.gender || "";
  const vBirth = regBirth;
  const vPhone = regPhone || legacyParsed.phone_digits || "";
  const accountEmail = String(authFull?.email ?? "").trim();

  const chkLockInit = true;

  const credentialAddBlock =
    readOnly
      ? ""
      : `<div class="teacher-credential-add card teacher-credential-add-form teacher-cred-add--nested">
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
          </div>`;

  const personalTargetsRow = checkboxesRow(
    targets,
    "teaching_target",
    TARGET_OPTS,
    (c) => tx(`teacher.profile.target.${c}`),
    chkLockInit,
    "tp-personal-lock",
  );
  const personalLangsRow = checkboxesRow(
    langs,
    "teaching_lang",
    LANG_OPTS,
    (c) => tx(`teacher.profile.lang.${c}`),
    chkLockInit,
    "tp-personal-lock",
  );

  const personalGateBlock = readOnly
    ? `<p class="teacher-reg-muted">${escapeHtml(tx("teacher.profile.personal_gate_pending_notice"))}</p>`
    : `<p class="teacher-reg-hint">${escapeHtml(tx("teacher.profile.personal_gate_hint"))}</p>
        <button type="button" id="tpChangePersonal" class="auth-submit auth-submit--secondary">${escapeHtml(tx("teacher.profile.personal_change_cta"))}</button>
        <div id="tpRegOtpWrap" class="teacher-reg-otp" hidden>
          <p class="teacher-reg-mini">${escapeHtml(tx("teacher.profile.registration_phone_gate"))}</p>
          <div class="teacher-apply__phone-send-row">
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
          <button type="button" class="auth-submit auth-submit--secondary" id="tpRegSaveSnap" disabled>${escapeHtml(tx("teacher.profile.personal_save"))}</button>
        </div>`;

  const personalCard = `<section class="card teacher-personal-card">
        <h2 class="teacher-profile-section-title">${escapeHtml(tx("teacher.profile.section_personal"))}</h2>
        <div class="teacher-personal-grid">
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_real_name"))}</span>
            <input id="tpRegLegalName" class="tp-personal-lock" type="text" autocomplete="name" maxlength="80" value="${escapeHtml(vLegal)}" disabled />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacherApply.field_gender"))}</span>
            <select id="tpRegGender" class="tp-personal-lock" disabled>
              <option value="" ${vGender === "" ? "selected" : ""}>${escapeHtml(tx("teacherApply.gender_ph"))}</option>
              <option value="m" ${vGender === "m" ? "selected" : ""}>${escapeHtml(tx("teacherApply.gender_m"))}</option>
              <option value="f" ${vGender === "f" ? "selected" : ""}>${escapeHtml(tx("teacherApply.gender_f"))}</option>
            </select>
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_birthday"))}</span>
            <input id="tpRegBirthday" type="date" class="tp-personal-lock" autocomplete="bday" value="${escapeHtml(vBirth)}" disabled />
          </label>
          <label class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_phone"))}</span>
            <input id="tpRegPhoneDigits" type="tel" class="tp-personal-lock" inputmode="tel" value="${escapeHtml(vPhone)}" maxlength="22" disabled />
          </label>
          <div class="auth-field">
            <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_email"))}</span>
            <input type="email" readonly class="teacher-apply__input-readonly teacher-profile-input" value="${escapeHtml(accountEmail || "")}" />
          </div>
        </div>
        <div class="teacher-reg-cred-box">
          <h3 class="teacher-reg-subtitle">${escapeHtml(tx("teacher.profile.personal_certs_heading"))}</h3>
          ${registrationCredentialsHtml(regSnap)}
          <div class="teacher-credential-commerce-block">
            <p class="teacher-credential-hint">${escapeHtml(tx("teacher.profile.credential_hint"))}</p>
            ${credsHtml}
            ${credentialAddBlock}
          </div>
        </div>
        <label class="auth-field">
          <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_intro_short"))}</span>
          <textarea name="bio" id="tpBioField" rows="4" class="teacher-profile-textarea" ${readOnly ? "disabled" : ""}>${escapeHtml(commerceRow.bio || "")}</textarea>
        </label>
        <div class="teacher-intro-actions">
          <button type="button" class="auth-submit auth-submit--secondary" id="tpIntroEdit">${escapeHtml(tx("common.edit"))}</button>
          <button type="button" class="auth-submit auth-submit--secondary" id="tpIntroSave" ${readOnly ? "disabled" : ""}>${escapeHtml(tx("common.save"))}</button>
        </div>
        <div class="auth-field">
          <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_targets"))}</span>
          <div class="teacher-profile-checkgroup">${personalTargetsRow}</div>
        </div>
        <div class="auth-field">
          <span class="auth-label">${escapeHtml(tx("teacher.profile.personal_langs"))}</span>
          <div class="teacher-profile-checkgroup">${personalLangsRow}</div>
        </div>
        ${personalGateBlock}
        <p class="auth-error" id="tpRegErr" hidden></p>
      </section>`;

  const main = `
      <section class="card teacher-profile-hero">
        <h1 class="teacher-profile-title">${escapeHtml(tx("teacher.profile.page_title"))}</h1>
        <p class="teacher-profile-status">${escapeHtml(tx("teacher.profile.status_label"))}: <strong>${statusLabel}</strong></p>
        ${profile.submitted_at ? `<p class="teacher-profile-meta-line">${escapeHtml(tx("teacher.profile.submitted_at"))}: ${escapeHtml(fmtTime(profile.submitted_at))}</p>` : ""}
        ${profile.reviewed_at && (approved || rejected) ? `<p class="teacher-profile-meta-line">${escapeHtml(tx("teacher.profile.reviewed_at"))}: ${escapeHtml(fmtTime(profile.reviewed_at))}</p>` : ""}
        ${profile.review_note && (approved || rejected) ? `<p class="teacher-profile-meta-line teacher-profile-review-note"><span>${escapeHtml(tx("teacher.profile.review_note_label"))}:</span> ${escapeHtml(profile.review_note)}</p>` : ""}
      </section>
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
      <form id="teacherProfileForm" class="teacher-profile-shell-form teacher-profile-form${readOnly ? " teacher-profile-form--readonly" : ""}">
        <input type="hidden" name="display_name" value="${escapeHtml(commerceRow.display_name || "")}" />
        <input type="hidden" name="expertise_tags" value="${escapeHtml(tagsStr)}" />
        <textarea name="experience_note" class="teacher-profile-preserve-hidden">${escapeHtml(profile.experience_note || "")}</textarea>
        <textarea name="introduction_note" class="teacher-profile-preserve-hidden">${escapeHtml(profile.introduction_note || "")}</textarea>
        <input type="hidden" name="contact_note" value="${escapeHtml(profile.contact_note || "")}" />
        ${personalCard}
      <section class="card teacher-profile-form-card teacher-profile-card--below teacher-profile-actions-card">
          <div class="teacher-profile-actions">
            <button type="button" class="auth-submit teacher-profile-save" id="tpSave" ${readOnly ? "disabled" : ""}>${escapeHtml(
              tx("common.save"),
            )}</button>
            <button type="button" class="auth-submit auth-submit--secondary" id="tpSubmit" ${showSubmit ? "" : "hidden"}>${escapeHtml(
              tx(submitLabelKey),
            )}</button>
          </div>
          <p class="auth-toast" id="tpToast" hidden></p>
      </section>
      </form>
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

  root.querySelector("#tpIntroEdit")?.addEventListener("click", () => {
    if (readOnly) return;
    const ta = /** @type {HTMLTextAreaElement | null} */ (root.querySelector("#tpBioField") || root.querySelector('textarea[name="bio"]'));
    if (!ta) return;
    ta.focus();
  });

  const tpIntroSaveBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpIntroSave"));
  tpIntroSaveBtn?.addEventListener("click", async () => {
    if (readOnly) return;
    await withButtonLock(tpIntroSaveBtn, async () => {
      const form = root.querySelector("#teacherProfileForm");
      if (!form) return;
      const fd = new FormData(/** @type {HTMLFormElement} */ (form));
      const r = await saveTeacherProfileFields(u.teacherProfileId, collectFields(fd), u.id);
      if (!r.ok) {
        const key = `teacher.profile.error.${r.code || "unknown"}`;
        showToast(tx(key) !== key ? tx(key) : tx("auth.error.unknown"));
        return;
      }
      showToast(tx("auth.save_ok"));
    });
  });

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
      bio: String(fd.get("bio") ?? ""),
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

  /** @param {boolean} unlocked */
  function applyPersonalGateVisual(unlocked) {
    if (readOnly) return;
    root.querySelectorAll(".tp-personal-lock").forEach((el) => {
      /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */ (el).disabled = !unlocked;
    });
  }

  if (!readOnly) applyPersonalGateVisual(false);

  if (!readOnly) {
    const legalIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegLegalName"));
    const bdIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegBirthday"));
    const phIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegPhoneDigits"));
    const genderSel = /** @type {HTMLSelectElement | null} */ (root.querySelector("#tpRegGender"));
    const otpIn = /** @type {HTMLInputElement | null} */ (root.querySelector("#tpRegOtpInput"));
    const otpBanner = root.querySelector("#tpRegOtpBanner");
    const otpWrap = root.querySelector("#tpRegOtpWrap");
    const saveSnapBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpRegSaveSnap"));
    const sendSmsBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpRegSendSms"));
    const verifySmsBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpRegVerifySms"));

    if (bdIn) {
      const now = new Date();
      const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
      bdIn.max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const minD = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
      bdIn.min = `${minD.getFullYear()}-${pad(minD.getMonth() + 1)}-${pad(minD.getDate())}`;
    }
    root.querySelector("#tpChangePersonal")?.addEventListener("click", () => {
      clearRegErr();
      otpWrap?.removeAttribute("hidden");
    });

    sendSmsBtn?.addEventListener("click", () => {
      void withButtonLock(sendSmsBtn, async () => {
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
    });

    verifySmsBtn?.addEventListener("click", () => {
      void withButtonLock(verifySmsBtn, async () => {
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
        applyPersonalGateVisual(true);
        if (saveSnapBtn) saveSnapBtn.disabled = false;
        const ok = root.querySelector("#tpRegOkLine");
        if (ok) {
          ok.hidden = false;
          ok.textContent = tx("teacher.profile.reg_unlocked");
        }
      });
    });

    saveSnapBtn?.addEventListener("click", async () => {
      await withButtonLock(saveSnapBtn, async () => {
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
        const rSnap = await updateTeacherRegistrationSnapshot({
          legal_name: normalizeName(legalIn?.value || ""),
          gender,
          birthday_iso: birthdayIso,
          phone_digits: phoneDigits,
        });
        if (!rSnap.ok) {
          showRegErr(tx("auth.error.unknown"));
          return;
        }
        const form = root.querySelector("#teacherProfileForm");
        if (!form) return;
        const fd = new FormData(/** @type {HTMLFormElement} */ (form));
        const rSave = await saveTeacherProfileFields(u.teacherProfileId, collectFields(fd), u.id);
        if (!rSave.ok) {
          const key = `teacher.profile.error.${rSave.code || "unknown"}`;
          showRegErr(tx(key) !== key ? tx(key) : tx("auth.error.unknown"));
          return;
        }
        showToast(tx("teacher.profile.personal_saved"));
        await reloadPage(root);
      });
    });
  }

  const tpSaveBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpSave"));
  tpSaveBtn?.addEventListener("click", async () => {
    if (readOnly) return;
    await withButtonLock(tpSaveBtn, async () => {
      const form = root.querySelector("#teacherProfileForm");
      if (!form) return;
      const fd = new FormData(/** @type {HTMLFormElement} */ (form));
      const r = await saveTeacherProfileFields(u.teacherProfileId, collectFields(fd), u.id);
      showToast(r.ok ? tx("auth.save_ok") : tx("auth.error.unknown"));
    });
  });

  const tpAddCredBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpAddCred"));
  tpAddCredBtn?.addEventListener("click", async () => {
    await withButtonLock(tpAddCredBtn, async () => {
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
  });

  root.querySelectorAll(".teacher-cred-remove").forEach((btn) => {
    const rm = /** @type {HTMLButtonElement} */ (btn);
    rm.addEventListener("click", () => {
      void withButtonLock(rm, async () => {
        const id = rm.getAttribute("data-remove-cred");
        if (!id) return;
        const r = await removeTeacherCredentialItem(u.teacherProfileId, u.id, id);
        if (r.ok) await reloadPage(root);
        else showToast(tx("auth.error.unknown"));
      });
    });
  });

  const tpSubmitBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector("#tpSubmit"));
  tpSubmitBtn?.addEventListener("click", async () => {
    if (readOnly || approved || !u.teacherProfileId) return;
    await withButtonLock(tpSubmitBtn, async () => {
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
  });
}

export function mount(c) {
  return pageTeacherProfile(c);
}
export function render(c) {
  return pageTeacherProfile(c);
}
