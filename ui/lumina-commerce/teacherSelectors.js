/**
 * 教师身份 / 工作台 gating 的统一 selector（页面勿自行拼数据）。
 */
import { USER_ROLE } from "./enums.js";
import { getCurrentUser } from "./currentUser.js";
import { getMergedProfileForUser, ensureCurrentUserMatchesCommerceTeacher } from "./teacherProfileStore.js";
import { initCommerceStore } from "./store.js";
import {
  canOfferDemoTeacherMigration,
  isDevTeacherMigrationUIEnabled,
} from "./teacherProfileService.js";

/**
 * 工作台 gating 状态：与产品文案一致，后续审核流承接。
 * @typedef {'no_profile'|'draft'|'pending_review'|'approved'|'rejected'|'suspended'} TeacherWorkbenchStatus
 */

/**
 * @typedef {Object} ResolvedTeacherProfile
 * @property {string} id
 * @property {string} user_id
 * @property {string} display_name
 * @property {string} bio
 * @property {string} seller_type
 * @property {string} teacher_tier
 * @property {string} verification_status
 * @property {string} onboarding_status
 * @property {TeacherWorkbenchStatus} workbench_status
 * @property {string[]} expertise_tags
 * @property {string[]} [teaching_targets]
 * @property {string[]} [teaching_languages]
 * @property {string} [experience_note]
 * @property {string} [introduction_note]
 * @property {string} [contact_note]
 * @property {string} [credential_status]
 * @property {import('./teacherProfileStore.js').TeacherCredentialItemV1[]} [credential_items]
 * @property {string|null} rejection_reason
 * @property {string|null} [review_note]
 * @property {string|null} [submitted_at]
 * @property {string|null} [reviewed_at]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} TeacherPageContext
 * @property {import('./currentUser.js').CurrentUserV1} user
 * @property {boolean} isLoggedIn
 * @property {boolean} isTeacherRole
 * @property {ResolvedTeacherProfile|null} profile
 * @property {TeacherWorkbenchStatus|'not_teacher'|'guest'} workbenchStatus
 * @property {boolean} hasCommerceProfile
 * @property {boolean} isApproved
 * @property {boolean} [showDemoTakeoverCta] 已登录但无绑定时：可显示「接管演示」
 * @property {boolean} [showDevForceApproveCta] 已绑定但非 approved 时：开发态「强制批准」
 */

/**
 * @param {import('./currentUser.js').CurrentUserV1} user
 * @returns {boolean}
 */
export function userIsTeacher(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.includes(USER_ROLE.teacher);
}

/**
 * @param {import('./currentUser.js').CurrentUserV1} user
 * @param {ResolvedTeacherProfile|null} profile
 * @param {boolean} hasRow
 * @returns {TeacherWorkbenchStatus|'not_teacher'}
 */
/**
 * 工作台 gating 仅依据「是否已有合并后的老师 profile」与 merged workbench 状态，不依赖 currentUser.roles 里是否有 teacher（避免仅 learner 误判）。
 * @param {import('./currentUser.js').CurrentUserV1} user
 * @param {ResolvedTeacherProfile|null} profile
 * @param {boolean} hasRow
 * @returns {TeacherWorkbenchStatus|'not_teacher'}
 */
export function resolveWorkbenchGate(user, profile, hasRow) {
  if (!hasRow || !profile) {
    if (hasRow && !profile) return "no_profile";
    return "not_teacher";
  }
  if (!user.teacherProfileId) return "no_profile";
  return profile.workbench_status;
}

/**
 * 异步构建教师页所需上下文（含 commerce 初始化 + 档案合并）。
 * @returns {Promise<TeacherPageContext>}
 */
function isUserLoggedIn(user) {
  return Boolean(user && user.id && user.id !== "u_guest" && !user.isGuest);
}

export async function getTeacherPageContext() {
  const user = getCurrentUser();
  const isLoggedIn = isUserLoggedIn(user);
  if (!isLoggedIn) {
    return {
      user,
      isLoggedIn: false,
      isTeacherRole: false,
      profile: null,
      workbenchStatus: /** @type {const} */ ("guest"),
      hasCommerceProfile: false,
      isApproved: false,
      showDemoTakeoverCta: false,
      showDevForceApproveCta: false,
    };
  }
  await initCommerceStore();
  await ensureCurrentUserMatchesCommerceTeacher();
  const u0 = getCurrentUser();
  const { profile, commerceRow } = await getMergedProfileForUser();
  const u1 = getCurrentUser();
  const hasRow = Boolean(commerceRow);
  const devUi = await isDevTeacherMigrationUIEnabled();

  if (!commerceRow || !profile) {
    const migr = await canOfferDemoTeacherMigration(String(u0.id));
    return {
      user: u1,
      isLoggedIn: true,
      isTeacherRole: false,
      profile: null,
      workbenchStatus: /** @type {const} */ ("not_teacher"),
      hasCommerceProfile: false,
      isApproved: false,
      showDemoTakeoverCta: Boolean(migr.show && devUi),
      showDevForceApproveCta: false,
    };
  }

  const gate = resolveWorkbenchGate(u1, profile, hasRow);
  const isApproved = profile.workbench_status === "approved";
  return {
    user: getCurrentUser(),
    isLoggedIn: true,
    isTeacherRole: true,
    profile,
    workbenchStatus: gate,
    hasCommerceProfile: hasRow,
    isApproved,
    showDemoTakeoverCta: false,
    showDevForceApproveCta: devUi && !isApproved,
  };
}

/**
 * 若仅需 listings 等，可只 init commerce。
 * @returns {Promise<import('./store.js').CommerceStoreSnapshot | null>}
 */
export async function ensureCommerceForTeacher() {
  return initCommerceStore();
}
