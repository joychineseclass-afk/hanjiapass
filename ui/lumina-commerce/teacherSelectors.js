/**
 * 教师身份 / 工作台 gating 的统一 selector（页面勿自行拼数据）。
 */
import { USER_ROLE } from "./enums.js";
import { getCurrentUser } from "./currentUser.js";
import { getMergedProfileForUser } from "./teacherProfileStore.js";
import { initCommerceStore } from "./store.js";

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
 * @property {string|null} rejection_reason
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
export function resolveWorkbenchGate(user, profile, hasRow) {
  if (!userIsTeacher(user)) return "not_teacher";
  if (!user.teacherProfileId || !hasRow || !profile) return "no_profile";
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
    };
  }
  const isTeacherRole = userIsTeacher(user);
  if (!isTeacherRole) {
    return {
      user,
      isLoggedIn: true,
      isTeacherRole: false,
      profile: null,
      workbenchStatus: /** @type {const} */ ("not_teacher"),
      hasCommerceProfile: false,
      isApproved: false,
    };
  }
  const { profile, commerceRow } = await getMergedProfileForUser(user);
  const hasRow = Boolean(commerceRow);
  const gate = resolveWorkbenchGate(user, profile, hasRow);
  const isApproved = profile != null && profile.workbench_status === "approved";
  return {
    user,
    isLoggedIn: true,
    isTeacherRole: true,
    profile,
    workbenchStatus: gate,
    hasCommerceProfile: hasRow,
    isApproved,
  };
}

/**
 * 若仅需 listings 等，可只 init commerce。
 * @returns {Promise<import('./store.js').CommerceStoreSnapshot | null>}
 */
export async function ensureCommerceForTeacher() {
  return initCommerceStore();
}
