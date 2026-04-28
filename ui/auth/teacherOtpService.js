/**
 * Client-side SMS OTP placeholder until a real SMS gateway backs this flow.
 * In production domains, verification codes MUST NOT be surfaced in DOM text;
 * preview/dev may receive `devCode` for console-free testing (`shouldEnableLuminaDevUi`).
 */
import { shouldEnableLuminaDevUi } from "../lumina-commerce/devRuntimeFlags.js";
import { normalizeBirthdayIso, normalizeName, normalizePhoneDigits } from "./teacherRegistrationUtils.js";

/** @typedef {{ phone: string; code: string; nameLocked: string; birthdayLocked: string; exp: number }} TeacherPhoneOtpSession */

/** @type {TeacherPhoneOtpSession | null} */
let activeSession = null;

function maskPhoneDigits(digits) {
  const s = String(digits ?? "").replace(/\D/g, "");
  if (s.length < 4) return "****";
  if (s.length <= 8) return `${s.slice(0, 2)}…${s.slice(-2)}`;
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

/**
 * Reason codes map to `teacherApply.error_*` UI keys (reuse on profile OTP).
 * @type {Record<"expired"|"wrong"|"phone_mismatch"|"realname"|"birthday", string>}
 */
export const TEACHER_PHONE_OTP_ERR_TX = {
  expired: "teacherApply.error_otp_expired",
  wrong: "teacherApply.error_otp_wrong",
  phone_mismatch: "teacherApply.error_phone_mismatch_session",
  realname: "teacherApply.error_realname_vs_otp",
  birthday: "teacherApply.error_birthday_vs_otp",
};

/**
 * @param {{
 *   legalName: string;
 *   phoneDigitsRaw: string;
 *   birthdayRaw: string;
 * }} raw — form values before normalization (normalized here)
 * @returns {Promise<{ ok: true; maskedPhone: string; devCode?: string }>}
 */
export async function requestTeacherPhoneOtp({ legalName, phoneDigitsRaw, birthdayRaw }) {
  const phone = normalizePhoneDigits(phoneDigitsRaw);
  const nameLocked = normalizeName(legalName || "");
  const birthdayLocked = normalizeBirthdayIso(birthdayRaw ?? "") || "";
  const code = String(Math.floor(100000 + Math.random() * 900000));
  activeSession = {
    phone,
    code,
    nameLocked,
    birthdayLocked,
    exp: Date.now() + 10 * 60 * 1000,
  };
  return {
    ok: /** @type {const} */ (true),
    maskedPhone: maskPhoneDigits(phone),
    devCode: shouldEnableLuminaDevUi() ? code : undefined,
  };
}

/**
 * @param {{
 *   legalName: string;
 *   phoneDigitsRaw: string;
 *   smsCodeRaw: string;
 *   birthdayRaw: string;
 * }} raw
 * @returns {Promise<{ ok: true } | { ok: false; reason: keyof typeof TEACHER_PHONE_OTP_ERR_TX }>}
 */
export async function verifyTeacherPhoneOtp({ legalName, phoneDigitsRaw, smsCodeRaw, birthdayRaw }) {
  const sess = activeSession;
  if (!sess || Date.now() > sess.exp) {
    activeSession = null;
    return { ok: false, reason: "expired" };
  }
  const phone = normalizePhoneDigits(phoneDigitsRaw || "");
  const codeIn = String(smsCodeRaw || "").replace(/\s/g, "");
  const rn = normalizeName(legalName || "");
  const bd = normalizeBirthdayIso(birthdayRaw ?? "") || "";

  if (phone !== sess.phone) return { ok: false, reason: "phone_mismatch" };
  if (codeIn !== sess.code) return { ok: false, reason: "wrong" };
  if (rn !== sess.nameLocked) return { ok: false, reason: "realname" };
  if (bd !== sess.birthdayLocked) return { ok: false, reason: "birthday" };

  activeSession = null;
  return { ok: /** @type {const} */ (true) };
}

export function clearTeacherPhoneOtpSession() {
  activeSession = null;
}
