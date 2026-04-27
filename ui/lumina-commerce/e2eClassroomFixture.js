/**
 * 固定 Lumina 回归用「老师课件 → 上架 → 学生 entitlement → 进课堂」最小 fixture。
 * ID 在 mockSeed、stage0-mock-examples.json 与本模块保持一致；勿与手工创建 id 冲突。
 */
import {
  DEFAULT_SETTLEMENT_CURRENCY,
  DELIVERY_TYPE,
  ENTITLEMENT_SOURCE_TYPE,
  ENTITLEMENT_STATUS,
  ENTITLEMENT_TYPE,
  LISTING_STATUS,
  LISTING_TYPE,
  REFUND_POLICY_TYPE,
  SELLER_TYPE,
  VISIBILITY,
} from "./enums.js";

export const E2E_FIXTURE_LISTING_ID = "lst_e2e_courseware_001";
export const E2E_FIXTURE_ASSET_ID = "tasset_e2e_demo_001";
export const E2E_FIXTURE_ENTITLEMENT_ID = "ent_e2e_courseware_classroom_001";
export const E2E_FIXTURE_DEMO_STUDENT_USER_ID = "u_student_demo_001";
export const E2E_FIXTURE_TEACHER_PROFILE_ID = "tp_demo_seller_001";

const iso = (d) => new Date(d).toISOString();

/**
 * @param {import('./schema.js').CommerceStoreSnapshot} snap
 * @returns {boolean} 是否写入/修改
 */
export function ensureE2eCommerceFixture(snap) {
  if (!snap || !Array.isArray(snap.listings) || !Array.isArray(snap.entitlements)) return false;
  let changed = false;
  if (!snap.listings.some((L) => L && L.id === E2E_FIXTURE_LISTING_ID)) {
    snap.listings.push({
      id: E2E_FIXTURE_LISTING_ID,
      asset_id: E2E_FIXTURE_ASSET_ID,
      seller_type: SELLER_TYPE.teacher,
      teacher_id: E2E_FIXTURE_TEACHER_PROFILE_ID,
      listing_type: LISTING_TYPE.course,
      delivery_type: DELIVERY_TYPE.recorded,
      title: "E2E — Classroom deck (fixture)",
      summary: "End-to-end mock: approved + public + student entitlement.",
      description: "Lumina regression fixture. Linked to tasset_e2e_demo_001.",
      status: LISTING_STATUS.approved,
      visibility: VISIBILITY.public,
      price_amount: "0",
      price_currency: DEFAULT_SETTLEMENT_CURRENCY,
      list_price_amount: null,
      sale_price_amount: null,
      refund_policy_type: REFUND_POLICY_TYPE.within_7_days,
      review_reason_code: null,
      review_reason_text: null,
      ownership_declaration_accepted: true,
      source_kind: "classroom_asset",
      source_id: E2E_FIXTURE_ASSET_ID,
      created_at: iso("2026-04-20T08:00:00.000Z"),
      updated_at: iso("2026-04-20T10:00:00.000Z"),
      published_at: iso("2026-04-20T10:00:00.000Z"),
      delisted_at: null,
    });
    changed = true;
  }
  if (!snap.entitlements.some((e) => e && e.id === E2E_FIXTURE_ENTITLEMENT_ID)) {
    const now = new Date().toISOString();
    snap.entitlements.push({
      id: E2E_FIXTURE_ENTITLEMENT_ID,
      user_id: E2E_FIXTURE_DEMO_STUDENT_USER_ID,
      entitlement_type: ENTITLEMENT_TYPE.free_access,
      listing_id: E2E_FIXTURE_LISTING_ID,
      teacher_id: E2E_FIXTURE_TEACHER_PROFILE_ID,
      source_type: ENTITLEMENT_SOURCE_TYPE.system,
      source_id: "e2e_fixture_grant",
      status: ENTITLEMENT_STATUS.active,
      starts_at: "2026-04-20T00:00:00.000Z",
      ends_at: null,
      created_at: now,
      updated_at: now,
    });
    changed = true;
  }
  return changed;
}
