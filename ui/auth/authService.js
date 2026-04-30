/**
 * 最小账号动作：注册 / 登录 / 登出 + 与 lumina currentUser 同步。
 * 实际持久化与凭据比对由 `authStore` 选定的 provider 完成；此处仅编排 UI 与 commerce 同步。
 */
import {
  findUserById,
  getActiveProvider,
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
import { clearTeacherMaterialsSessionCaches } from "../lumina-commerce/teacherMaterialsService.js";

/** 登出或 Supabase SIGNED_OUT 后统一清理本机 Lumina 会话态（不含远端 signOut）。 */
export function resetLocalSessionAfterSignOut() {
  clearTeacherMaterialsSessionCaches();
  setCurrentUser({ ...GUEST_USER, roles: [...GUEST_USER.roles], isGuest: true, teacherProfileId: null });
}

/** hydrate 内各 Supabase 步骤独立超时（与 app 启动 2500ms 预算配合，避免单步挂死） */
const HYDRATE_REMOTE_STEP_MS = 2500;

const _hydrateStepTimeoutSymbol = Symbol("lumina-hydrate-step-timeout");

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} stepLabel
 * @returns {Promise<T | undefined>}
 */
async function runHydrateStep(promise, ms, stepLabel) {
  let tid = 0;
  const timeoutP = new Promise((resolve) => {
    tid = setTimeout(() => resolve(_hydrateStepTimeoutSymbol), ms);
  });
  try {
    const out = await Promise.race([promise, timeoutP]);
    if (out === _hydrateStepTimeoutSymbol) {
      console.warn(`[Lumina] hydrate step timeout (${ms}ms): ${stepLabel}`);
      return undefined;
    }
    return /** @type {T} */ (out);
  } catch (e) {
    console.warn(`[Lumina] hydrate step error (${stepLabel}):`, e?.message || e);
    return undefined;
  } finally {
    clearTimeout(tid);
  }
}

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
  try {
    if (getActiveProvider().type === "supabase") {
      try {
        const { getSupabaseClientReady } = await import("../integrations/supabaseClient.js");
        await runHydrateStep(getSupabaseClientReady(), HYDRATE_REMOTE_STEP_MS, "getSupabaseClientReady");
      } catch (e) {
        console.warn("[Lumina] hydrate: getSupabaseClientReady:", e?.message || e);
      }

      let supaUser = null;
      try {
        const { syncLuminaCacheFromSupabaseClient } = await import("./providers/supabaseAuthProvider.js");
        supaUser = await runHydrateStep(
          syncLuminaCacheFromSupabaseClient(),
          HYDRATE_REMOTE_STEP_MS,
          "syncLuminaCacheFromSupabaseClient",
        );
      } catch (e) {
        console.warn("[Lumina] hydrate: syncLuminaCacheFromSupabaseClient:", e?.message || e);
      }

      /** 未登录访客无 Supabase session，不应 ensure（否则会 not_authentication + 刷屏） */
      if (supaUser) {
        try {
          const { ensureLuminaProfileAndMerge } = await import("./profileService.js");
          await runHydrateStep(ensureLuminaProfileAndMerge(), HYDRATE_REMOTE_STEP_MS, "ensureLuminaProfileAndMerge");
        } catch (e) {
          console.warn("[Lumina] hydrate: ensureLuminaProfileAndMerge:", e?.message || e);
        }
      }
    }

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
  } catch (e) {
    console.warn("[Lumina] hydrateCurrentUserFromSession:", e?.message || e);
  } finally {
    try {
      emitAuthStateChanged();
    } catch {
      /* */
    }
  }
}

/**
 * 注册并立即建立会话（本阶段无邮箱验证）。
 * @param {{ name: string, email: string, password: string }} p
 * @returns {Promise<{ ok: true, user: import('./providers/authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
export async function registerAndLogin(p) {
  try {
    const r = await registerUser(p);
    if (!r.ok) return r;
    saveSession(r.user.id);
    if (getActiveProvider().type === "supabase") {
      const { ensureLuminaProfileAndMerge } = await import("./profileService.js");
      await ensureLuminaProfileAndMerge();
    }
    const u = findUserById(r.user.id) || r.user;
    await applyProfileToCurrentUser({ id: u.id, displayName: u.displayName, email: u.email });
    emitAuthStateChanged();
    return { ok: true, user: u };
  } catch (e) {
    console.error("[Lumina] registerAndLogin", e);
    return { ok: false, code: "unknown" };
  }
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
  try {
    const r = await authStore.signIn(p);
    if (!r.ok) return r;
    if (getActiveProvider().type === "supabase") {
      const { ensureLuminaProfileAndMerge } = await import("./profileService.js");
      await ensureLuminaProfileAndMerge();
    }
    const u = findUserById(r.user.id) || r.user;
    await applyProfileToCurrentUser({ id: u.id, displayName: u.displayName, email: u.email });
    emitAuthStateChanged();
    return { ok: true };
  } catch (e) {
    console.error("[Lumina] loginUser", e);
    return { ok: false, code: "unknown" };
  }
}

export async function logoutUser() {
  await authStore.signOut();
  resetLocalSessionAfterSignOut();
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
 * @param {{ displayName: string, intro: string, teachingTypes: string[], experienceLevel: string, note?: string, registrationSnapshot?: Record<string, unknown> }} p
 */
export async function submitTeacherApplication(p) {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  if (!full) return { ok: false, code: "not_found" };
  /** @type {Record<string, unknown>} */
  const teacherProfile = {
    displayName: String(p.displayName || "").trim(),
    intro: String(p.intro || "").trim(),
    teachingTypes: Array.isArray(p.teachingTypes) ? p.teachingTypes.map((x) => String(x)) : [],
    experienceLevel: String(p.experienceLevel || "").trim(),
    note: p.note != null ? String(p.note) : "",
    submittedAt: new Date().toISOString(),
  };
  if (p.registrationSnapshot && typeof p.registrationSnapshot === "object") {
    teacherProfile.registration_snapshot = p.registrationSnapshot;
  }
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
 * 更新教师申请存档中的实名快照（须在 UI 中先完成手机短信验证）。
 * @param {{ legal_name?: string, gender?: ''|'m'|'f', birthday_iso?: string, phone_digits?: string }} patch
 */
export async function updateTeacherRegistrationSnapshot(patch) {
  const au = getCurrentSessionAuthUser();
  if (!au) return { ok: false, code: "not_authenticated" };
  const full = findUserById(au.id);
  const prevTp = full?.teacherProfile;
  if (!full || !prevTp) return { ok: false, code: "no_teacher_profile" };
  const prevSnap = prevTp.registration_snapshot && typeof prevTp.registration_snapshot === "object"
    ? { .../** @type {Record<string, unknown>} */ (prevTp.registration_snapshot) }
    : {};
  /** @type {Record<string, unknown>} */
  const rs = { ...prevSnap };
  if (patch.legal_name != null) rs.legal_name = String(patch.legal_name).trim();
  if (patch.birthday_iso != null) rs.birthday_iso = String(patch.birthday_iso).trim();
  if (patch.phone_digits != null) rs.phone_digits = String(patch.phone_digits).replace(/\D/g, "");
  if (patch.gender !== undefined && (patch.gender === "" || patch.gender === "m" || patch.gender === "f"))
    rs.gender = patch.gender;
  rs.updated_at = new Date().toISOString();
  const ln = rs.legal_name != null ? String(rs.legal_name).trim() : "";
  const nextTeacherDisplay = ln !== "" ? ln : prevTp.displayName;
  const nextGlobalName = ln !== "" ? ln : full.displayName;

  upsertUser({
    ...full,
    displayName: nextGlobalName != null ? String(nextGlobalName) : full.displayName,
    teacherProfile: {
      ...prevTp,
      displayName: String(nextTeacherDisplay || prevTp.displayName || ""),
      registration_snapshot: rs,
    },
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
