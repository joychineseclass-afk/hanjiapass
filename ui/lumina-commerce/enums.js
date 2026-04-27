/**
 * Lumina 教师 / 商业化 Stage 0 — 统一枚举（字符串字面量）。
 * 全项目请只引用此处常量，避免拼写分叉。
 */

/** @typedef {typeof SELLER_TYPE[keyof typeof SELLER_TYPE]} SellerType */
export const SELLER_TYPE = Object.freeze({
  platform: "platform",
  teacher: "teacher",
});

/** @typedef {typeof LISTING_TYPE[keyof typeof LISTING_TYPE]} ListingType */
export const LISTING_TYPE = Object.freeze({
  course: "course",
  course_bundle: "course_bundle",
  material: "material",
  ppt: "ppt",
  live_class: "live_class",
  one_on_one: "one_on_one",
  subscription_plan: "subscription_plan",
  other: "other",
});

/** @typedef {typeof DELIVERY_TYPE[keyof typeof DELIVERY_TYPE]} DeliveryType */
export const DELIVERY_TYPE = Object.freeze({
  recorded: "recorded",
  downloadable: "downloadable",
  live: "live",
  service: "service",
  membership: "membership",
  manual: "manual",
});

/** @typedef {typeof TEACHER_LEVEL[keyof typeof TEACHER_LEVEL]} TeacherLevel */
export const TEACHER_LEVEL = Object.freeze({
  basic_teacher: "basic_teacher",
  verified_teacher: "verified_teacher",
  seller_teacher: "seller_teacher",
});

/** @typedef {typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS]} VerificationStatus */
export const VERIFICATION_STATUS = Object.freeze({
  not_submitted: "not_submitted",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
});

/** @typedef {typeof SELLER_ELIGIBILITY[keyof typeof SELLER_ELIGIBILITY]} SellerEligibility */
export const SELLER_ELIGIBILITY = Object.freeze({
  none: "none",
  internal_use_only: "internal_use_only",
  eligible_to_sell: "eligible_to_sell",
});

/** Listing 生命周期：独立字段，禁止用多个布尔拼状态。 */
/** @typedef {typeof LISTING_STATUS[keyof typeof LISTING_STATUS]} ListingStatus */
export const LISTING_STATUS = Object.freeze({
  draft: "draft",
  pending_review: "pending_review",
  approved: "approved",
  rejected: "rejected",
  delisted: "delisted",
  archived: "archived",
  /** 预留：申诉审核中 */
  appeal_pending: "appeal_pending",
});

/** 可见性与审核通过解耦：approved 不意味 public。 */
/** @typedef {typeof VISIBILITY[keyof typeof VISIBILITY]} Visibility */
export const VISIBILITY = Object.freeze({
  private: "private",
  unlisted: "unlisted",
  public: "public",
});

/** @typedef {typeof REFUND_POLICY_TYPE[keyof typeof REFUND_POLICY_TYPE]} RefundPolicyType */
export const REFUND_POLICY_TYPE = Object.freeze({
  no_refund: "no_refund",
  within_7_days: "within_7_days",
  before_class_start: "before_class_start",
  prorated: "prorated",
  case_review: "case_review",
});

/** 审核 / 下架原因代码（统计与申诉用）。 */
/** @typedef {typeof REVIEW_REASON_CODE[keyof typeof REVIEW_REASON_CODE]} ReviewReasonCode */
export const REVIEW_REASON_CODE = Object.freeze({
  copyright_risk: "copyright_risk",
  policy_violation: "policy_violation",
  insufficient_quality: "insufficient_quality",
  missing_credentials: "missing_credentials",
  incomplete_listing: "incomplete_listing",
  unsafe_or_inappropriate: "unsafe_or_inappropriate",
  other: "other",
});

/** @typedef {typeof LISTING_REVIEW_ACTION[keyof typeof LISTING_REVIEW_ACTION]} ListingReviewAction */
export const LISTING_REVIEW_ACTION = Object.freeze({
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  delisted: "delisted",
  appeal_submitted: "appeal_submitted",
  appeal_resolved: "appeal_resolved",
});

/** @typedef {typeof ENTITLEMENT_TYPE[keyof typeof ENTITLEMENT_TYPE]} EntitlementType */
export const ENTITLEMENT_TYPE = Object.freeze({
  platform_subscription: "platform_subscription",
  listing_access: "listing_access",
  teacher_course_access: "teacher_course_access",
  manual_grant: "manual_grant",
  invite: "invite",
  free_access: "free_access",
});

/** @typedef {typeof ENTITLEMENT_SOURCE_TYPE[keyof typeof ENTITLEMENT_SOURCE_TYPE]} EntitlementSourceType */
export const ENTITLEMENT_SOURCE_TYPE = Object.freeze({
  order: "order",
  admin: "admin",
  campaign: "campaign",
  teacher_invite: "teacher_invite",
  system: "system",
});

/** @typedef {typeof ENTITLEMENT_STATUS[keyof typeof ENTITLEMENT_STATUS]} EntitlementStatus */
export const ENTITLEMENT_STATUS = Object.freeze({
  active: "active",
  expired: "expired",
  revoked: "revoked",
  scheduled: "scheduled",
});

/** @typedef {typeof ORDER_STATUS[keyof typeof ORDER_STATUS]} OrderStatus */
export const ORDER_STATUS = Object.freeze({
  pending_payment: "pending_payment",
  paid: "paid",
  failed: "failed",
  cancelled: "cancelled",
  refunded: "refunded",
  partially_refunded: "partially_refunded",
});

/**
 * 订单佣金快照类型（Stage 0 占位；政策变更不影响历史订单）。
 * @typedef {typeof COMMISSION_TYPE[keyof typeof COMMISSION_TYPE]} CommissionType */
export const COMMISSION_TYPE = Object.freeze({
  none: "none",
  platform_rate: "platform_rate",
  platform_flat: "platform_flat",
});

/** 多角色：勿在 users 表用单一 role 锁死。 */
/** @typedef {typeof USER_ROLE[keyof typeof USER_ROLE]} UserRole */
export const USER_ROLE = Object.freeze({
  student: "student",
  teacher: "teacher",
  reviewer: "reviewer",
  admin: "admin",
});

/** 主结算币种占位：韩国主市场默认 KRW（不在此文件做汇率逻辑）。 */
export const DEFAULT_SETTLEMENT_CURRENCY = "KRW";

/** 课堂 / listing 定价：免费与付费分流（与 price_amount 一致维护）。 */
/** @typedef {typeof PRICING_TYPE[keyof typeof PRICING_TYPE]} PricingType */
export const PRICING_TYPE = Object.freeze({
  free: "free",
  paid: "paid",
});

/** 分成模型占位 */
/** @typedef {typeof REVENUE_SHARE_MODEL[keyof typeof REVENUE_SHARE_MODEL]} RevenueShareModel */
export const REVENUE_SHARE_MODEL = Object.freeze({
  platform_split: "platform_split",
});

/** 模拟支付层：非真实 PSP */
/** @typedef {typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS]} PaymentStatus */
export const PAYMENT_STATUS = Object.freeze({
  pending: "pending",
  simulated_paid: "simulated_paid",
});

/** 履约占位 */
/** @typedef {typeof FULFILLMENT_STATUS[keyof typeof FULFILLMENT_STATUS]} FulfillmentStatus */
export const FULFILLMENT_STATUS = Object.freeze({
  pending: "pending",
  granted: "granted",
  failed: "failed",
});
