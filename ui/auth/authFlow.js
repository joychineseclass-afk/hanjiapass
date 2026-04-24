/**
 * 集中路由守卫：未登录、onboarding、已完成用户误入角色页
 */
import { navigateTo } from "../router.js";
import { getCurrentSessionAuthUser } from "./authService.js";
import { findUserById } from "./authStore.js";
import {
  getResolvedSessionLandingHash,
  isHashRequiringSession,
  isOnboardingIncompleteAllowedHash,
  isAuthFormHash,
  normalizeHashBase,
} from "./resolveSessionRoute.js";

/**
 * 首屏、hash 变化后依次执行。顺序：客态登录 → 未完成 onboarding 挡回 → 已完成离开角色页
 */
export function runSessionRouteGuards() {
  try {
    ensureGuestRedirectToAuth();
  } catch (e) {
    console.warn("[authFlow] ensureGuest:", e);
  }
  try {
    ensureOnboardingIncompleteGuard();
  } catch (e) {
    console.warn("[authFlow] ensureOnboarding:", e);
  }
  try {
    ensureOnboardingRoleRedirectWhenComplete();
  } catch (e) {
    console.warn("[authFlow] ensureOnboardingComplete:", e);
  }
}

/**
 * 未登录访问需账号的 hash（#my、#teacher*、onboarding/教师申请等）→ 登录
 */
function ensureGuestRedirectToAuth() {
  if (getCurrentSessionAuthUser()) return;
  const base = normalizeHashBase(location.hash);
  if (!isHashRequiringSession(base)) return;
  navigateTo("#auth-login", { force: true });
}

/**
 * 已登录、未完成 onboarding 且非白名单 → #onboarding-role
 */
function ensureOnboardingIncompleteGuard() {
  const u = getCurrentSessionAuthUser();
  if (!u) return;
  const full = findUserById(u.id);
  if (!full || full.onboardingCompleted !== false) return;
  const base = normalizeHashBase(location.hash);
  if (isOnboardingIncompleteAllowedHash(base)) return;
  navigateTo("#onboarding-role", { force: true });
}

/**
 * 已完成 onboarding 仍打开 #onboarding-role → #my
 */
function ensureOnboardingRoleRedirectWhenComplete() {
  const u = getCurrentSessionAuthUser();
  if (!u) return;
  const full = findUserById(u.id);
  if (!full || full.onboardingCompleted === false) return;
  const base = normalizeHashBase(location.hash);
  if (base !== "#onboarding-role") return;
  navigateTo("#my", { force: true });
}

/** @deprecated 使用 runSessionRouteGuards */
export function ensureOnboardingRoute() {
  runSessionRouteGuards();
}

let _bound = false;
export function bindOnboardingHashGuard() {
  if (_bound) return;
  _bound = true;
  window.addEventListener("hashchange", () => runSessionRouteGuards());
}

/**
 * 开发态：挂到 window，便于 console 与后续单元测试
 * 在 app 启动、且 shouldEnableLuminaDevUi 为真时由 app 或本模块再绑定一次也可
 */
export function attachLuminaAuthDevGlobal(ns = {}) {
  if (typeof window === "undefined") return;
  window.__LUMINA_AUTH_DEV__ = {
    runSessionRouteGuards,
    getResolvedSessionLandingHash,
    ...ns,
  };
}
