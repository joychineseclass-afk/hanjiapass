/**
 * 会话 + 老师档案态，供页面统一读取（避免散落拼条件）。
 */
import { loadSession } from "./authStore.js";
import { getCurrentSessionAuthUser } from "./authService.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";

export { getTeacherPageContext };

/**
 * @returns {boolean}
 */
export function isLoggedIn() {
  const s = loadSession();
  const u = getCurrentUser();
  return Boolean(s.userId && u.id && u.id !== "u_guest" && !u.isGuest);
}

/**
 * @returns {boolean}
 */
export function isSessionActive() {
  return Boolean(loadSession().userId);
}

/**
 * @returns {import('./authStore.js').AuthUserV1 | null}
 */
export function getSessionAuthUser() {
  return getCurrentSessionAuthUser();
}

/**
 * 聚合：登录态 + 教师页上下文。
 * @returns {Promise<Awaited<ReturnType<typeof getTeacherPageContext>> & { authUser: import('./authStore.js').AuthUserV1 | null }>}
 */
export async function getSessionAndTeacherContext() {
  const authUser = getCurrentSessionAuthUser();
  const ctx = await getTeacherPageContext();
  return { ...ctx, authUser };
}
