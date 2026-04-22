/**
 * #teacher 诊断：在开发/本地/ lumina_debug_teacher=1 时输出到 console，便于查 binding / approved / gate。
 */
import { getCurrentUser } from "./currentUser.js";
import { getCommerceStoreSync, initCommerceStore } from "./store.js";
import { getCurrentSessionAuthUser } from "../auth/authService.js";
import { findCommerceTeacherProfile } from "./teacherProfileStore.js";
import { findTeacherProfileByUserId } from "./teacherProfileQueries.js";
import { resolveWorkbenchGate, userIsTeacher } from "./teacherSelectors.js";
import { VERIFICATION_STATUS } from "./enums.js";
import { DEMO_TEACHER_USER } from "./currentUser.js";

/**
 * 是否应打印教师页调试信息（不依赖仅 async 的 isDev 标志）。
 * @returns {boolean}
 */
export function shouldLogLuminaTeacherPageDebug() {
  try {
    if (typeof import.meta !== "undefined" && /** @type {any} */ (import.meta).env && /** @type {any} */ (import.meta).env.DEV) return true;
  } catch {
    /* */
  }
  if (typeof localStorage !== "undefined" && localStorage.getItem("lumina_debug_teacher") === "1") return true;
  if (typeof location !== "undefined") {
    if (String(location.protocol || "") === "file:") return true;
    const h = String(location.hostname || "");
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local")) return true;
  }
  return false;
}

/**
 * @param {import('./teacherSelectors.js').TeacherPageContext | null} [ctx]
 */
export async function logTeacherHubPageDebug(ctx) {
  if (!shouldLogLuminaTeacherPageDebug()) return;
  try {
    await initCommerceStore();
  } catch {
    /* */
  }
  const snap = getCommerceStoreSync();
  const u = getCurrentUser();
  const auth = getCurrentSessionAuthUser();
  const byUser = snap ? findTeacherProfileByUserId(snap, u.id) : null;
  const byId = u.teacherProfileId && snap ? findCommerceTeacherProfile(snap, u.teacherProfileId) : null;
  const list = Array.isArray(snap?.teacher_profiles) ? snap.teacher_profiles : [];
  const rows = list.map((p) => {
    if (!p) return null;
    const isDemo = p.id === DEMO_TEACHER_USER.teacherProfileId && p.user_id === DEMO_TEACHER_USER.id;
    return {
      profile_id: p.id,
      user_id: p.user_id,
      display_name: p.display_name,
      verification_status: p.verification_status,
      seller_eligibility: p.seller_eligibility,
      is_demo_seed: isDemo,
    };
  });
  const approvedN = list.filter((p) => p && String(p.verification_status) === VERIFICATION_STATUS.approved).length;

  let gateExplain = "—";
  if (ctx) {
    const g = String(ctx.workbenchStatus);
    if (g === "not_teacher")
      gateExplain =
        "commerce 中无与当前 user_id 命中的 teacher_profiles 行，且 getMerged 未得到档案 → not_teacher（与 roles 的 learner 无关，修复后以 commerce 为准）。";
    else if (g === "guest") gateExplain = "未登录。";
    else if (g === "no_profile")
      gateExplain = "逻辑上无合并档案或 hasRow 假（异常）；请看 commerceRow / profile。";
    else
      gateExplain = `已绑定老师路径：resolve 使用合并后的 profile.workbench_status = ${g}（勿仅靠 auth roles 判定）。`;
  }

  // eslint-disable-next-line no-console
  console.group("[Lumina #teacher] debug");
  // eslint-disable-next-line no-console
  console.log("1) Auth session (authStore)", auth ? { id: auth.id, email: auth.email, displayName: auth.displayName } : null);
  // eslint-disable-next-line no-console
  console.log("2) lumina currentUser (LS)", {
    id: u.id,
    name: u.name,
    roles: u.roles,
    teacherProfileId: u.teacherProfileId,
    isGuest: u.isGuest,
    userIsTeacherRoleField: userIsTeacher(u),
  });
  // eslint-disable-next-line no-console
  console.log("3) Commerce lookup", {
    rowByUserId: byUser
      ? {
          id: byUser.id,
          verification_status: byUser.verification_status,
          seller_eligibility: byUser.seller_eligibility,
        }
      : null,
    rowByCurrentTeacherProfileId: byId
      ? {
          id: byId.id,
          user_id: byId.user_id,
          matchesUser: byId.user_id === u.id,
          verification_status: byId.verification_status,
        }
      : null,
  });
  // eslint-disable-next-line no-console
  console.log("4) teacher_profiles 总数", list.length, "其中 verification approved 行数", approvedN);
  // eslint-disable-next-line no-console
  console.table(rows.filter(Boolean));
  // eslint-disable-next-line no-console
  if (ctx) {
    const reResolved =
      ctx.profile && ctx.hasCommerceProfile
        ? resolveWorkbenchGate(u, ctx.profile, true)
        : null;
    // eslint-disable-next-line no-console
    console.log("5) getTeacherPageContext 结果", {
      workbenchStatus: ctx.workbenchStatus,
      isTeacherRole: ctx.isTeacherRole,
      hasCommerceProfile: ctx.hasCommerceProfile,
      isApproved: ctx.isApproved,
      profileMergedWorkbench: ctx.profile ? ctx.profile.workbench_status : null,
      profileVerification: ctx.profile ? ctx.profile.verification_status : null,
    });
    // eslint-disable-next-line no-console
    console.log("6) 分流原因说明", gateExplain, reResolved != null ? `(resolve 复核: ${String(reResolved)})` : "");
  } else {
    // eslint-disable-next-line no-console
    console.log("5) getTeacherPageContext: 无 ctx（可能加载失败）");
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}
