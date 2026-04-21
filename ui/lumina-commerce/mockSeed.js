/**
 * Stage 0 内存种子：含 users / user_roles，供骨架演示。
 * 示例字段与 data/lumina/stage0-mock-examples.json 一致（运行时通过 fetch 合并）。
 */

import { SCHEMA_VERSION_STAGE0 } from "./schema.js";

const iso = (d) => new Date(d).toISOString();

/**
 * @param {Record<string, unknown>} examples from stage0-mock-examples.json
 * @returns {import('./schema.js').User[]}
 */
function seedUsers() {
  return [
    {
      id: "u_student_demo_001",
      display_name: "示例学生 A",
      created_at: iso("2026-01-01"),
      updated_at: iso("2026-04-01"),
    },
    {
      id: "u_teacher_demo_001",
      display_name: "示例老师（用户）",
      created_at: iso("2026-01-01"),
      updated_at: iso("2026-04-01"),
    },
    {
      id: "u_reviewer_demo_001",
      display_name: "示例审核员",
      created_at: iso("2026-01-01"),
      updated_at: iso("2026-04-01"),
    },
    {
      id: "u_admin_demo_001",
      display_name: "示例管理员",
      created_at: iso("2026-01-01"),
      updated_at: iso("2026-04-01"),
    },
  ];
}

/** @returns {import('./schema.js').UserRoleRow[]} */
function seedUserRoles() {
  const rows = [];
  let i = 0;
  const add = (user_id, role) => {
    i += 1;
    rows.push({
      id: `ur_seed_${i}`,
      user_id,
      role,
      created_at: iso("2026-01-01"),
    });
  };
  add("u_student_demo_001", "student");
  add("u_teacher_demo_001", "teacher");
  add("u_reviewer_demo_001", "reviewer");
  add("u_admin_demo_001", "admin");
  add("u_admin_demo_001", "reviewer");
  return rows;
}

/**
 * @param {Record<string, unknown>} examples
 * @returns {import('./schema.js').TeacherSellerProfile}
 */
function pickTeacherProfile(examples) {
  const t = examples.teacher_seller_profile_example;
  if (t && typeof t === "object") {
    return /** @type {import('./schema.js').TeacherSellerProfile} */ (structuredClone(t));
  }
  throw new Error("mockSeed: missing teacher_seller_profile_example");
}

/**
 * @param {Record<string, unknown>} examples
 * @returns {import('./schema.js').Listing[]}
 */
function pickListings(examples) {
  const a = examples.listing_platform_example;
  const b = examples.listing_teacher_example;
  const c = examples.listing_teacher_course_example;
  if (!a || !b) throw new Error("mockSeed: missing listing examples");
  const out = [
    /** @type {import('./schema.js').Listing} */ (structuredClone(a)),
    /** @type {import('./schema.js').Listing} */ (structuredClone(b)),
  ];
  if (c && typeof c === "object") {
    out.push(/** @type {import('./schema.js').Listing} */ (structuredClone(c)));
  }
  return out;
}

/**
 * @param {Record<string, unknown>} examples
 * @returns {import('./schema.js').Entitlement[]}
 */
function pickEntitlements(examples) {
  const e = examples.entitlement_example;
  if (!e) throw new Error("mockSeed: missing entitlement_example");
  return [/** @type {import('./schema.js').Entitlement} */ (structuredClone(e))];
}

/**
 * @param {Record<string, unknown>} examples
 * @returns {import('./schema.js').Order[]}
 */
function pickOrders(examples) {
  const o = examples.order_example;
  if (!o) throw new Error("mockSeed: missing order_example");
  return [/** @type {import('./schema.js').Order} */ (structuredClone(o))];
}

/**
 * @param {Record<string, unknown>} examples parsed JSON
 */
export function createInitialStoreSnapshot(examples) {
  return {
    schema_version: SCHEMA_VERSION_STAGE0,
    users: seedUsers(),
    user_roles: seedUserRoles(),
    teacher_profiles: [pickTeacherProfile(examples)],
    listings: pickListings(examples),
    listing_review_logs: /** @type {import('./schema.js').ListingReviewLog[]} */ ([]),
    entitlements: pickEntitlements(examples),
    orders: pickOrders(examples),
  };
}

/** 内置兜底（fetch 失败时使用，字段与 JSON 示例一致）。 */
export function builtinStage0Examples() {
  return {
    teacher_seller_profile_example: {
      id: "tp_demo_seller_001",
      user_id: "u_teacher_demo_001",
      display_name: "示例·金老师",
      bio: "HSK 口语 / 商务汉语（占位）",
      teacher_level: "seller_teacher",
      verification_status: "approved",
      seller_eligibility: "eligible_to_sell",
      payout_ready: false,
      payout_provider: null,
      provider_account_id: null,
      kyc_status: null,
      created_at: "2026-01-15T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    },
    listing_platform_example: {
      id: "lst_platform_hsk1_bundle_001",
      seller_type: "platform",
      teacher_id: null,
      listing_type: "course_bundle",
      delivery_type: "recorded",
      title: "Lumina 官方 · HSK1 录播包（示例）",
      summary: "平台自营内容，收入归平台。",
      description: "Stage 0 占位商品，用于验证 seller_type=platform。",
      status: "approved",
      visibility: "public",
      price_amount: "49000",
      price_currency: "KRW",
      list_price_amount: "59000",
      sale_price_amount: "49000",
      refund_policy_type: "within_7_days",
      review_reason_code: null,
      review_reason_text: null,
      ownership_declaration_accepted: null,
      source_kind: "platform",
      source_id: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-20T00:00:00.000Z",
      published_at: "2026-03-20T00:00:00.000Z",
      delisted_at: null,
    },
    listing_teacher_example: {
      id: "lst_teacher_ppt_pack_001",
      seller_type: "teacher",
      teacher_id: "tp_demo_seller_001",
      listing_type: "ppt",
      delivery_type: "downloadable",
      title: "金老师 · 礼貌表达讲义包（示例）",
      summary: "由教材条目演示进入上架流程的示例。",
      description: "Stage 0 占位，演示 source_kind=material。",
      status: "pending_review",
      visibility: "unlisted",
      price_amount: "12000",
      price_currency: "KRW",
      list_price_amount: "15000",
      sale_price_amount: "12000",
      refund_policy_type: "no_refund",
      review_reason_code: null,
      review_reason_text: null,
      ownership_declaration_accepted: true,
      source_kind: "material",
      source_id: "tdm_politeness_handout",
      created_at: "2026-04-10T00:00:00.000Z",
      updated_at: "2026-04-10T00:00:00.000Z",
      published_at: null,
      delisted_at: null,
    },
    listing_teacher_course_example: {
      id: "lst_demo_kids_course_001",
      seller_type: "teacher",
      teacher_id: "tp_demo_seller_001",
      listing_type: "course",
      delivery_type: "live",
      title: "Kids 课堂草稿 A — 上架草稿（示例）",
      summary: "由演示课程进入上架流程的草稿。",
      description: "Stage 0 演示：source_kind=course。",
      status: "draft",
      visibility: "private",
      price_amount: "35000",
      price_currency: "KRW",
      list_price_amount: null,
      sale_price_amount: null,
      refund_policy_type: "within_7_days",
      review_reason_code: null,
      review_reason_text: null,
      ownership_declaration_accepted: true,
      source_kind: "course",
      source_id: "tdc_kids_draft_a",
      created_at: "2026-04-15T10:00:00.000Z",
      updated_at: "2026-04-15T10:00:00.000Z",
      published_at: null,
      delisted_at: null,
    },
    entitlement_example: {
      id: "ent_manual_listing_access_001",
      user_id: "u_student_demo_001",
      entitlement_type: "manual_grant",
      listing_id: "lst_platform_hsk1_bundle_001",
      teacher_id: null,
      source_type: "admin",
      source_id: "admin_grant_demo_001",
      status: "active",
      starts_at: "2026-04-01T00:00:00.000Z",
      ends_at: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    },
    order_example: {
      id: "ord_placeholder_001",
      buyer_id: "u_student_demo_001",
      listing_id: "lst_platform_hsk1_bundle_001",
      seller_type: "platform",
      teacher_id: null,
      amount: "49000",
      currency: "KRW",
      status: "pending_payment",
      provider: null,
      provider_checkout_id: null,
      provider_payment_id: null,
      commission_type: "platform_rate",
      commission_rate: "0.20",
      commission_amount: null,
      seller_net_amount: null,
      created_at: "2026-04-18T10:00:00.000Z",
      updated_at: "2026-04-18T10:00:00.000Z",
    },
  };
}
