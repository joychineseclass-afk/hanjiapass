/**
 * Supabase 认证 provider（真实跨端会话由 Supabase 客户端落盘与刷新）。
 * Lumina 业务用户字段的同步 overlay 用 sessionStorage 暂存，供 `findUserById` 等与 demo 路径对齐；后续可迁 public.profiles。
 */
import { getSupabase, isAuthDemoForced } from "../../integrations/supabaseClient.js";
import { normAccount, normalizeLuminaProfileFields } from "./demoLocalAuthProvider.js";

const OVERLAY_KEY = "lumina_supabase_lumina_overlay_v1";

/** @type {import('./authTypes.js').AuthUserV1 | null} */
let _cachedUser = null;

/**
 * @param {import("@supabase/supabase-js").User | null} u
 * @param {import('./authTypes.js').AuthUserV1 | null} overlay
 * @returns {import('./authTypes.js').AuthUserV1 | null}
 */
function mapToAuthUserV1(u, overlay) {
  if (!u) return null;
  const meta = /** @type {Record<string, unknown>} */ (u.user_metadata || {});
  const fromMetaName =
    String(meta.display_name || meta.displayName || meta.full_name || meta.name || "") || "";
  const baseEmail = u.email != null ? String(u.email) : "";
  const display =
    (overlay && String(overlay.displayName)) ||
    fromMetaName ||
    (baseEmail.includes("@") ? baseEmail.split("@")[0] : baseEmail) ||
    "User";
  const id = u.id;
  const overlayMerge = overlay
    ? { ...overlay, id, email: normAccount(overlay.email || baseEmail) }
    : {
        id,
        email: normAccount(baseEmail),
        displayName: display,
        passwordHash: "",
        created_at: u.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboardingCompleted: false,
        roles: { student: "active", teacher: "none" },
        teacherProfile: null,
      };
  if (!overlay) {
    return /** @type {import('./authTypes.js').AuthUserV1} */ (overlayMerge);
  }
  const n = { ...overlayMerge, displayName: String(overlayMerge.displayName || display) };
  const norm = normalizeLuminaProfileFields(/** @type {Record<string, unknown>} */ (n));
  return {
    ...n,
    onboardingCompleted: norm.onboardingCompleted,
    roles: norm.roles,
    teacherProfile: norm.teacherProfile,
  };
}

/**
 * @returns {Record<string, import('./authTypes.js').AuthUserV1>}
 */
function readFullOverlay() {
  try {
    const raw = sessionStorage.getItem(OVERLAY_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return {};
    return /** @type {Record<string, import('./authTypes.js').AuthUserV1>} */ (p);
  } catch {
    return {};
  }
}

/**
 * @param {import('./authTypes.js').AuthUserV1} user
 */
function writeUserOverlay(user) {
  if (!user?.id) return;
  const all = readFullOverlay();
  all[user.id] = {
    ...all[user.id],
    ...user,
    id: user.id,
  };
  try {
    sessionStorage.setItem(OVERLAY_KEY, JSON.stringify(all));
  } catch {
    /* */
  }
}

/**
 * @param {import("@supabase/supabase-js").Session | null} session
 */
function mergeOverlayForUser(/** @type {import("@supabase/supabase-js").User | null} */ u) {
  if (!u) return null;
  const o = readFullOverlay()[u.id] || null;
  return mapToAuthUserV1(u, o);
}

/**
 * 将当前 Supabase 会话写回 Lumina 内存缓存（同步 API 可读到）。
 * @param {import("@supabase/supabase-js").Session | null} session
 * @returns {import('./authTypes.js').AuthUserV1 | null}
 */
export function applySessionToLuminaCache(session) {
  if (!session?.user) {
    _cachedUser = null;
    return null;
  }
  _cachedUser = mergeOverlayForUser(session.user);
  return _cachedUser;
}

/**
 * 从 Client 拉取 session 并更新缓存（用于首屏 / 登录后；刷新页恢复亦依赖此入口）。
 * @returns {Promise<import('./authTypes.js').AuthUserV1 | null>}
 */
export async function syncLuminaCacheFromSupabaseClient() {
  const client = getSupabase();
  if (!client) {
    _cachedUser = null;
    return null;
  }
  const { data, error } = await client.auth.getSession();
  if (error) {
    _cachedUser = null;
    return null;
  }
  return applySessionToLuminaCache(data?.session || null);
}

let _authListenerInited = false;
const _onAuthStateCbs = new Set();
/** @type {null | (() => void)} */
let _emitToStore = null;

/**
 * 与 authStore 桥接：多标签同会话 + token 刷新时广播。
 * @param {() => void} emit
 */
export function mountSupabaseAuthChannel(emit) {
  const client = getSupabase();
  if (!client) return;
  if (_authListenerInited) {
    _emitToStore = emit;
    return;
  }
  _authListenerInited = true;
  _emitToStore = emit;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    applySessionToLuminaCache(session);
    try {
      _emitToStore && _emitToStore();
    } catch {
      /* */
    }
    for (const fn of _onAuthStateCbs) {
      try {
        fn({ event, session });
      } catch (e) {
        console.error("[Lumina] onAuthStateChange callback:", e);
      }
    }
  });
  if (data?.subscription) {
    // 保留给未来 teardown；当前不卸载
    void data.subscription;
  }
}

/**
 * @param {unknown} err
 * @param {'signIn' | 'signUp'} _mode
 * @returns {{ code: string, message: string }}
 */
function mapError(err, _mode) {
  if (!err) {
    return { code: "unknown", message: "Unknown error" };
  }
  const o = /** @type {{ code?: string, message?: string, status?: number }} */ (err);
  const code = o.code != null ? String(o.code) : "";
  const message = o.message != null ? String(o.message) : "Request failed";
  if (code === "email_not_confirmed" || /email.*confirm|confirm.*email/i.test(message)) {
    return { code: "email_not_confirmed", message: "Email not confirmed" };
  }
  if (code === "invalid_credentials" || /Invalid login|invalid password|Invalid email or password/i.test(message)) {
    return { code: "invalid_credentials", message: "Invalid login credentials" };
  }
  if (code === "user_already_registered" || /already registered|already exists/i.test(message)) {
    return { code: "email_taken", message: "Email already registered" };
  }
  if (/fetch failed|NetworkError|network|Failed to fetch/i.test(message) || o.status === 0) {
    return { code: "network_error", message: "Network error" };
  }
  if (_mode === "signIn") {
    return { code: "invalid_credentials", message: "Invalid login credentials" };
  }
  return { code: "unknown", message };
}

/**
 * @param {{ email?: string, password: string, account?: string, name?: string }} payload
 * @returns {Promise<{ ok: true, user: import('./authTypes.js').AuthUserV1 } | { ok: false, code: string, message?: string }>}
 */
async function signInImpl(payload) {
  if (isAuthDemoForced()) {
    return { ok: false, code: "supabase_not_configured", message: "Supabase not configured" };
  }
  const client = getSupabase();
  if (!client) {
    return { ok: false, code: "supabase_not_configured", message: "Supabase not configured" };
  }
  const email = normAccount(String(payload.email || payload.account || ""));
  const password = String(payload.password || "");
  if (!email) {
    return { ok: false, code: "email_required", message: "Email required" };
  }
  if (!password) {
    return { ok: false, code: "password_required", message: "Password required" };
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const m = mapError(error, "signIn");
    return { ok: false, code: m.code, message: m.message };
  }
  const u = applySessionToLuminaCache(data?.session || null);
  if (!u) {
    return { ok: false, code: "invalid_credentials", message: "Invalid login credentials" };
  }
  return { ok: true, user: u };
}

/**
 * @param {{ email?: string, password: string, account?: string, name?: string }} payload
 */
async function signUpImpl(payload) {
  if (isAuthDemoForced()) {
    return { ok: false, code: "supabase_not_configured", message: "Supabase not configured" };
  }
  const client = getSupabase();
  if (!client) {
    return { ok: false, code: "supabase_not_configured", message: "Supabase not configured" };
  }
  const email = normAccount(String(payload.email || payload.account || ""));
  const password = String(payload.password || "");
  const name = String(payload.name || "").trim();
  if (!email) {
    return { ok: false, code: "email_required", message: "Email required" };
  }
  if (!password) {
    return { ok: false, code: "password_required", message: "Password required" };
  }
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: name, displayName: name, name } },
  });
  if (error) {
    const m = mapError(error, "signUp");
    return { ok: false, code: m.code, message: m.message };
  }
  if (!data.session) {
    return { ok: false, code: "email_not_confirmed", message: "Email not confirmed" };
  }
  const u = applySessionToLuminaCache(data.session);
  if (!u) {
    return { ok: false, code: "email_not_confirmed", message: "Email not confirmed" };
  }
  return { ok: true, user: u };
}

async function signOutImpl() {
  const client = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
  _cachedUser = null;
  try {
    sessionStorage.removeItem(OVERLAY_KEY);
  } catch {
    /* */
  }
}

async function getSessionImpl() {
  const client = getSupabase();
  if (!client) {
    return { v: 1, userId: null };
  }
  const { data, error } = await client.auth.getSession();
  if (error) {
    return { v: 1, userId: null };
  }
  const session = data?.session;
  if (!session?.user) {
    return { v: 1, userId: null };
  }
  applySessionToLuminaCache(session);
  return { v: 1, userId: session.user.id, provider: "supabase" };
}

async function getCurrentUserImpl() {
  const client = getSupabase();
  if (!client) {
    return null;
  }
  if (_cachedUser) {
    return _cachedUser;
  }
  const { data: sData, error: sErr } = await client.auth.getSession();
  if (sErr || !sData?.session?.user) {
    return null;
  }
  const applied = applySessionToLuminaCache(sData.session);
  if (applied) {
    return applied;
  }
  const { data: uData, error: uErr } = await client.auth.getUser();
  if (uErr || !uData?.user) {
    return null;
  }
  return mergeOverlayForUser(uData.user);
}

/**
 * 同步合并 overlay 与当前缓存，避免 authService 中大量 await 路径分叉。
 * @param {import('./authTypes.js').AuthUserV1} user
 */
function upsertUserImpl(user) {
  if (!getSupabase()) {
    throw new Error("Supabase is not available");
  }
  if (!user?.id) {
    return;
  }
  const overlayBase = readFullOverlay()[user.id] || _cachedUser;
  const merged = {
    ...overlayBase,
    ...user,
    id: user.id,
  };
  const lumina = normalizeLuminaProfileFields(/** @type {Record<string, unknown>} */ (merged));
  const finalUser = {
    ...merged,
    email: normAccount(String(merged.email || "")),
    onboardingCompleted: lumina.onboardingCompleted,
    roles: lumina.roles,
    teacherProfile: lumina.teacherProfile,
  };
  writeUserOverlay(/** @type {import('./authTypes.js').AuthUserV1} */ (finalUser));
  if (_cachedUser?.id === user.id) {
    _cachedUser = /** @type {import('./authTypes.js').AuthUserV1} */ (finalUser);
  }
}

/**
 * @param {Partial<import('./authTypes.js').AuthUserV1>} payload
 * @returns {Promise<{ ok: true, user: import('./authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
async function updateProfileImpl(payload) {
  if (!getSupabase()) {
    return { ok: false, code: "not_authenticated" };
  }
  const { data: sData } = await getSupabase().auth.getSession();
  const u = sData?.session?.user;
  if (!u) {
    return { ok: false, code: "not_authenticated" };
  }
  const current = (await getCurrentUserImpl()) || mapToAuthUserV1(u, readFullOverlay()[u.id] || null);
  if (!current) {
    return { ok: false, code: "not_found" };
  }
  const next = { ...current, ...payload, id: current.id };
  upsertUserImpl(/** @type {import('./authTypes.js').AuthUserV1} */ (next));
  return { ok: true, user: /** @type {import('./authTypes.js').AuthUserV1} */ (_cachedUser || current) };
}

/**
 * 额外订阅（与 mountSupabaseAuthChannel 共享底层 onAuthStateChange）
 * @param {(arg: { event: string, session: import("@supabase/supabase-js").Session | null }) => void} callback
 * @returns {() => void}
 */
export function onAuthStateChange(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }
  _onAuthStateCbs.add(callback);
  return () => {
    _onAuthStateCbs.delete(callback);
  };
}

/**
 * 供 authStore 使用的持久化实现（与 demo 同构签名，Lumina 业务字段在 overlay 中）。
 */
export const supabasePersistenceApi = {
  findUserById(/** @type {string} */ id) {
    if (!id) {
      return undefined;
    }
    if (_cachedUser && _cachedUser.id === id) {
      return _cachedUser;
    }
    return undefined;
  },

  findUserByEmail(/** @type {string} */ email) {
    const e = normAccount(email);
    if (!e || !_cachedUser) {
      return undefined;
    }
    return normAccount(_cachedUser.email) === e ? _cachedUser : undefined;
  },

  loadSession() {
    if (!_cachedUser) {
      return { v: 1, userId: null };
    }
    return { v: 1, userId: _cachedUser.id, provider: "supabase" };
  },

  saveSession(/** @type {string | null} */ userId) {
    if (!userId) {
      _cachedUser = null;
    }
  },

  upsertUser(/** @type {import('./authTypes.js').AuthUserV1} */ user) {
    return upsertUserImpl(user);
  },

  loadAuthUsers() {
    if (!_cachedUser) {
      return { v: 1, users: [] };
    }
    return { v: 1, users: [_cachedUser] };
  },

  saveAuthUsers() {},
};

/**
 * 对外 provider（authStore 选用）。
 */
export const supabaseAuthProvider = {
  type: "supabase",
  signIn: signInImpl,
  signUp: signUpImpl,
  signOut: signOutImpl,
  getSession: getSessionImpl,
  getCurrentUser: getCurrentUserImpl,
  updateProfile: updateProfileImpl,
  onAuthStateChange,
};
