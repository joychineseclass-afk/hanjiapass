/**
 * 全站：登录/注册/刷新后会话落地 hash 的单一事实来源
 * 页面禁止各自实现一套“成功后跳哪”
 * （仅依赖 authStore，避免与 authService 循环依赖）
 */
import { findUserById, loadSession } from "./authStore.js";

const AUTH_FORM_HASHES = new Set(["#auth-login", "#auth-register", "#login", "#register"]);

function getSessionUser() {
  const s = loadSession();
  if (!s.userId) return null;
  return findUserById(s.userId) || null;
}

/**
 * 已存在会话时，登录/注册页应导向的 hash（onboarding 未完成 → 角色页，否则 #my-learning）
 * 未登录时用于「需要登录」的占位目标：#auth-login
 */
export function getResolvedSessionLandingHash() {
  const u = getSessionUser();
  if (!u) return "#auth-login";
  if (u.onboardingCompleted === false) return "#onboarding-role";
  return "#my-learning";
}

/**
 * 注册成功后的目标（固定不跳过 onboarding）
 */
export function getResolvedHashAfterRegisterSuccess() {
  return "#onboarding-role";
}

/**
 * 未登录时访问需登录的 hash 是否应跳登录
 */
export function isAuthFormHash(hash) {
  const b = normalizeHashBase(hash);
  return AUTH_FORM_HASHES.has(b);
}

function normalizeHashBase(h) {
  const s = String(h || location.hash || "#");
  const q = s.indexOf("?");
  const base = (q >= 0 ? s.slice(0, q) : s).split("&")[0] || "#home";
  return base.startsWith("#") ? base : `#${base}`;
}

/** onboarding 未完成时，允许停留的 hash（其它业务页一律挡回 #onboarding-role） */
const ONBOARDING_INCOMPLETE_ALLOW = new Set([
  "#auth-login",
  "#auth-register",
  "#login",
  "#register",
  "#onboarding-role",
  "#teacher-apply",
  "#teacher-status",
]);

export function isOnboardingIncompleteAllowedHash(hash) {
  return ONBOARDING_INCOMPLETE_ALLOW.has(normalizeHashBase(hash));
}

/**
 * 未登录用户访问到需登录的 hash（账号/我的/教师系）
 */
const GUEST_MUST_LOGIN_EXACT = new Set([
  "#my",
  "#my-learning",
  "#my-content",
  "#my-orders",
  "#onboarding-role",
  "#teacher-apply",
  "#teacher-status",
]);

function hashRequiresSession(hash) {
  const b = normalizeHashBase(hash);
  if (GUEST_MUST_LOGIN_EXACT.has(b)) return true;
  if (b === "#teacher" || b.startsWith("#teacher-")) return true;
  return false;
}

export { hashRequiresSession, normalizeHashBase };

export function isHashRequiringSession(hash) {
  return hashRequiresSession(hash);
}
