import { SELLER_ELIGIBILITY, SELLER_TYPE, TEACHER_LEVEL, VERIFICATION_STATUS, VISIBILITY } from "./enums.js";

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
 * @returns {{ ok: boolean, code?: string }}
 */
export function assertCanSubmitListingForReview(teacherProfile, listing) {
  if (listing.seller_type === SELLER_TYPE.platform) {
    return { ok: true };
  }
  if (listing.seller_type === SELLER_TYPE.teacher) {
    if (!listing.teacher_id) {
      return { ok: false, code: "teacher_id_required" };
    }
    if (!teacherProfile) {
      return { ok: false, code: "teacher_profile_missing" };
    }
    if (teacherProfile.id !== listing.teacher_id) {
      return { ok: false, code: "teacher_mismatch" };
    }
    if (!canTeacherPublishForSale(teacherProfile)) {
      return {
        ok: false,
        code: "not_seller_eligible",
      };
    }
    if (listing.visibility === VISIBILITY.public) {
      // 审核未通过前通常不应 public；Stage 0 仅警告式拦截，避免骨架演示卡住
      // 生产可改为硬性拒绝
    }
  }
  return { ok: true };
}

/**
 * 老师从「课堂资产」提交 listing 进入审核：仅需已认证老师，不强制 seller 售卖资格（与全平台售卖 listing 区分）。
 * @param {import('./schema.js').TeacherSellerProfile|null} teacherProfile
 * @param {import('./schema.js').Listing} listing
 * @returns {{ ok: boolean, code?: string }}
 */
export function assertCanSubmitClassroomAssetListing(teacherProfile, listing) {
  if (String(listing?.source_kind) !== "classroom_asset") {
    return { ok: false, code: "not_classroom_asset" };
  }
  if (listing.seller_type !== SELLER_TYPE.teacher) {
    return { ok: false, code: "seller_type_invalid" };
  }
  if (!listing.teacher_id) {
    return { ok: false, code: "teacher_id_required" };
  }
  if (!teacherProfile) {
    return { ok: false, code: "teacher_profile_missing" };
  }
  if (teacherProfile.id !== listing.teacher_id) {
    return { ok: false, code: "teacher_mismatch" };
  }
  if (teacherProfile.verification_status !== VERIFICATION_STATUS.approved) {
    return { ok: false, code: "teacher_not_verified" };
  }
  return { ok: true };
}
