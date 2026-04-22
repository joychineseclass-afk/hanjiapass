/**
 * 老师档案创建 / 保存 / 提交审核 / 审核员处理（commerce teacher_profiles + overlay）。
 */
import { SELLER_ELIGIBILITY, TEACHER_LEVEL, USER_ROLE, VERIFICATION_STATUS } from "./enums.js";
import { initCommerceStore, mutateCommerceStore, getCommerceStoreSync } from "./store.js";
import { getCurrentUser, setCurrentUser } from "./currentUser.js";
import { getTeacherProfileOverlay, patchTeacherProfileOverlay } from "./teacherProfileStore.js";
import { findTeacherProfileByUserId } from "./teacherProfileQueries.js";

function uid(p) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function splitTags(s) {
  return String(s || "")
    .split(/[,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 解析多选类字段（如 kids,hsk 或 竖线）
 * @param {string} s
 * @param {string[]} allowed
 */
function parseEnumList(s, allowed) {
  const set = new Set(allowed);
  return splitTags(String(s).replace(/\|/g, ","))
    .map((x) => x.toLowerCase())
    .filter((x) => set.has(x));
}

export { findTeacherProfileByUserId as findProfileByUserId } from "./teacherProfileQueries.js";

const TEACHING_TARGETS = ["kids", "hsk", "adults", "business"];
const TEACHING_LANGS = ["zh", "kr", "en", "jp"];

/**
 * 注册「成为老师」时创建主档案；同一 user 仅一条主记录。
 * @param {string} userId
 * @param {string} displayName
 * @returns {Promise<{ ok: true, profileId: string } | { ok: false, code: string }>}
 */
export async function ensureTeacherProfileForUser(userId, displayName) {
  const u = getCurrentUser();
  if (u.id === "u_guest" || !userId) return { ok: false, code: "not_authenticated" };
  if (u.id !== userId) return { ok: false, code: "user_mismatch" };
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const existing = findTeacherProfileByUserId(snap, userId);
  if (existing) {
    if (!u.roles.includes(USER_ROLE.teacher) || u.teacherProfileId !== existing.id) {
      setCurrentUser({
        ...u,
        roles: Array.from(new Set([...u.roles, USER_ROLE.teacher])),
        teacherProfileId: existing.id,
      });
    }
    return { ok: true, profileId: existing.id };
  }
  const profileId = uid("tp");
  const now = new Date().toISOString();
  const name = String(displayName || u.name || "Teacher").trim() || "Teacher";
  mutateCommerceStore((draft) => {
    if (!Array.isArray(draft.teacher_profiles)) draft.teacher_profiles = [];
    draft.teacher_profiles.push({
      id: profileId,
      user_id: userId,
      display_name: name,
      bio: "",
      teacher_level: TEACHER_LEVEL.seller_teacher,
      verification_status: VERIFICATION_STATUS.not_submitted,
      seller_eligibility: SELLER_ELIGIBILITY.internal_use_only,
      payout_ready: false,
      payout_provider: null,
      provider_account_id: null,
      kyc_status: null,
      created_at: now,
      updated_at: now,
    });
  });
  patchTeacherProfileOverlay(profileId, {
    workbench_status: "draft",
    onboarding_status: "draft",
    seller_type: "individual",
    teacher_tier: "standard",
    expertise_tags: [],
    teaching_targets: [],
    teaching_languages: [],
    experience_note: "",
    introduction_note: "",
    contact_note: "",
    credential_status: "empty",
    credential_items: [],
  });
  setCurrentUser({
    ...u,
    roles: Array.from(new Set([...u.roles, USER_ROLE.teacher])),
    teacherProfileId: profileId,
  });
  return { ok: true, profileId };
}

/**
 * @typedef {import('./teacherProfileStore.js').TeacherCredentialItemV1} TeacherCredentialItemV1
 */

/**
 * @param {string} profileId
 * @param {object} p
 * @param {string} ownerUserId
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
export async function saveTeacherProfileFields(profileId, p, ownerUserId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row || row.user_id !== ownerUserId) return { ok: false, code: "forbidden" };
  const st = String(row.verification_status);
  if (st === VERIFICATION_STATUS.pending) return { ok: false, code: "locked_pending" };

  const tags = p.expertiseTagsStr != null ? splitTags(String(p.expertiseTagsStr)) : undefined;
  const tTargets = p.teachingTargetsStr != null ? parseEnumList(String(p.teachingTargetsStr), TEACHING_TARGETS) : undefined;
  const tLangs = p.teachingLanguagesStr != null ? parseEnumList(String(p.teachingLanguagesStr), TEACHING_LANGS) : undefined;
  const now = new Date().toISOString();
  mutateCommerceStore((draft) => {
    const L = draft.teacher_profiles.find((x) => x.id === profileId);
    if (!L) return;
    if (p.display_name != null) L.display_name = String(p.display_name).trim() || L.display_name;
    if (p.bio != null) L.bio = String(p.bio);
    L.updated_at = now;
  });
  const seller = p.seller_type || "individual";
  const o = getTeacherProfileOverlay(profileId);
  const credItems = Array.isArray(p.credential_items) ? p.credential_items : o.credential_items;
  const credStatus = (() => {
    if (p.credential_status != null) return String(p.credential_status);
    const n = Array.isArray(credItems) ? credItems.length : 0;
    if (n > 0) return o.credential_status === "submitted" ? "submitted" : "draft";
    return o.credential_status || "empty";
  })();

  /** @type {Record<string, unknown>} */
  const patch = {
    expertise_tags: tags !== undefined ? tags : o.expertise_tags || [],
    teaching_targets: tTargets !== undefined ? tTargets : o.teaching_targets || [],
    teaching_languages: tLangs !== undefined ? tLangs : o.teaching_languages || [],
    seller_type: seller,
    onboarding_status: "completed",
    credential_status: credStatus,
  };
  if (p.experience_note != null) patch.experience_note = String(p.experience_note);
  if (p.introduction_note != null) patch.introduction_note = String(p.introduction_note);
  if (p.contact_note != null) patch.contact_note = String(p.contact_note);
  if (Array.isArray(p.credential_items)) {
    patch.credential_items = p.credential_items.map((c) => ({
      ...c,
      teacher_profile_id: profileId,
    }));
  }
  patchTeacherProfileOverlay(profileId, /** @type {import('./teacherProfileStore.js').TeacherProfileOverlayV1} */ (patch));
  return { ok: true };
}

/**
 * @param {string} profileId
 * @param {string} ownerUserId
 * @returns {Promise<
 *   | { ok: true; code?: 'ok'; softWarning?: 'no_credentials' }
 *   | { ok: false; code: string }
 * >}
 */
export async function submitTeacherProfileForReview(profileId, ownerUserId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row || row.user_id !== ownerUserId) return { ok: false, code: "forbidden" };
  const st = String(row.verification_status);
  if (st === VERIFICATION_STATUS.pending) return { ok: true, code: "already_pending" };
  if (st === VERIFICATION_STATUS.approved) return { ok: true, code: "already_approved" };

  const o = getTeacherProfileOverlay(profileId);
  const display = String(row.display_name || "").trim();
  if (!display) return { ok: false, code: "missing_display_name" };
  const bio = String(row.bio || "").trim();
  const intro = String(o.introduction_note || "").trim();
  if (!bio && !intro) return { ok: false, code: "missing_bio_or_intro" };
  const tags = Array.isArray(o.expertise_tags) ? o.expertise_tags : [];
  const targets = Array.isArray(o.teaching_targets) ? o.teaching_targets : [];
  if (tags.length === 0 && targets.length === 0) return { ok: false, code: "missing_scope" };

  const now = new Date().toISOString();
  const creds = Array.isArray(o.credential_items) ? o.credential_items : [];
  const softWarning = creds.length === 0 ? /** @type {const} */ ("no_credentials") : undefined;

  mutateCommerceStore((draft) => {
    const L = draft.teacher_profiles.find((x) => x.id === profileId);
    if (!L) return;
    L.verification_status = VERIFICATION_STATUS.pending;
    L.updated_at = now;
  });
  patchTeacherProfileOverlay(profileId, {
    workbench_status: "pending_review",
    submitted_at: now,
    credential_status: creds.length ? "submitted" : o.credential_status || "empty",
  });
  return { ok: true, code: "ok", softWarning };
}

/**
 * 审核员：通过老师档案申请。
 * @param {string} profileId
 * @param {string} reviewerUserId
 * @param {string} [reviewNote]
 */
export async function approveTeacherProfileByReviewer(profileId, reviewerUserId, reviewNote) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row) return { ok: false, code: "not_found" };
  if (String(row.verification_status) !== VERIFICATION_STATUS.pending) return { ok: false, code: "not_pending" };
  const now = new Date().toISOString();
  mutateCommerceStore((draft) => {
    const L = draft.teacher_profiles.find((x) => x.id === profileId);
    if (!L) return;
    L.verification_status = VERIFICATION_STATUS.approved;
    L.seller_eligibility = SELLER_ELIGIBILITY.eligible_to_sell;
    L.updated_at = now;
  });
  patchTeacherProfileOverlay(profileId, {
    workbench_status: "approved",
    reviewed_at: now,
    review_note: reviewNote != null ? String(reviewNote) : "",
    rejection_reason: null,
  });
  return { ok: true };
}

/**
 * 审核员：拒绝老师档案申请。
 * @param {string} profileId
 * @param {string} reviewerUserId
 * @param {string} rejectionReason
 * @param {string} [reviewNote]
 */
export async function rejectTeacherProfileByReviewer(profileId, reviewerUserId, rejectionReason, reviewNote) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row) return { ok: false, code: "not_found" };
  if (String(row.verification_status) !== VERIFICATION_STATUS.pending) return { ok: false, code: "not_pending" };
  const now = new Date().toISOString();
  const reason = String(rejectionReason || "").trim() || "—";
  mutateCommerceStore((draft) => {
    const L = draft.teacher_profiles.find((x) => x.id === profileId);
    if (!L) return;
    L.verification_status = VERIFICATION_STATUS.rejected;
    L.updated_at = now;
  });
  patchTeacherProfileOverlay(profileId, {
    workbench_status: "rejected",
    reviewed_at: now,
    rejection_reason: reason,
    review_note: reviewNote != null ? String(reviewNote) : "",
  });
  return { ok: true };
}

/**
 * 资质占位：添加一条。不调文件 API。
 * @param {string} profileId
 * @param {string} ownerUserId
 * @param {Partial<import('./teacherProfileStore.js').TeacherCredentialItemV1>} item
 */
export async function addTeacherCredentialPlaceholder(profileId, ownerUserId, item) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row || row.user_id !== ownerUserId) return { ok: false, code: "forbidden" };
  if (String(row.verification_status) === VERIFICATION_STATUS.pending) return { ok: false, code: "locked" };
  const o = getTeacherProfileOverlay(profileId);
  const list = Array.isArray(o.credential_items) ? [...o.credential_items] : [];
  const id = item.id && String(item.id).startsWith("cred_") ? String(item.id) : uid("cred");
  const now = new Date().toISOString();
  const kind = item.kind && ["language_certificate", "teaching_certificate", "identity", "other"].includes(String(item.kind))
    ? String(item.kind)
    : "other";
  list.push({
    id,
    teacher_profile_id: profileId,
    title: String(item.title || "Document").trim() || "Document",
    kind: /** @type {any} */ (kind),
    file_name: String(item.file_name || "placeholder.pdf"),
    mime_type: String(item.mime_type || "application/pdf"),
    file_size_label: String(item.file_size_label || "—"),
    note: item.note != null ? String(item.note) : "",
    uploaded_at: now,
    storage_status: "local_placeholder",
  });
  patchTeacherProfileOverlay(profileId, { credential_items: list, credential_status: list.length ? "draft" : "empty" });
  return { ok: true, id };
}

/**
 * @param {string} profileId
 * @param {string} ownerUserId
 * @param {string} credId
 */
export async function removeTeacherCredentialItem(profileId, ownerUserId, credId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row || row.user_id !== ownerUserId) return { ok: false, code: "forbidden" };
  if (String(row.verification_status) === VERIFICATION_STATUS.pending) return { ok: false, code: "locked" };
  const o = getTeacherProfileOverlay(profileId);
  const list = (Array.isArray(o.credential_items) ? o.credential_items : []).filter((c) => c && c.id !== credId);
  patchTeacherProfileOverlay(profileId, { credential_items: list, credential_status: list.length ? "draft" : "empty" });
  return { ok: true };
}
