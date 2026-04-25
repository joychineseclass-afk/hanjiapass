/**
 * Lumina 认证适配层：选择 provider、暴露统一 API、在 UI 与业务之间隔离持久化实现。
 * 不直接写 localStorage 用户表 — 由 `demoLocalAuthProvider` 或未来的 remote 实现负责。
 */
import * as demo from "./providers/demoLocalAuthProvider.js";
import { remoteAuthProviderPlaceholder } from "./providers/remoteAuthProvider.placeholder.js";

/**
 * 设为 `true` 时启用 `remoteAuthProviderPlaceholder`（未接后端前会抛错，仅用于接库前的编译/分支验证）。
 * 接好真实后端后在此切换或通过构建注入。
 */
const LUMINA_USE_REMOTE_AUTH_PLACEHOLDER = false;

let demoProdWarned = false;

/**
 * @returns {boolean}
 */
function isProductionRuntime() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD) return true;
  } catch {
    /* */
  }
  try {
    if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production") return true;
  } catch {
    /* */
  }
  return false;
}

function maybeWarnDemoAuthInProduction() {
  if (!isProductionRuntime() || LUMINA_USE_REMOTE_AUTH_PLACEHOLDER || demoProdWarned) return;
  demoProdWarned = true;
  console.warn(
    "Lumina is using demo local auth. This is not persistent across devices and must not be used for production accounts."
  );
}

maybeWarnDemoAuthInProduction();

/**
 * 异步会话/登录 API 使用的 provider（含 demo / remote-placeholder）。
 * @returns {typeof demo.demoLocalAuthProvider | typeof remoteAuthProviderPlaceholder}
 */
function getActiveProvider() {
  return LUMINA_USE_REMOTE_AUTH_PLACEHOLDER ? remoteAuthProviderPlaceholder : demo.demoLocalAuthProvider;
}

/**
 * 用户表、会话的同步存取与查询（同构于当前 demo 的模块级函数；切 remote 时委托占位实现）。
 * @returns {typeof remoteAuthProviderPlaceholder | typeof import('./providers/demoLocalAuthProvider.js')}
 */
function getPersistenceApi() {
  return LUMINA_USE_REMOTE_AUTH_PLACEHOLDER ? remoteAuthProviderPlaceholder : demo;
}

// --- 订阅与广播（`joy:authChanged` 与 onAuthChange 同时触发，便于统一迁移）---
const authChangeSubscribers = new Set();

/**
 * 通知已订阅者并派发 `joy:authChanged`（与现有页面兼容）。
 * 供 authService 等在会话变更后显式调用。
 */
export function emitAuthStateChanged() {
  for (const fn of authChangeSubscribers) {
    try {
      fn();
    } catch {
      /* */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent("joy:authChanged"));
  } catch {
    /* */
  }
}

/**
 * @param {() => void} callback
 * @returns {() => void} 取消订阅
 */
export function onAuthChange(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }
  authChangeSubscribers.add(callback);
  return () => {
    authChangeSubscribers.delete(callback);
  };
}

/** 供迁移文档与排错；仍指向 demo 使用的 key 名。 */
export const AUTH_USERS_KEY = demo.AUTH_USERS_KEY;
export const AUTH_SESSION_KEY = demo.AUTH_SESSION_KEY;

/** 与存储无关的纯函数，仍从 demo 模块导出。 */
export const normAccount = demo.normAccount;
export const normalizeLuminaProfileFields = demo.normalizeLuminaProfileFields;

/**
 * @param {string} id
 */
export function findUserById(id) {
  return getPersistenceApi().findUserById(id);
}

/**
 * @param {string} email
 */
export function findUserByEmail(email) {
  return getPersistenceApi().findUserByEmail(email);
}

export function loadSession() {
  return getPersistenceApi().loadSession();
}

/**
 * @param {string | null} userId
 */
export function saveSession(userId) {
  return getPersistenceApi().saveSession(userId);
}

/**
 * @param {import('./providers/authTypes.js').AuthUserV1} user
 */
export function upsertUser(user) {
  return getPersistenceApi().upsertUser(user);
}

export function loadAuthUsers() {
  return getPersistenceApi().loadAuthUsers();
}

/**
 * @param {import('./providers/authTypes.js').AuthUsersFile} data
 */
export function saveAuthUsers(data) {
  return getPersistenceApi().saveAuthUsers(data);
}

/**
 * 统一 API（新代码优先使用）
 */
export const authStore = {
  getType: () => getActiveProvider().type,

  signUp: (payload) => getActiveProvider().signUp(payload),
  signIn: (payload) => getActiveProvider().signIn(payload),
  signOut: () => getActiveProvider().signOut(),

  getSession: () => getActiveProvider().getSession(),

  getCurrentUser: () => getActiveProvider().getCurrentUser(),

  updateProfile: (payload) => getActiveProvider().updateProfile(payload),

  isAuthenticated: async () => {
    const p = getActiveProvider();
    if (!p.getSession) return false;
    const s = await p.getSession();
    if (!s) return false;
    if (typeof s === "object" && s !== null && "userId" in s) {
      return Boolean(/** @type {{ userId?: string | null }} */ (s).userId);
    }
    return false;
  },

  onAuthChange,
};

export { getActiveProvider };
