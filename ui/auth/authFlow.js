/**
 * 登录后按 onboarding 状态重定向到角色页（首屏 + hash 变化时检查）
 */
import { navigateTo } from "../router.js";
import { getCurrentSessionAuthUser } from "./authService.js";
import { findUserById } from "./authStore.js";

const AUTH_FLOW_HASHES = new Set([
  "#auth-login",
  "#auth-register",
  "#login",
  "#register",
  "#onboarding-role",
  "#teacher-apply",
  "#teacher-status",
]);

function currentHashBase() {
  const h = String(location.hash || "#");
  const q = h.indexOf("?");
  return (q >= 0 ? h.slice(0, q) : h).split("&")[0] || "#home";
}

/**
 * 已登录但尚未完成角色 onboarding 时，从任意业务页拉回到 #onboarding-role
 */
export function ensureOnboardingRoute() {
  const u = getCurrentSessionAuthUser();
  if (!u) return;
  const full = findUserById(u.id);
  if (!full || full.onboardingCompleted !== false) return;
  const base = currentHashBase();
  if (AUTH_FLOW_HASHES.has(base)) return;
  navigateTo("#onboarding-role", { force: true });
}

let _bound = false;
export function bindOnboardingHashGuard() {
  if (_bound) return;
  _bound = true;
  window.addEventListener("hashchange", () => ensureOnboardingRoute());
}
