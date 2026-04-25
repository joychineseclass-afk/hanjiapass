/**
 * 最小账号动作：注册 / 登录 / 登出 + 与 lumina currentUser 同步。
 * 实际持久化与凭据比对由 `authStore` 选定的 provider 完成；此处仅编排 UI 与 commerce 同步。
 */
import {
  findUserById,
  upsertUser,
  loadSession,
  saveSession,
  normAccount,
  authStore,
  emitAuthStateChanged,
} from "./authStore.js";
import { setCurrentUser, GUEST_USER, getCurrentUser } from "../lumina-commerce/currentUser.js";
import { USER_ROLE } from "../lumina-commerce/enums.js";
import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { findTeacherProfileByUserId } from "../lumina-commerce/teacherProfileQueries.js";
import { ensureTeacherProfileForUser as ensureTeacherProfile } from "../lumina-commerce/teacherProfileService.js";
import { ensureCurrentUserMatchesCommerceTeacher } from "../lumina-commerce/teacherProfileStore.js";

/**
 * @typedef {Object} AuthUserShape
 * @property {string} id
 * @property {string} displayName
 * @property {string} email
 */

/**
 * 从本地 Lumina 角色 + commerce 老师档案同步 currentUser。
 * @param {{ id: string, displayName: string, email: string }} authUser
 */
async function applyProfileToCurrentUser(authUser) {
  const stored = findUserById(authUser.id);
  const teacherRole = stored?.roles?.teacher ?? "none";
  const studentRole = stored?.roles?.student !== "none" ? "active" : "none";

  if (teacherRole === "active") {
    await initCommerceStore();
    const snap0 = getCommerceStoreSync();
    const existing = snap0 ? findTeacherProfileByUserId(snap0, authUser.id) : null;
    if (!existing) {
      await ensureTeacherProfile(authUser.id, String(stored?.displayName || authUser.displayName || "Teacher"));
    }
  }

  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap ? findTeacherProfileByUserId(snap, authUser.id) : null;

  const roles = /** @type {string[]} */ ([]);
  if (studentRole === "active") roles.push(USER_ROLE.student);
  if (teacherRole === "active" && row) roles.push(USER_ROLE.teacher);
  if (roles.length === 0) roles.push(USER_ROLE.student);

  setCurrentUser({
    id: authUser.id,
    name: String(stored?.displayName || authUser.displayName),
    roles,
    teacherProfileId: teacherRole === "active" && row ? row.id : null,
    isGuest: false,
  });
  await ensureCurrentUserMatchesCommerceTeacher();
}

/**
 * 会话存在时，将 commerce 老师档案同步到 currentUser（登录后 / 页面加载）。
 */
export async function hydrateCurrentUserFromSession() {
  const s = loadSession();
  if (!s.userId) {
    setCurrentUser({ ...GUEST_USER, roles: [...GUEST_USER.roles], isGuest: true, teacherProfileId: null });
    return;
  }
  const u = findUserById(s.userId);
  if (!u) {
    saveSession(null);
    setCurrentUser({ ...GUEST_USER, roles: [...GUEST_USER.roles], isGuest: true, teacherProfileId: null });
    return;
  }
  await applyProfileToCurrentUser({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
  });
}

/**
 * 注册并立即建立会话（本阶段无邮箱验证）。
 * @param {{ name: string, email: string, password: string }} p
 * @returns {Promise<{ ok: true, user: import('./providers/authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
export async function registerAndLogin(p) {
  const r = await registerUser(p);
  if (!r.ok) return r;
  saveSession(r.user.id);
  await applyProfileToCurrentUser({ id: r.user.id, displayName: r.user.displayName, email: r.user.email });
  emitAuthStateChanged();
  return { ok: true, user: r.user };
}

/**
 * 创建账号（由 authStore 委托 demo 或未来 remote；不在此实现 localStorage）。
 * @param {{ name: string, email: string, password: string }} p
 * @returns {Promise<{ ok: true, user: import('./providers/authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
export async function registerUser(p) {
  return authStore.signUp(p);
}

/**
 * @param {{ email: string, password: string }} p
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
export async function loginUser(p) {
  const r = await authStore.signIn(p);
  if (!r.ok) return r;
  const u = r.user;
  await applyProfileToCurrentUser({ id: u.id, displayName: u.displayName, email: u.email });
  emitAuthStateChanged();
  return { ok: true };
}

export async function logoutUser() {
  await authStore.signOut();
  setCurrentUser({ ...GUEST_USER, roles: [...GUEST_USER.roles], isGuest: true, teacherProfileId: null });
  emitAuthStateChanged();
}

/**
 * @returns {import('./providers/authTypes.js').AuthUserV1 | null}
 */
export function getCurrentSessionAuthUser() {
  const s = loadSession();
  if (!s.userId) return null;
  return findUserById(s.userId) || null;
}

/**
 * 已登录用户点击「申请成为老师」：创建主 teacher profile 并刷新 currentUser。
 */
export async function applyToBecomeTeacher() {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const r = await ensureTeacherProfile(au.id, au.displayName);
  if (!r.ok) return r;
  await hydrateCurrentUserFromSession();
  emitAuthStateChanged();
  return r;
}

export { getResolvedSessionLandingHash as getDefaultPostAuthTargetHash } from "./resolveSessionRoute.js";
export { getResolvedHashAfterRegisterSuccess } from "./resolveSessionRoute.js";

/**
 * 「我要学习中文」：标记 onboarding 完成
 */
export async function markOnboardingCompletedStudentPath() {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  if (!full) return { ok: false, code: "not_found" };
  upsertUser({
    ...full,
    onboardingCompleted: true,
    updated_at: new Date().toISOString(),
  });
  await hydrateCurrentUserFromSession();
  emitAuthStateChanged();
  return { ok: true };
}

/**
 * 提交教师申请：teacher → pending，写入 teacherProfile
 * @param {{ displayName: string, intro: string, teachingTypes: string[], experienceLevel: string, note?: string }} p
 */
export async function submitTeacherApplication(p) {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  if (!full) return { ok: false, code: "not_found" };
  const teacherProfile = {
    displayName: String(p.displayName || "").trim(),
    intro: String(p.intro || "").trim(),
    teachingTypes: Array.isArray(p.teachingTypes) ? p.teachingTypes.map((x) => String(x)) : [],
    experienceLevel: String(p.experienceLevel || "").trim(),
    note: p.note != null ? String(p.note) : "",
    submittedAt: new Date().toISOString(),
  };
  upsertUser({
    ...full,
    onboardingCompleted: true,
    roles: { student: "active", teacher: "pending" },
    teacherProfile,
    updated_at: new Date().toISOString(),
  });
  await hydrateCurrentUserFromSession();
  emitAuthStateChanged();
  return { ok: true };
}

/**
 * 本地开发/验收：将 teacher 标为 active 并确保 commerce 档案为已批准（Mock）
 */
export async function setMockTeacherRoleActiveForTest() {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  if (!full) return { ok: false, code: "not_found" };
  upsertUser({
    ...full,
    onboardingCompleted: true,
    roles: { ...full.roles, student: "active", teacher: "active" },
    updated_at: new Date().toISOString(),
  });
  await hydrateCurrentUserFromSession();
  const { devForceApproveCurrentUserTeacherProfile } = await import("../lumina-commerce/teacherProfileService.js");
  const r = await devForceApproveCurrentUserTeacherProfile(String(au.id));
  await hydrateCurrentUserFromSession();
  emitAuthStateChanged();
  return r;
}

/**
 * 开发/回归：切换当前用户 teacher 状态（Mock，无后端）
 * 启用 Dev UI 时亦挂载到 `window.__LUMINA_AUTH_DEV__`（见 `app.js` / docs）
 * @param {'none'|'pending'|'rejected'|'active'} state
 */
export async function devSetMockTeacherState(state) {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  if (!full) return { ok: false, code: "not_found" };
  const now = new Date().toISOString();
  const base = { ...full, onboardingCompleted: true, updated_at: now };
  if (state === "active") {
    return setMockTeacherRoleActiveForTest();
  }
  if (state === "none") {
    upsertUser({
      ...base,
      roles: { ...full.roles, student: "active", teacher: "none" },
    });
  } else if (state === "pending") {
    const tp = full.teacherProfile || {
      displayName: full.displayName,
      intro: "(mock pending)",
      teachingTypes: ["hsk"],
      experienceLevel: "no_experience",
      note: "",
      submittedAt: now,
    };
    upsertUser({
      ...base,
      roles: { ...full.roles, student: "active", teacher: "pending" },
      teacherProfile: { ...tp, submittedAt: now },
    });
  } else if (state === "rejected") {
    const tp = full.teacherProfile || {
      displayName: full.displayName,
      intro: "(mock rejected)",
      teachingTypes: ["hsk"],
      experienceLevel: "no_experience",
      note: "",
      submittedAt: now,
    };
    upsertUser({
      ...base,
      roles: { ...full.roles, student: "active", teacher: "rejected" },
      teacherProfile: { ...tp, submittedAt: now },
    });
  } else {
    return { ok: false, code: "invalid_state" };
  }
  await hydrateCurrentUserFromSession();
  emitAuthStateChanged();
  return { ok: true };
}

/**
 * 开发/回归：将 onboarding 打回 false，用于重测
 */
export async function devResetOnboardingForTest() {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  if (!full) return { ok: false, code: "not_found" };
  upsertUser({
    ...full,
    onboardingCompleted: false,
    updated_at: new Date().toISOString(),
  });
  await hydrateCurrentUserFromSession();
  emitAuthStateChanged();
  return { ok: true };
}

/**
 * 供导航栏等读取 teacher 分栏状态
 * @returns {'none'|'pending'|'active'|'rejected'|null} null 表示未登录
 */
export function getTeacherNavRoleState() {
  const u = getCurrentSessionAuthUser();
  if (!u) return null;
  const tr = u.roles?.teacher ?? "none";
  if (tr && tr !== "none") return tr;
  const cu = getCurrentUser();
  if (cu?.id === u.id && Array.isArray(cu.roles) && cu.roles.includes(USER_ROLE.teacher)) {
    return "active";
  }
  return tr;
}

/** @deprecated 直接 import teacherProfileService */
export { ensureTeacherProfileForUser } from "../lumina-commerce/teacherProfileService.js";
