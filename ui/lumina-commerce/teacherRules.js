import { SELLER_ELIGIBILITY, SELLER_TYPE, TEACHER_LEVEL, VISIBILITY } from "./enums.js";

/**
 * 老师公开售卖与自用分层：seller_teacher + eligible_to_sell 才可提交公开售卖审核。
 *
 * @param {import('./schema.js').TeacherSellerProfile} profile
 * @returns {boolean}
 */
export function canTeacherPublishForSale(profile) {
  if (!profile) return false;
  if (profile.teacher_level !== TEACHER_LEVEL.seller_teacher) return false;
  if (profile.seller_eligibility !== SELLER_ELIGIBILITY.eligible_to_sell) return false;
  return true;
}

/**
 * 提交 listing 进入 pending_review 前的业务校验（Stage 0 骨架）。
 *
 * @param {import('./schema.js').TeacherSellerProfile|null} teacherProfile
 * @param {import('./schema.js').Listing} listing
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
export function assertCanSubmitListingForReview(teacherProfile, listing) {
  if (listing.seller_type === SELLER_TYPE.platform) {
    return { ok: true };
  }
  if (listing.seller_type === SELLER_TYPE.teacher) {
    if (!listing.teacher_id) {
      return { ok: false, code: "teacher_id_required", message: "teacher listing 必须带 teacher_id" };
    }
    if (!teacherProfile) {
      return { ok: false, code: "teacher_profile_missing", message: "缺少老师档案" };
    }
    if (teacherProfile.id !== listing.teacher_id) {
      return { ok: false, code: "teacher_mismatch", message: "listing.teacher_id 与档案不一致" };
    }
    if (!canTeacherPublishForSale(teacherProfile)) {
      return {
        ok: false,
        code: "not_seller_eligible",
        message: "需 seller_teacher 且 seller_eligibility=eligible_to_sell 方可提交售卖审核",
      };
    }
    if (listing.visibility === VISIBILITY.public) {
      // 审核未通过前通常不应 public；Stage 0 仅警告式拦截，避免骨架演示卡住
      // 生产可改为硬性拒绝
    }
  }
  return { ok: true };
}
