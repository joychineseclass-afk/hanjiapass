/**
 * ---------------------------------------------------------------------------
 * DEMO / 本地开发专用认证 — 不是生产账号系统
 * ---------------------------------------------------------------------------
 * - 仅用于本地开发、演示与回归；不应用于真实付费、多设备、老师/学生正式数据。
 * - 用户与会话存于 localStorage，清缓存、换浏览器或换设备后数据会丢失或不同步。
 * - 下文的「凭据验证」为前端占位，不能替代服务端密码体系或合规的凭据处理。
 * - 将接入 Supabase/Clerk/Firebase/自建后端时，请改用 `remoteAuthProvider` 实现。
 * ---------------------------------------------------------------------------
 */

/**
 * 本地 key（仅 demo 用；正式环境应由服务器会话替代）。
 * Keys: lumina_auth_users_v1, lumina_auth_session_v1
 */
export const AUTH_USERS_KEY = "lumina_auth_users_v1";
export const AUTH_SESSION_KEY = "lumina_auth_session_v1";

/**
 * @param {string} s
 * @returns {string}
 */
function normEmail(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** 登录标识：邮箱或手机号等，统一小写/去首尾空格 */
export function normAccount(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

const TEACHER_STATES = new Set(["none", "pending", "active", "rejected"]);

/**
 * @param {Record<string, unknown>} o
 * @returns {{ onboardingCompleted: boolean, roles: { student: import('./authTypes.js').StudentRoleState, teacher: import('./authTypes.js').TeacherRoleState }, teacherProfile: import('./authTypes.js').TeacherApplicationProfileV1 | null }}
 */
export function normalizeLuminaProfileFields(o) {
  const explicit = Object.prototype.hasOwnProperty.call(o, "onboardingCompleted");
  const onboardingCompleted = explicit ? Boolean(o.onboardingCompleted) : true;
  let roles = o.roles;
  if (!roles || typeof roles !== "object") {
    roles = { student: "active", teacher: "none" };
  } else {
    const ro = /** @type {Record<string, unknown>} */ (roles);
    const st = ro.student === "none" ? "none" : "active";
    const tr = ro.teacher;
    const te = typeof tr === "string" && TEACHER_STATES.has(tr) ? tr : "none";
    /** @type {import('./authTypes.js').LuminaRolesV1} */
    const parsed = { student: st, teacher: /** @type {import('./authTypes.js').TeacherRoleState} */ (te) };
    roles = parsed;
  }
  let teacherProfile = o.teacherProfile;
  if (teacherProfile != null && typeof teacherProfile === "object") {
    const tp = /** @type {Record<string, unknown>} */ (teacherProfile);
    teacherProfile = {
      displayName: String(tp.displayName || ""),
      intro: String(tp.intro || ""),
      teachingTypes: Array.isArray(tp.teachingTypes) ? tp.teachingTypes.map((x) => String(x)) : [],
      experienceLevel: String(tp.experienceLevel || ""),
      note: tp.note != null ? String(tp.note) : "",
      submittedAt: String(tp.submittedAt || ""),
    };
  } else {
    teacherProfile = null;
  }
  return { onboardingCompleted, roles, teacherProfile };
}

/**
 * @param {string} password
 * @returns {string} 前端占位派生串，与生产密码学无关；仅本 demo 用于比对。
 * @see signUp / signIn
 */
function hashPasswordDemo(password) {
  const s = String(password || "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  const salt = "lumina_auth_v1";
  return `h1_${(h >>> 0).toString(16)}_${hashPasswordInner(s + salt)}`;
}

/**
 * @param {string} s
 */
function hashPasswordInner(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * @returns {import('./authTypes.js').AuthUsersFile}
 */
export function loadAuthUsers() {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY);
    if (!raw) return { v: 1, users: [] };
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.users)) return { v: 1, users: [] };
    return {
      v: 1,
      users: p.users
        .map(sanitizeUser)
        .filter((u) => u && u.id && u.email)
        .map((u) => /** @type {import('./authTypes.js').AuthUserV1} */ (u)),
    };
  } catch {
    return { v: 1, users: [] };
  }
}

/**
 * @param {unknown} u
 * @returns {import('./authTypes.js').AuthUserV1|null}
 */
function sanitizeUser(u) {
  if (!u || typeof u !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (u);
  const lumina = normalizeLuminaProfileFields(o);
  return {
    id: String(o.id || "").trim(),
    email: normEmail(String(o.email || "")),
    displayName: String(o.displayName || o.name || "").trim() || "User",
    passwordHash: String(o.passwordHash || ""),
    created_at: String(o.created_at || new Date().toISOString()),
    updated_at: String(o.updated_at || new Date().toISOString()),
    onboardingCompleted: lumina.onboardingCompleted,
    roles: lumina.roles,
    teacherProfile: lumina.teacherProfile,
  };
}

/**
 * @param {import('./authTypes.js').AuthUsersFile} data
 */
export function saveAuthUsers(data) {
  try {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify({ v: 1, users: data.users }));
  } catch {
    /* ignore */
  }
}

/**
 * @returns {import('./authTypes.js').AuthSession}
 */
export function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return { v: 1, userId: null };
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return { v: 1, userId: null };
    return { v: 1, userId: p.userId ? String(p.userId) : null };
  } catch {
    return { v: 1, userId: null };
  }
}

/**
 * @param {string | null} userId
 */
export function saveSession(userId) {
  try {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ v: 1, userId: userId && String(userId) ? String(userId) : null })
    );
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} email
 * @returns {import('./authTypes.js').AuthUserV1|undefined}
 */
export function findUserByEmail(email) {
  const e = normAccount(email);
  if (!e) return undefined;
  return loadAuthUsers().users.find((u) => normAccount(u.email) === e);
}

/**
 * @param {string} id
 * @returns {import('./authTypes.js').AuthUserV1|undefined}
 */
export function findUserById(id) {
  if (!id) return undefined;
  return loadAuthUsers().users.find((u) => u.id === id);
}

/**
 * @param {import('./authTypes.js').AuthUserV1} user
 */
export function upsertUser(user) {
  const data = loadAuthUsers();
  const i = data.users.findIndex((u) => u.id === user.id);
  const next = { ...user, email: normAccount(String(user.email || "")) };
  if (i >= 0) data.users[i] = next;
  else data.users.push(next);
  saveAuthUsers(data);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Demo 专用：在浏览器本地创建账号记录（不视为生产注册）。
 * @param {{ name?: string, email?: string, account?: string, password: string }} payload
 * @returns {Promise<{ ok: true, user: import('./authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
async function signUpImpl(payload) {
  const displayName = String(payload.name || "").trim();
  const account = normAccount(String(payload.email || payload.account || ""));
  const password = String(payload.password || "");
  if (!account) return { ok: false, code: "email_required" };
  if (!password) return { ok: false, code: "password_required" };
  if (findUserByEmail(account)) return { ok: false, code: "email_taken" };
  const user = {
    id: uid("u"),
    email: account,
    displayName: displayName || (account.includes("@") ? account.split("@")[0] : account) || "User",
    passwordHash: hashPasswordDemo(password),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    onboardingCompleted: false,
    roles: { student: "active", teacher: "none" },
    teacherProfile: null,
  };
  upsertUser(user);
  return { ok: true, user };
}

/**
 * @param {{ email?: string, account?: string, password: string }} payload
 * @returns {Promise<{ ok: true, user: import('./authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
async function signInImpl(payload) {
  const account = normAccount(String(payload.email || payload.account || ""));
  const password = String(payload.password || "");
  if (!account) return { ok: false, code: "email_required" };
  if (!password) return { ok: false, code: "password_required" };
  const u = findUserByEmail(account);
  if (!u) return { ok: false, code: "invalid_credentials" };
  if (u.passwordHash !== hashPasswordDemo(password)) return { ok: false, code: "invalid_credentials" };
  saveSession(u.id);
  return { ok: true, user: u };
}

/**
 * 当前会话用户的资料更新（同机本地合并）。
 * @param {Partial<import('./authTypes.js').AuthUserV1> & { id?: string }} payload
 * @returns {Promise<{ ok: true, user: import('./authTypes.js').AuthUserV1 } | { ok: false, code: string }>}
 */
async function updateProfileImpl(payload) {
  const s = loadSession();
  if (!s.userId) return { ok: false, code: "not_authenticated" };
  const full = findUserById(s.userId);
  if (!full) return { ok: false, code: "not_found" };
  const raw = {
    ...full,
    ...payload,
    id: full.id,
    email: normAccount(String(payload.email != null ? payload.email : full.email || "")),
  };
  const lumina = normalizeLuminaProfileFields(/** @type {Record<string, unknown>} */ (raw));
  const next = {
    ...raw,
    onboardingCompleted: lumina.onboardingCompleted,
    roles: lumina.roles,
    teacherProfile: lumina.teacherProfile,
    updated_at: new Date().toISOString(),
  };
  upsertUser(/** @type {import('./authTypes.js').AuthUserV1} */ (next));
  return { ok: true, user: findUserById(s.userId) || next };
}

/**
 * 本地 localStorage 认证实现。仅 dev/demo 使用，见文件顶注释。
 */
export const demoLocalAuthProvider = {
  type: "demo-local",

  signUp: signUpImpl,
  signIn: signInImpl,

  async signOut() {
    saveSession(null);
  },

  async getSession() {
    return loadSession();
  },

  async getCurrentUser() {
    const s = loadSession();
    if (!s.userId) return null;
    return findUserById(s.userId) || null;
  },

  updateProfile: updateProfileImpl,
};
