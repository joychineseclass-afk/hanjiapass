// #teacher-apply 教师申请（基础资料 + 手机实名验证码 + 可选资质勾选与本地文件）

import { i18n } from "../i18n.js";
import {
  getCurrentSessionAuthUser,
  getTeacherNavRoleState,
  submitTeacherApplication,
} from "../auth/authService.js";
import { findUserById } from "../auth/authStore.js";
import {
  requestTeacherPhoneOtp,
  TEACHER_PHONE_OTP_ERR_TX,
  verifyTeacherPhoneOtp,
} from "../auth/teacherOtpService.js";
import { normalizeBirthdayIso, normalizeName, normalizePhoneDigits } from "../auth/teacherRegistrationUtils.js";
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

/** @type {string | null} 已通过短信验证锁定的生日（YYYY-MM-DD） */
let verifiedBirthdayIso = null;

/**
 * 将新表单字段写回既有的 teacherProfile 结构（不改 auth 层接口）。
 */
function buildProfileIntro(/** @type {FormData} */ fd) {
  const g = String(fd.get("gender") || "");
  const gmap = {
    m: "teacherApply.gender_m",
    f: "teacherApply.gender_f",
  };
  const gKey = g === "m" || g === "f" ? g : "m";
  const gLabel = tx(gmap[gKey]);
  const bd = normalizeBirthdayIso(String(fd.get("birthday") || ""));
  const bdLine = bd || String(fd.get("birthday") || "").trim();
  const phone = String(fd.get("identity_phone") || "").trim();
  return [`${tx("teacherApply.pack_gender")}: ${gLabel}`, `${tx("teacherApply.pack_birthday")}: ${bdLine}`, `${tx("teacherApply.pack_phone")}: ${phone}`].join(
    "\n",
  );
}

function buildProfileNote(/** @type {FormData} */ fd, /** @type {HTMLFormElement} */ form) {
  const cred = String(fd.get("credentials") || "").trim();
  const head = String(tx("teacherApply.note_identity_line") || "").trim();
  const bits = [head];
  const credBits = [];
  for (let i = 1; i <= 4; i++) {
    if (!fd.get(`cred_pick_${i}`)) continue;
    const label = tx(`teacherApply.cred_b${i}`);
    const fileInp = form.querySelector(`input[name="cred_upload_${i}"]`);
    const fn = fileInp && fileInp.files && fileInp.files[0] ? fileInp.files[0].name : "";
    credBits.push(fn ? `${label} (${tx("teacherApply.cred_line_attached")}: ${fn})` : `${label}`);
  }
  if (credBits.length) bits.push(credBits.join("\n"));
  if (cred) bits.push(cred);
  return bits.filter(Boolean).join("\n\n");
}

/**
 * @param {FormData} fd
 * @param {HTMLFormElement} form
 */
function buildRegistrationSnapshot(fd, form) {
  const legal_name = normalizeName(fd.get("realName") || "");
  const g = String(fd.get("gender") || "");
  const gender = g === "m" || g === "f" ? g : "";
  const birthday_iso = normalizeBirthdayIso(String(fd.get("birthday") || "")) || "";
  const phone_digits = normalizePhoneDigits(String(fd.get("identity_phone") || ""));
  /** @type {{ slot: string, labelKey: string, fileName: string }[]} */
  const credentials = [];
  for (let i = 1; i <= 4; i++) {
    if (!fd.get(`cred_pick_${i}`)) continue;
    const fileInp = form.querySelector(`input[name="cred_upload_${i}"]`);
    const fn = fileInp && fileInp.files && fileInp.files[0] ? String(fileInp.files[0].name) : "";
    credentials.push({ slot: String(i), labelKey: `teacherApply.cred_b${i}`, fileName: fn });
  }
  return {
    legal_name,
    gender,
    birthday_iso,
    phone_digits,
    credentials,
    captured_at: new Date().toISOString(),
  };
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
        <form class="auth-form" id="teacherApplyForm" novalidate data-phone-verified="0">
          <input type="hidden" name="identity_verified" value="0" id="taIdentityVerified" />

          <div class="teacher-apply__section">
            <h2 class="teacher-apply__h2" data-i18n="teacherApply.section_basic">${escapeHtml(tx("teacherApply.section_basic"))}</h2>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.real_name">${escapeHtml(tx("teacherApply.real_name"))}</span>
              <input id="taRealName" name="realName" type="text" required autocomplete="name" value="${escapeHtml(realNameValue)}" maxlength="80" />
            </label>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_gender">${escapeHtml(tx("teacherApply.field_gender"))}</span>
              <select name="gender" required>
                <option value="" data-i18n="teacherApply.gender_ph">${escapeHtml(tx("teacherApply.gender_ph"))}</option>
                <option value="m" data-i18n="teacherApply.gender_m">${escapeHtml(tx("teacherApply.gender_m"))}</option>
                <option value="f" data-i18n="teacherApply.gender_f">${escapeHtml(tx("teacherApply.gender_f"))}</option>
              </select>
            </label>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_birthday">${escapeHtml(tx("teacherApply.field_birthday"))}</span>
              <input id="taBirthday" name="birthday" type="date" required autocomplete="bday" />
              <p class="teacher-apply__field-hint" data-i18n="teacherApply.field_birthday_hint">${escapeHtml(tx("teacherApply.field_birthday_hint"))}</p>
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
            <p class="teacher-apply__identity-lead" data-i18n="teacherApply.identity_intro">${escapeHtml(tx("teacherApply.identity_intro"))}</p>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.field_phone_identity">${escapeHtml(tx("teacherApply.field_phone_identity"))}</span>
              <div class="teacher-apply__phone-send-row">
                <input name="identity_phone" id="taIdentityPhone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="32" />
                <button type="button" class="auth-submit auth-submit--secondary" id="taSendSms">${escapeHtml(tx("teacherApply.send_sms"))}</button>
              </div>
            </label>
            <p class="teacher-apply__otp-banner" id="taOtpBanner" hidden></p>
            <label class="auth-field">
              <span class="auth-label" data-i18n="teacherApply.sms_code_label">${escapeHtml(tx("teacherApply.sms_code_label"))}</span>
              <div class="teacher-apply__phone-send-row">
                <input name="sms_code" id="taSmsCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="${escapeHtml(tx("teacherApply.sms_code_placeholder"))}" />
                <button type="button" class="auth-submit auth-submit--secondary" id="taVerifySms">${escapeHtml(tx("teacherApply.verify_sms"))}</button>
              </div>
            </label>
            <p class="teacher-apply__verify-ok" id="taVerifyOk" hidden role="status"></p>
          </div>

          <div class="teacher-apply__section">
            <h2 class="teacher-apply__h2" data-i18n="teacherApply.section_credentials">${escapeHtml(tx("teacherApply.section_credentials"))}</h2>
            <p class="teacher-apply__cred-lead" data-i18n="teacherApply.cred_intro">${escapeHtml(tx("teacherApply.cred_intro"))}</p>
            ${[1, 2, 3, 4]
              .map(
                (i) => `
            <div class="teacher-apply__cred-row">
              <label class="teacher-apply__cred-check">
                <input type="checkbox" name="cred_pick_${i}" value="1" />
                <span data-i18n="teacherApply.cred_b${i}">${escapeHtml(tx(`teacherApply.cred_b${i}`))}</span>
              </label>
              <div class="teacher-apply__cred-upload">
                <input type="file" name="cred_upload_${i}" id="taCredFile${i}" class="teacher-apply__file-native" accept="image/*,.pdf,.doc,.docx" />
                <button type="button" class="auth-submit auth-submit--secondary teacher-apply__file-btn" data-ta-file="${i}">${escapeHtml(tx("teacherApply.upload_file"))}</button>
                <span class="teacher-apply__file-picked" id="taCredFileName${i}" aria-live="polite"></span>
              </div>
            </div>`,
              )
              .join("")}
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

          <label class="auth-field teacher-apply__ack teacher-apply__ack--final">
            <span class="teacher-apply__ack-row">
              <input type="checkbox" name="final_ack" id="taFinalAck" value="1" required />
              <span data-i18n="teacherApply.final_ack">${escapeHtml(tx("teacherApply.final_ack"))}</span>
            </span>
          </label>

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

  const form = /** @type {HTMLFormElement | null} */ (root.querySelector("#teacherApplyForm"));
  const errEl = root.querySelector("#teacherApplyErr");
  const taRealName = root.querySelector("#taRealName");
  const taIdentityPhone = root.querySelector("#taIdentityPhone");
  const taSmsCode = root.querySelector("#taSmsCode");
  const taOtpBanner = root.querySelector("#taOtpBanner");
  const taVerifyOk = root.querySelector("#taVerifyOk");
  const taIdentityVerified = root.querySelector("#taIdentityVerified");
  const sendBtn = root.querySelector("#taSendSms");
  const verifyBtn = root.querySelector("#taVerifySms");
  const taBirthday = /** @type {HTMLInputElement | null} */ (root.querySelector("#taBirthday"));
  if (taBirthday) {
    const now = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
    taBirthday.max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const minD = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    taBirthday.min = `${minD.getFullYear()}-${pad(minD.getMonth() + 1)}-${pad(minD.getDate())}`;
  }

  function showErr(msg) {
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
  }
  function clearErr() {
    if (errEl) errEl.hidden = true;
  }

  function setVerifiedUi(ok) {
    if (!ok) verifiedBirthdayIso = null;
    if (form) form.dataset.phoneVerified = ok ? "1" : "0";
    if (taIdentityVerified) taIdentityVerified.value = ok ? "1" : "0";
    if (taVerifyOk) {
      taVerifyOk.hidden = !ok;
      taVerifyOk.textContent = ok ? tx("teacherApply.phone_verified_ok") : "";
    }
    if (taIdentityPhone) taIdentityPhone.readOnly = ok;
    if (sendBtn) sendBtn.disabled = ok;
    if (verifyBtn) verifyBtn.disabled = ok;
    if (taSmsCode) taSmsCode.readOnly = ok;
    if (taBirthday) taBirthday.readOnly = ok;
  }

  sendBtn?.addEventListener("click", async () => {
    clearErr();
    const realName = normalizeName(/** @type {HTMLInputElement} */ (taRealName)?.value || "");
    const phoneRaw = /** @type {HTMLInputElement} */ (taIdentityPhone)?.value || "";
    const phone = normalizePhoneDigits(phoneRaw);
    const birthdayIso = normalizeBirthdayIso(taBirthday?.value ?? "");
    if (!realName) {
      showErr(tx("teacherApply.error_name"));
      return;
    }
    if (!birthdayIso) {
      showErr(tx("teacherApply.error_birthday"));
      return;
    }
    if (phone.length < 5) {
      showErr(tx("teacherApply.error_phone"));
      return;
    }
    const res = await requestTeacherPhoneOtp({
      legalName: /** @type {HTMLInputElement} */ (taRealName)?.value || "",
      phoneDigitsRaw: phoneRaw,
      birthdayRaw: taBirthday?.value ?? "",
    });
    if (taOtpBanner) {
      taOtpBanner.hidden = false;
      if (res.devCode != null && res.devCode !== "") {
        taOtpBanner.textContent = tx("teacherApply.otp_sent_show", { code: res.devCode });
      } else {
        taOtpBanner.textContent = tx("teacherApply.otp_sent_masked", { masked: res.maskedPhone });
      }
    }
    setVerifiedUi(false);
    if (taVerifyOk) taVerifyOk.hidden = true;
  });

  verifyBtn?.addEventListener("click", async () => {
    clearErr();
    const vr = await verifyTeacherPhoneOtp({
      legalName: /** @type {HTMLInputElement} */ (taRealName)?.value || "",
      phoneDigitsRaw: /** @type {HTMLInputElement} */ (taIdentityPhone)?.value || "",
      smsCodeRaw: /** @type {HTMLInputElement} */ (taSmsCode)?.value || "",
      birthdayRaw: /** @type {HTMLInputElement} */ (taBirthday)?.value ?? "",
    });
    if (!vr.ok) {
      if (vr.reason === "expired" && taOtpBanner) {
        taOtpBanner.hidden = true;
        taOtpBanner.textContent = "";
      }
      showErr(tx(TEACHER_PHONE_OTP_ERR_TX[vr.reason]));
      return;
    }
    const bd = normalizeBirthdayIso(/** @type {HTMLInputElement} */ (taBirthday)?.value ?? "");
    verifiedBirthdayIso = bd || null;
    setVerifiedUi(true);
    if (taOtpBanner) {
      taOtpBanner.hidden = true;
      taOtpBanner.textContent = "";
    }
  });

  for (let i = 1; i <= 4; i++) {
    const btn = root.querySelector(`[data-ta-file="${i}"]`);
    const fin = /** @type {HTMLInputElement | null} */ (root.querySelector(`#taCredFile${i}`));
    const nameEl = root.querySelector(`#taCredFileName${i}`);
    btn?.addEventListener("click", () => fin?.click());
    fin?.addEventListener("change", () => {
      const n = fin.files && fin.files[0] ? fin.files[0].name : "";
      if (nameEl) nameEl.textContent = n ? tx("teacherApply.file_picked_label", { name: n }) : "";
    });
  }

  const back = root.querySelector("#taBackMy");
  back?.addEventListener("click", (e) => {
    e.preventDefault();
    import("../router.js").then((r) => r.navigateTo("#my-learning", { force: true }));
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErr();
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    if (!fd.get("final_ack")) {
      showErr(tx("teacherApply.error_final_ack"));
      return;
    }
    if (fd.get("identity_verified") !== "1") {
      showErr(tx("teacherApply.error_need_phone_verify"));
      return;
    }
    const realName = String(fd.get("realName") || "").trim();
    if (!realName) {
      showErr(tx("teacherApply.error_name"));
      return;
    }
    const birthdayIso = normalizeBirthdayIso(String(fd.get("birthday") || ""));
    if (!birthdayIso) {
      showErr(tx("teacherApply.error_birthday"));
      return;
    }
    if (!verifiedBirthdayIso || birthdayIso !== verifiedBirthdayIso) {
      showErr(tx("teacherApply.error_birthday_mismatch_verify"));
      return;
    }
    const formEl = /** @type {HTMLFormElement} */ (e.target);
    const res = await submitTeacherApplication({
      displayName: realName,
      intro: buildProfileIntro(fd),
      teachingTypes: ["other"],
      experienceLevel: "no_experience",
      note: buildProfileNote(fd, formEl),
      registrationSnapshot: buildRegistrationSnapshot(fd, formEl),
    });
    if (!res.ok) {
      showErr(tx("auth.error.unknown"));
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
