/**
 * 最小账号动作：注册 / 登录 / 登出 + 与 lumina currentUser 同步。
 * 密码为轻量占位哈希，非生产级。
 */
import {
  loadAuthUsers,
  findUserByEmail,
  findUserById,
  upsertUser,
  loadSession,
  saveSession,
} from "./authStore.js";
import { setCurrentUser, GUEST_USER } from "../lumina-commerce/currentUser.js";
import { USER_ROLE } from "../lumina-commerce/enums.js";
import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { findTeacherProfileByUserId } from "../lumina-commerce/teacherProfileQueries.js";
import { ensureTeacherProfileForUser as ensureTeacherProfile } from "../lumina-commerce/teacherProfileService.js";

/**
 * @typedef {Object} AuthUserShape
 * @property {string} id
 * @property {string} displayName
 * @property {string} email
 */

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  const s = String(password || "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  const salt = "lumina_auth_v1";
  return `h1_${(h >>> 0).toString(16)}_${hashPasswordInner(s + salt)}`;
}

function hashPasswordInner(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * 从 commerce 中的老师档案推导 currentUser 的角色与 teacherProfileId。
 * @param {import('../lumina-commerce/currentUser.js').AuthUserShape} authUser
 */
async function applyProfileToCurrentUser(authUser) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const row = snap ? findTeacherProfileByUserId(snap, authUser.id) : null;
  if (row) {
    setCurrentUser({
      id: authUser.id,
      name: authUser.displayName,
      roles: [USER_ROLE.student, USER_ROLE.teacher],
      teacherProfileId: row.id,
      isGuest: false,
    });
    return;
  }
  setCurrentUser({
    id: authUser.id,
    name: authUser.displayName,
    roles: [USER_ROLE.student],
    teacherProfileId: null,
    isGuest: false,
  });
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
 * @param {{ name: string, email: string, password: string }} p
 * @returns {{ ok: true, user: import('./authStore.js').AuthUserV1 } | { ok: false, code: string }}
 */
/**
 * 注册并立即建立会话（本阶段无邮箱验证）。
 * @param {{ name: string, email: string, password: string }} p
 */
export async function registerAndLogin(p) {
  const r = registerUser(p);
  if (!r.ok) return r;
  saveSession(r.user.id);
  await applyProfileToCurrentUser({ id: r.user.id, displayName: r.user.displayName, email: r.user.email });
  try {
    window.dispatchEvent(new CustomEvent("joy:authChanged"));
  } catch {
    /* */
  }
  return { ok: true, user: r.user };
}

export function registerUser(p) {
  const displayName = String(p.name || "").trim();
  const email = String(p.email || "").trim().toLowerCase();
  const password = String(p.password || "");
  if (!email) return { ok: false, code: "email_required" };
  if (!password) return { ok: false, code: "password_required" };
  if (findUserByEmail(email)) return { ok: false, code: "email_taken" };
  const user = {
    id: uid("u"),
    email,
    displayName: displayName || email.split("@")[0] || "User",
    passwordHash: hashPassword(password),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  upsertUser(user);
  return { ok: true, user };
}

/**
 * @param {{ email: string, password: string }} p
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
export async function loginUser(p) {
  const email = String(p.email || "").trim().toLowerCase();
  const password = String(p.password || "");
  if (!email) return { ok: false, code: "email_required" };
  if (!password) return { ok: false, code: "password_required" };
  const u = findUserByEmail(email);
  if (!u) return { ok: false, code: "invalid_credentials" };
  if (u.passwordHash !== hashPassword(password)) return { ok: false, code: "invalid_credentials" };
  saveSession(u.id);
  await applyProfileToCurrentUser({ id: u.id, displayName: u.displayName, email: u.email });
  try {
    window.dispatchEvent(new CustomEvent("joy:authChanged"));
  } catch {
    /* */
  }
  return { ok: true };
}

export function logoutUser() {
  saveSession(null);
  setCurrentUser({ ...GUEST_USER, roles: [...GUEST_USER.roles], isGuest: true, teacherProfileId: null });
  try {
    window.dispatchEvent(new CustomEvent("joy:authChanged"));
  } catch {
    /* */
  }
}

/**
 * @returns {import('./authStore.js').AuthUserV1 | null}
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
  try {
    window.dispatchEvent(new CustomEvent("joy:authChanged"));
  } catch {
    /* */
  }
  return r;
}

/** @deprecated 直接 import teacherProfileService */
export { ensureTeacherProfileForUser } from "../lumina-commerce/teacherProfileService.js";
