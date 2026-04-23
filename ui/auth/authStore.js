/**
 * 本地账号持久化：用户表 + 会话 id（可替换为真实后端）。
 * Keys: lumina_auth_users_v1, lumina_auth_session_v1
 */
export const AUTH_USERS_KEY = "lumina_auth_users_v1";
export const AUTH_SESSION_KEY = "lumina_auth_session_v1";

/**
 * @typedef {'active'|'none'} StudentRoleState
 * @typedef {'none'|'pending'|'active'|'rejected'} TeacherRoleState
 * @typedef {Object} LuminaRolesV1
 * @property {StudentRoleState} student
 * @property {TeacherRoleState} teacher
 */

/**
 * @typedef {Object} TeacherApplicationProfileV1
 * @property {string} displayName
 * @property {string} intro
 * @property {string[]} teachingTypes
 * @property {string} experienceLevel
 * @property {string} [note]
 * @property {string} submittedAt
 */

/**
 * @typedef {Object} AuthUserV1
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {string} passwordHash
 * @property {string} created_at
 * @property {string} updated_at
 * @property {boolean} [onboardingCompleted] 缺省时按 legacy 视为 true
 * @property {LuminaRolesV1} [roles]
 * @property {TeacherApplicationProfileV1|null} [teacherProfile]
 */

/**
 * @typedef {{ v: 1, users: AuthUserV1[] }} AuthUsersFile
 */

/**
 * @typedef {{ v: 1, userId: string | null }} AuthSession
 */

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
 * @returns {{ onboardingCompleted: boolean, roles: LuminaRolesV1, teacherProfile: TeacherApplicationProfileV1 | null }}
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
    roles = { student: st, teacher: /** @type {TeacherRoleState} */ (te) };
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
 * @returns {AuthUsersFile}
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
        .map((u) => /** @type {AuthUserV1} */ (u)),
    };
  } catch {
    return { v: 1, users: [] };
  }
}

/**
 * @param {unknown} u
 * @returns {AuthUserV1|null}
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
 * @param {AuthUsersFile} data
 */
export function saveAuthUsers(data) {
  try {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify({ v: 1, users: data.users }));
  } catch {
    /* ignore */
  }
}

/**
 * @returns {AuthSession}
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
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ v: 1, userId: userId && String(userId) ? String(userId) : null }));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} email
 * @returns {AuthUserV1|undefined}
 */
export function findUserByEmail(email) {
  const e = normAccount(email);
  if (!e) return undefined;
  return loadAuthUsers().users.find((u) => normAccount(u.email) === e);
}

/**
 * @param {string} id
 * @returns {AuthUserV1|undefined}
 */
export function findUserById(id) {
  if (!id) return undefined;
  return loadAuthUsers().users.find((u) => u.id === id);
}

/**
 * @param {AuthUserV1} user
 */
export function upsertUser(user) {
  const data = loadAuthUsers();
  const i = data.users.findIndex((u) => u.id === user.id);
  const next = { ...user, email: normAccount(String(user.email || "")) };
  if (i >= 0) data.users[i] = next;
  else data.users.push(next);
  saveAuthUsers(data);
}
