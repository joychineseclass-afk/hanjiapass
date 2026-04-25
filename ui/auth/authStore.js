/**
 * Lumina 认证适配层：选择 provider、暴露统一 API、在 UI 与业务之间隔离持久化实现。
 * 不直接写 localStorage 用户表 — 由 `demoLocalAuthProvider` 或 `supabaseAuthProvider` 等实现负责。
 */
import * as demo from "./providers/demoLocalAuthProvider.js";
import { remoteAuthProviderPlaceholder } from "./providers/remoteAuthProvider.placeholder.js";
import {
  supabaseAuthProvider,
  supabasePersistenceApi,
  mountSupabaseAuthChannel,
  onAuthStateChange as supabaseOnAuthStateChange,
} from "./providers/supabaseAuthProvider.js";
import {
  getSupabaseEnv,
  isAuthDemoForced,
  isLikelyProductionRuntime,
  isNonLocalhostDeployment,
  warnIfProductionAuthMisconfiguration,
  warnIfSupabaseEnvMissing,
} from "../integrations/supabaseClient.js";

/**
 * 设为 `true` 时启用 `remoteAuthProviderPlaceholder`（未接后端前会抛错，仅用于接库前的编译/分支验证）。
 */
const LUMINA_USE_REMOTE_AUTH_PLACEHOLDER = false;

let demoProdWarned = false;

/**
 * 是否使用 Supabase：环境完整且未显式强制 demo、且未启用 remote placeholder。
 * @returns {boolean}
 */
function shouldUseSupabase() {
  if (LUMINA_USE_REMOTE_AUTH_PLACEHOLDER) {
    return false;
  }
  if (isAuthDemoForced()) {
    return false;
  }
  return getSupabaseEnv().isComplete;
}

/**
 * @returns {boolean}
 */
function isUsingDemoProvider() {
  if (LUMINA_USE_REMOTE_AUTH_PLACEHOLDER) {
    return false;
  }
  if (shouldUseSupabase()) {
    return false;
  }
  return true;
}

function maybeWarnDemoAuthInProduction() {
  const prodish = isLikelyProductionRuntime() || isNonLocalhostDeployment();
  if (!prodish || LUMINA_USE_REMOTE_AUTH_PLACEHOLDER || !isUsingDemoProvider() || demoProdWarned) {
    return;
  }
  demoProdWarned = true;
  console.warn(
    "Lumina is using demo local auth. This is not persistent across devices and must not be used for production accounts."
  );
}

maybeWarnDemoAuthInProduction();
warnIfProductionAuthMisconfiguration();
if (!shouldUseSupabase() && !LUMINA_USE_REMOTE_AUTH_PLACEHOLDER) {
  warnIfSupabaseEnvMissing();
}

/**
 * 异步会话/登录 API 使用的 provider
 */
function getActiveProvider() {
  maybeWarnDemoAuthInProduction();
  if (LUMINA_USE_REMOTE_AUTH_PLACEHOLDER) {
    return remoteAuthProviderPlaceholder;
  }
  if (shouldUseSupabase()) {
    return supabaseAuthProvider;
  }
  return demo.demoLocalAuthProvider;
}

/**
 * 用户表、会话的同步存取
 */
function getPersistenceApi() {
  if (LUMINA_USE_REMOTE_AUTH_PLACEHOLDER) {
    return remoteAuthProviderPlaceholder;
  }
  if (shouldUseSupabase()) {
    return supabasePersistenceApi;
  }
  return demo;
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
 * 应用内通用订阅（不依赖具体 provider 实现细节）。
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

if (shouldUseSupabase()) {
  mountSupabaseAuthChannel(emitAuthStateChanged);
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
    if (!p.getSession) {
      return false;
    }
    const s = await p.getSession();
    if (!s) {
      return false;
    }
    if (typeof s === "object" && s !== null && "userId" in s) {
      return Boolean(/** @type {{ userId?: string | null }} */ (s).userId);
    }
    return false;
  },

  onAuthStateChange: (cb) => {
    if (shouldUseSupabase()) {
      return supabaseOnAuthStateChange(cb);
    }
    return onAuthChange(() => {
      try {
        /** @type {(arg: { event: string, session: null }) => void} */ (cb)({ event: "LOCAL", session: null });
      } catch {
        /* */
      }
    });
  },
  onAuthChange,
};

const prodishEnv = () => isLikelyProductionRuntime() || isNonLocalhostDeployment();

/**
 * 类生产 / 可公开访问的部署上且当前走 demo 本地表（无 Supabase 或不可用时）。
 * @returns {boolean}
 */
export function isLuminaAuthProductionDemoPath() {
  return prodishEnv() && isUsingDemoProvider();
}

/**
 * 可公开部署或类生产、未配 Supabase、且未显式 VITE_LUMINA_AUTH_USE_DEMO — 提示「无正式跨端登录」，不宜引导真实用户把 demo 当生产账号。
 * @returns {boolean}
 */
export function isLuminaAuthProductionSupabaseOff() {
  return (
    prodishEnv() &&
    !LUMINA_USE_REMOTE_AUTH_PLACEHOLDER &&
    !getSupabaseEnv().isComplete &&
    !isAuthDemoForced()
  );
}

/**
 * 可公开部署或类生产且显式强制 demo（内部预览等）。
 * @returns {boolean}
 */
export function isLuminaAuthProductionDemoForcedByEnv() {
  return prodishEnv() && isAuthDemoForced();
}

export { getActiveProvider };
