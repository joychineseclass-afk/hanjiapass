/**
 * 老师档案：与 commerce store 的 teacher_profiles 合并，并持久化 workbench 扩展字段（审核台占位）。
 */
import { initCommerceStore, mutateCommerceStore, getCommerceStoreSync } from "./store.js";
import { VERIFICATION_STATUS } from "./enums.js";
import { DEMO_TEACHER_USER, getCurrentUser } from "./currentUser.js";
import { findTeacherProfileByUserId } from "./teacherProfileQueries.js";

const OVERLAY_KEY = "lumina_teacher_workbench_overlays_v1";

/**
 * 资质材料占位（不接真实文件，仅 metadata，后续可接对象存储）。
 * @typedef {Object} TeacherCredentialItemV1
 * @property {string} id
 * @property {string} [teacher_profile_id]
 * @property {string} title
 * @property {'language_certificate'|'teaching_certificate'|'identity'|'other'} kind
 * @property {string} [file_name]
 * @property {string} [mime_type]
 * @property {string} [file_size_label]
 * @property {string} [note]
 * @property {string} [uploaded_at]
 * @property {'local_placeholder'|string} [storage_status]
 */

/**
 * @typedef {Object} TeacherProfileOverlayV1
 * @property {string} [workbench_status]
 * @property {boolean} [account_suspended]
 * @property {string} [onboarding_status]
 * @property {string[]} [expertise_tags]
 * @property {string} [seller_type]
 * @property {string} [teacher_tier]
 * @property {string|null} [rejection_reason]
 * @property {string} [review_note] 审核员内部备注/可见备注
 * @property {string} [submitted_at] 老师提交审核时间 ISO
 * @property {string} [reviewed_at] 审核处理时间 ISO
 * @property {string[]} [teaching_targets] e.g. kids, hsk
 * @property {string[]} [teaching_languages] e.g. zh, en
 * @property {string} [experience_note]
 * @property {string} [introduction_note]
 * @property {string} [contact_note]
 * @property {'empty'|'draft'|'submitted'} [credential_status]
 * @property {TeacherCredentialItemV1[]} [credential_items]
 */

/**
 * @typedef {Object} WorkbenchOverlaysFile
 * @property {1} v
 * @property {Record<string, TeacherProfileOverlayV1>} byProfileId
 */

/**
 * @returns {WorkbenchOverlaysFile}
 */
function loadOverlays() {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return { v: 1, byProfileId: {} };
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || p.v !== 1) return { v: 1, byProfileId: {} };
    const by = p.byProfileId && typeof p.byProfileId === "object" ? p.byProfileId : {};
    return { v: 1, byProfileId: { ...by } };
  } catch {
    return { v: 1, byProfileId: {} };
  }
}

/**
 * @param {WorkbenchOverlaysFile} data
 */
function saveOverlays(data) {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} profileId
 * @param {Partial<TeacherProfileOverlayV1>} patch
 */
export function patchTeacherProfileOverlay(profileId, patch) {
  const o = loadOverlays();
  const prev = o.byProfileId[profileId] || {};
  o.byProfileId[profileId] = { ...prev, ...patch };
  saveOverlays(o);
}

/**
 * @param {string} profileId
 * @returns {TeacherProfileOverlayV1}
 */
export function getTeacherProfileOverlay(profileId) {
  const o = loadOverlays();
  return o.byProfileId[profileId] ? { ...o.byProfileId[profileId] } : {};
}

/**
 * @param {import('./schema.js').TeacherSellerProfile} row
 * @param {TeacherProfileOverlayV1} overlay
 * @param {string} workbenchStatus
 * @param {string|null} rejectionReason
 */
function buildDoc(row, overlay, workbenchStatus, rejectionReason) {
  const tier = overlay.teacher_tier || mapLevelToTier(row.teacher_level);
  const seller = overlay.seller_type || "individual";
  const onboarding = overlay.onboarding_status || (workbenchStatus === "approved" ? "completed" : "draft");
  const creds = Array.isArray(overlay.credential_items) ? overlay.credential_items : [];
  return {
    id: row.id,
    user_id: row.user_id,
    display_name: row.display_name,
    bio: row.bio ?? "",
    seller_type: seller,
    teacher_tier: tier,
    verification_status: row.verification_status,
    onboarding_status: onboarding,
    workbench_status: workbenchStatus,
    expertise_tags: Array.isArray(overlay.expertise_tags) ? overlay.expertise_tags.map(String) : [],
    teaching_targets: Array.isArray(overlay.teaching_targets) ? overlay.teaching_targets.map(String) : [],
    teaching_languages: Array.isArray(overlay.teaching_languages) ? overlay.teaching_languages.map(String) : [],
    experience_note: String(overlay.experience_note || ""),
    introduction_note: String(overlay.introduction_note || ""),
    contact_note: String(overlay.contact_note || ""),
    credential_status: overlay.credential_status || (creds.length ? "draft" : "empty"),
    credential_items: creds,
    rejection_reason: rejectionReason,
    review_note: overlay.review_note != null ? String(overlay.review_note) : null,
    submitted_at: overlay.submitted_at != null ? String(overlay.submitted_at) : null,
    reviewed_at: overlay.reviewed_at != null ? String(overlay.reviewed_at) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** @param {string} level */
function mapLevelToTier(level) {
  if (level === "seller_teacher") return "standard";
  if (level === "verified_teacher") return "standard";
  return "standard";
}

/**
 * @param {import('./schema.js').TeacherSellerProfile} row
 * @param {TeacherProfileOverlayV1} overlay
 * @returns {string}
 */
function deriveStatus(row, overlay) {
  if (overlay.account_suspended) return "suspended";
  if (overlay.workbench_status) return overlay.workbench_status;
  const v = row.verification_status;
  if (v === VERIFICATION_STATUS.approved) return "approved";
  if (v === VERIFICATION_STATUS.pending) return "pending_review";
  if (v === VERIFICATION_STATUS.rejected) return "rejected";
  if (v === VERIFICATION_STATUS.not_submitted) return "draft";
  return "draft";
}

/**
 * @param {import('./schema.js').TeacherSellerProfile} row
 * @param {string} st
 * @param {TeacherProfileOverlayV1} overlay
 * @returns {string|null}
 */
function deriveRejectionReason(_row, st, overlay) {
  if (st !== "rejected") return null;
  if (overlay.rejection_reason != null && String(overlay.rejection_reason).trim() !== "")
    return String(overlay.rejection_reason);
  return null;
}

/**
 * 合并 commerce 行与覆盖层，得到统一的老师档案（供 UI）。
 * @param {import('./schema.js').TeacherSellerProfile} row
 * @param {string} [profileId]
 * @returns {import('./teacherSelectors.js').ResolvedTeacherProfile}
 */
export function mergeTeacherProfileRow(row, profileId) {
  const id = profileId || row.id;
  const overlay = getTeacherProfileOverlay(id);
  const st = deriveStatus(row, overlay);
  const reason = deriveRejectionReason(row, st, overlay);
  return buildDoc(row, overlay, st, reason);
}

/**
 * @param {ReturnType<import('./store.js').getCommerceStoreSync>} snap
 * @param {string|null|undefined} teacherProfileId
 * @returns {import('./schema.js').TeacherSellerProfile|null}
 */
export function findCommerceTeacherProfile(snap, teacherProfileId) {
  if (!snap || !teacherProfileId) return null;
  const list = Array.isArray(snap.teacher_profiles) ? snap.teacher_profiles : [];
  return list.find((p) => p && p.id === teacherProfileId) || null;
}

/**
 * 确保演示老师 commerce 行存在；缺失时向 commerce 写入最小档案（不破坏其他 stage0 表）。
 * @param {import('./store.js').CommerceStoreSnapshot} snap
 * @param {import('./currentUser.js').CurrentUserV1} user
 * @returns {import('./schema.js').TeacherSellerProfile|null}
 */
function ensureDemoProfileInCommerce(snap, user) {
  if (user.teacherProfileId !== DEMO_TEACHER_USER.teacherProfileId) return null;
  const found = findCommerceTeacherProfile(snap, user.teacherProfileId);
  if (found) return found;
  const now = new Date().toISOString();
  const created = {
    id: DEMO_TEACHER_USER.teacherProfileId,
    user_id: user.id,
    display_name: String(user.name || "Teacher Demo"),
    bio: "",
    teacher_level: "seller_teacher",
    verification_status: "approved",
    seller_eligibility: "eligible_to_sell",
    payout_ready: false,
    payout_provider: null,
    provider_account_id: null,
    kyc_status: null,
    created_at: now,
    updated_at: now,
  };
  mutateCommerceStore((draft) => {
    if (!Array.isArray(draft.teacher_profiles)) draft.teacher_profiles = [];
    if (!findCommerceTeacherProfile(draft, user.teacherProfileId)) draft.teacher_profiles.push(created);
  });
  return findCommerceTeacherProfile(getCommerceStoreSync(), user.teacherProfileId);
}

/**
 * 异步：拉取 commerce 并返回当前老师合并档案；用于页面首屏。
 * @param {import('./currentUser.js').CurrentUserV1} [user]
 * @returns {Promise<{ profile: import('./teacherSelectors.js').ResolvedTeacherProfile|null, commerceRow: import('./schema.js').TeacherSellerProfile|null }>}
 */
export async function getMergedProfileForUser(user) {
  const u = user || getCurrentUser();
  const snap = await initCommerceStore();
  if (u.isGuest || u.id === "u_guest" || !u.roles || !u.roles.includes("teacher")) {
    return { profile: null, commerceRow: null };
  }
  let row = u.teacherProfileId ? findCommerceTeacherProfile(snap, u.teacherProfileId) : null;
  if (!row) {
    row = findTeacherProfileByUserId(snap, u.id) || null;
  }
  if (!row && u.teacherProfileId === DEMO_TEACHER_USER.teacherProfileId) {
    row = ensureDemoProfileInCommerce(snap, u);
  }
  if (!row) {
    return { profile: null, commerceRow: null };
  }
  const profileId = row.id;
  return { profile: mergeTeacherProfileRow(row, profileId), commerceRow: row };
}

export const TEACHER_OVERLAY_STORAGE_KEY = OVERLAY_KEY;
