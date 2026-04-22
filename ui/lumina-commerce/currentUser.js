/**
 * 当前用户占位（localStorage），后续可替换为真实登录态。
 */

const LS_KEY = "lumina_current_user_v1";

/** 与 stage0 种子、commerce teacher profile 默认对齐的演示老师 */
export const DEMO_TEACHER_USER = Object.freeze({
  id: "u_teacher_demo_001",
  name: "Teacher Demo",
  roles: /** @type {const} */ (["teacher"]),
  teacherProfileId: "tp_demo_seller_001",
});

/** 未登录 / 无会话时的壳用户（#teacher 门卡、买家上下文） */
export const GUEST_USER = Object.freeze({
  id: "u_guest",
  name: "",
  roles: /** @type {const} */ ([]),
  teacherProfileId: null,
  isGuest: true,
});

/**
 * @typedef {Object} CurrentUserV1
 * @property {string} id
 * @property {string} [name]
 * @property {string[]} [roles]
 * @property {string|null} [teacherProfileId]
 */

/**
 * @returns {CurrentUserV1}
 */
function readParsed() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return { id: GUEST_USER.id, name: GUEST_USER.name, roles: [...GUEST_USER.roles], teacherProfileId: null, isGuest: true };
    }
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object")
      return { id: GUEST_USER.id, name: GUEST_USER.name, roles: [...GUEST_USER.roles], teacherProfileId: null, isGuest: true };
    const id = String(p.id ?? GUEST_USER.id);
    const name = p.name != null ? String(p.name) : "";
    const roles = Array.isArray(p.roles) ? p.roles.map((r) => String(r)) : [];
    const teacherProfileId = p.teacherProfileId != null && p.teacherProfileId !== "" ? String(p.teacherProfileId) : null;
    const isGuest = Boolean(p.isGuest) || id === "u_guest";
    return { id, name, roles, teacherProfileId, isGuest: isGuest || undefined };
  } catch {
    return { id: GUEST_USER.id, name: GUEST_USER.name, roles: [...GUEST_USER.roles], teacherProfileId: null, isGuest: true };
  }
}

/**
 * @returns {CurrentUserV1}
 */
export function getCurrentUser() {
  return readParsed();
}

/**
 * @param {Partial<CurrentUserV1>} patch
 * @returns {CurrentUserV1}
 */
export function setCurrentUser(patch) {
  const cur = readParsed();
  const next = { ...cur, ...patch };
  if (patch.roles) next.roles = patch.roles.map((r) => String(r));
  if (patch.teacherProfileId === null) next.teacherProfileId = null;
  if (patch.isGuest === true) next.isGuest = true;
  if (patch.isGuest === false) delete next.isGuest;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** @returns {CurrentUserV1} */
export function resetCurrentUserToDemo() {
  const u = { ...DEMO_TEACHER_USER, roles: [...DEMO_TEACHER_USER.roles] };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...u, isGuest: false }));
  } catch {
    /* ignore */
  }
  return u;
}

export const CURRENT_USER_STORAGE_KEY = LS_KEY;

/** 与 stage0 演示教材/课程绑定的老师 profileId（非该 id 的账号不展示该批演示行） */
export const DEFAULT_DEMO_TEACHER_PROFILE_ID = DEMO_TEACHER_USER.teacherProfileId;
