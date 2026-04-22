/**
 * 老师档案创建 / 保存 / 提交审核（commerce teacher_profiles + overlay）。
 */
import { TEACHER_LEVEL, SELLER_ELIGIBILITY, USER_ROLE, VERIFICATION_STATUS } from "./enums.js";
import { initCommerceStore, mutateCommerceStore, getCommerceStoreSync } from "./store.js";
import { getCurrentUser, setCurrentUser } from "./currentUser.js";
import { patchTeacherProfileOverlay } from "./teacherProfileStore.js";
import { findTeacherProfileByUserId } from "./teacherProfileQueries.js";

function uid(p) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export { findTeacherProfileByUserId as findProfileByUserId } from "./teacherProfileQueries.js";

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
  });
  setCurrentUser({
    ...u,
    roles: Array.from(new Set([...u.roles, USER_ROLE.teacher])),
    teacherProfileId: profileId,
  });
  return { ok: true, profileId };
}

/**
 * @param {string} profileId
 * @param {{ display_name?: string, bio?: string, expertiseTagsStr?: string, seller_type?: string }} p
 * @param {string} ownerUserId
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
export async function saveTeacherProfileFields(profileId, p, ownerUserId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row || row.user_id !== ownerUserId) return { ok: false, code: "forbidden" };
  const tags = String(p.expertiseTagsStr || "")
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const now = new Date().toISOString();
  mutateCommerceStore((draft) => {
    const L = draft.teacher_profiles.find((x) => x.id === profileId);
    if (!L) return;
    if (p.display_name != null) L.display_name = String(p.display_name).trim() || L.display_name;
    if (p.bio != null) L.bio = String(p.bio);
    L.updated_at = now;
  });
  const seller = p.seller_type || "individual";
  patchTeacherProfileOverlay(profileId, {
    expertise_tags: tags,
    seller_type: seller,
    onboarding_status: "completed",
  });
  return { ok: true };
}

/**
 * 教师档案：draft / not_submitted → pending 审核
 * @param {string} profileId
 * @param {string} ownerUserId
 */
export async function submitTeacherProfileForReview(profileId, ownerUserId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap && snap.teacher_profiles ? snap.teacher_profiles.find((x) => x.id === profileId) : null;
  if (!row || row.user_id !== ownerUserId) return { ok: false, code: "forbidden" };
  const st = String(row.verification_status);
  if (st === VERIFICATION_STATUS.pending) return { ok: true, code: "already_pending" };
  if (st === VERIFICATION_STATUS.approved) return { ok: true, code: "already_approved" };
  const now = new Date().toISOString();
  mutateCommerceStore((draft) => {
    const L = draft.teacher_profiles.find((x) => x.id === profileId);
    if (!L) return;
    L.verification_status = VERIFICATION_STATUS.pending;
    L.updated_at = now;
  });
  patchTeacherProfileOverlay(profileId, { workbench_status: "pending_review" });
  return { ok: true };
}
