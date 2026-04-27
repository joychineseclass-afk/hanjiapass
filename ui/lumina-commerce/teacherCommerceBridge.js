/**
 * 老师内容商业化闭环：检查权限、模拟下单、发放 entitlement、分成分摊（展示级）。
 * 不调用真实支付网关；订单与权益写入 commerce store（localStorage）。
 */
import {
  COMMISSION_TYPE,
  DEFAULT_SETTLEMENT_CURRENCY,
  ENTITLEMENT_SOURCE_TYPE,
  ENTITLEMENT_STATUS,
  ENTITLEMENT_TYPE,
  FULFILLMENT_STATUS,
  LISTING_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRICING_TYPE,
  REVENUE_SHARE_MODEL,
  SELLER_TYPE,
  VISIBILITY,
} from "./enums.js";
import { hasListingAccess } from "./entitlementService.js";
import { getCommerceStoreSync, initCommerceStore, mutateCommerceStore } from "./store.js";

function uid(p) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {Record<string, unknown>} L
 * @returns {string}
 */
export function getListingPricingType(L) {
  const ex = L?.pricing_type != null ? String(L.pricing_type) : "";
  if (ex === PRICING_TYPE.free || ex === PRICING_TYPE.paid) return ex;
  const n = Number(L?.sale_price_amount ?? L?.price_amount ?? 0);
  return !Number.isFinite(n) || n <= 0 ? PRICING_TYPE.free : PRICING_TYPE.paid;
}

/**
 * 应付金额（模拟）：免费为 0，付费优先 sale 价。
 * @param {Record<string, unknown>} L
 * @returns {number}
 */
export function getListingPayableAmount(L) {
  if (getListingPricingType(L) === PRICING_TYPE.free) return 0;
  const a = Number(L?.sale_price_amount ?? L?.price_amount ?? 0);
  return Number.isFinite(a) && a > 0 ? Math.round(a) : 0;
}

/**
 * @param {import('./schema.js').CommerceStoreSnapshot} snap
 * @param {string} userId
 * @param {string} listingId
 * @returns {import('./schema.js').Order|undefined}
 */
function findFulfilledAccessOrder(snap, userId, listingId) {
  return snap.orders?.find(
    (o) =>
      o.buyer_id === userId &&
      o.listing_id === listingId &&
      o.status === ORDER_STATUS.paid &&
      String(o.fulfillment_status || FULFILLMENT_STATUS.granted) === FULFILLMENT_STATUS.granted
  );
}

/**
 * @param {import('./schema.js').CommerceStoreSnapshot} snap
 * @param {string} listingId
 * @param {string} userId
 * @returns {boolean}
 */
export function hasAccessToListing(listingId, userId) {
  const snap = getCommerceStoreSync();
  if (!snap || !listingId || !userId) return false;
  return hasListingAccess(snap.entitlements, userId, listingId);
}

/**
 * @param {string} listingId
 * @param {string} userId
 * @returns {Promise<{
 *   isPublic: boolean,
 *   hasAccess: boolean,
 *   pricingType: string,
 *   amount: number,
 *   currency: string,
 *   isFree: boolean,
 *   canAttemptPurchase: boolean
 * } | null>}
 */
export async function getListingCommerceUiState(listingId, userId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  if (!snap) return null;
  const L = snap.listings.find((l) => l.id === listingId) || null;
  if (!L) return null;
  const isPublic = L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public;
  if (!isPublic) {
    return {
      isPublic: false,
      hasAccess: false,
      pricingType: getListingPricingType(L),
      amount: 0,
      currency: String(L.price_currency || DEFAULT_SETTLEMENT_CURRENCY),
      isFree: true,
      canAttemptPurchase: false,
    };
  }
  const hasAccess = hasListingAccess(snap.entitlements, userId, listingId);
  const pt = getListingPricingType(L);
  const amount = getListingPayableAmount(L);
  const guestBuyer = !userId || userId === "u_guest";
  return {
    isPublic: true,
    hasAccess,
    pricingType: pt,
    amount,
    currency: String(L.price_currency || DEFAULT_SETTLEMENT_CURRENCY),
    isFree: pt === PRICING_TYPE.free,
    canAttemptPurchase: !hasAccess && !guestBuyer,
  };
}

/**
 * 免费/付费统一下单：模拟支付成功，发放 entitlement，不重复写有效单。
 * @param {string} listingId
 * @param {{ id: string }} buyerUser
 * @returns {Promise<
 *   | { ok: true, order: import('./schema.js').Order, entitlement: import('./schema.js').Entitlement, simulated: true }
 *   | { ok: false, code: 'listing_not_found' | 'not_public' | 'already_owned' | 'invalid_price' | 'buyer_required' }
 * >}
 */
export async function purchaseOrGrantListingAccess(listingId, buyerUser) {
  const buyerId = String(buyerUser?.id || "").trim();
  if (!buyerId || buyerId === "u_guest") return { ok: false, code: "buyer_required" };

  await initCommerceStore();
  const snap0 = getCommerceStoreSync();
  if (!snap0) return { ok: false, code: "listing_not_found" };

  const L = snap0.listings.find((l) => l.id === listingId) || null;
  if (!L) return { ok: false, code: "listing_not_found" };
  if (L.status !== LISTING_STATUS.approved || L.visibility !== VISIBILITY.public) {
    return { ok: false, code: "not_public" };
  }

  if (hasListingAccess(snap0.entitlements, buyerId, listingId) || findFulfilledAccessOrder(snap0, buyerId, listingId)) {
    return { ok: false, code: "already_owned" };
  }

  const isFree = getListingPricingType(L) === PRICING_TYPE.free;
  const amountNum = isFree ? 0 : getListingPayableAmount(L);
  if (!isFree && (!Number.isFinite(amountNum) || amountNum <= 0)) {
    return { ok: false, code: "invalid_price" };
  }

  const tr = parseFloat(String(L.teacher_share_rate ?? "0.7")) || 0.7;
  const pr = parseFloat(String(L.platform_share_rate ?? "0.3")) || 0.3;
  const currency = String(L.price_currency || DEFAULT_SETTLEMENT_CURRENCY);
  const teacherTid = L.seller_type === SELLER_TYPE.teacher ? L.teacher_id : null;
  const platformAmt = String(Math.round(amountNum * pr));
  const teacherNet = String(Math.round(amountNum * tr));

  const now = new Date().toISOString();
  const orderId = uid("ord");
  const entId = uid("ent");
  let wrote = false;

  /** @type {import('./schema.js').Entitlement} */
  const ent = {
    id: entId,
    user_id: buyerId,
    entitlement_type: ENTITLEMENT_TYPE.listing_access,
    listing_id: L.id,
    teacher_id: teacherTid,
    source_type: ENTITLEMENT_SOURCE_TYPE.order,
    source_id: orderId,
    status: ENTITLEMENT_STATUS.active,
    starts_at: now,
    ends_at: null,
    created_at: now,
    updated_at: now,
  };

  /** @type {import('./schema.js').Order} */
  const order = {
    id: orderId,
    buyer_id: buyerId,
    listing_id: L.id,
    seller_type: L.seller_type,
    teacher_id: teacherTid,
    amount: String(amountNum),
    currency,
    status: ORDER_STATUS.paid,
    payment_status: PAYMENT_STATUS.simulated_paid,
    fulfillment_status: FULFILLMENT_STATUS.granted,
    entitlement_id: entId,
    teacher_profile_id: teacherTid,
    platform_income_amount: platformAmt,
    provider: "simulated",
    provider_checkout_id: `sim_${orderId}`,
    provider_payment_id: `sim_pay_${orderId}`,
    commission_type: COMMISSION_TYPE.platform_rate,
    commission_rate: String(pr),
    commission_amount: platformAmt,
    seller_net_amount: teacherNet,
    created_at: now,
    updated_at: now,
  };

  mutateCommerceStore((draft) => {
    if (hasListingAccess(draft.entitlements, buyerId, L.id) || findFulfilledAccessOrder(/** @type {any} */ (draft), buyerId, L.id)) {
      return;
    }
    if (!Array.isArray(draft.entitlements)) draft.entitlements = [];
    if (!Array.isArray(draft.orders)) draft.orders = [];
    draft.entitlements.push(ent);
    draft.orders.push(order);
    wrote = true;
  });

  if (!wrote) return { ok: false, code: "already_owned" };

  const snap1 = getCommerceStoreSync();
  const o2 = snap1?.orders.find((o) => o.id === orderId) || order;
  const e2 = snap1?.entitlements.find((e) => e.id === entId) || ent;
  return { ok: true, order: o2, entitlement: e2, simulated: true };
}

/**
 * @param {string} userId
 * @returns {import('./schema.js').Order[]}
 */
export function listOrdersForBuyer(userId) {
  const snap = getCommerceStoreSync();
  if (!snap || !userId) return [];
  return (snap.orders || []).filter((o) => o.buyer_id === userId).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/**
 * @param {string} profileId 老师 teacher profile id
 * @returns {import('./schema.js').Order[]}
 */
export function listOrdersForTeacherProfile(profileId) {
  const snap = getCommerceStoreSync();
  if (!snap || !profileId) return [];
  return (snap.orders || [])
    .filter((o) => {
      const L = snap.listings.find((l) => l.id === o.listing_id);
      return L && L.teacher_id === profileId;
    })
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/**
 * @param {import('./schema.js').CommerceStoreSnapshot} snap
 * @param {string} profileId
 * @param {(oid: string) => string|undefined} [formatTitle] order → listing title
 */
export function getTeacherProfileCommerceStats(snap, profileId) {
  const out = {
    publicListingCount: 0,
    grantOrSaleCount: 0,
    totalTeacherIncome: 0,
    totalPlatformIncome: 0,
    totalGross: 0,
  };
  if (!snap || !profileId) return out;
  for (const L of snap.listings) {
    if (String(L.teacher_id) !== profileId) continue;
    if (L.status === LISTING_STATUS.approved && L.visibility === VISIBILITY.public) out.publicListingCount += 1;
  }
  for (const o of snap.orders || []) {
    if (o.status !== ORDER_STATUS.paid) continue;
    const L = snap.listings.find((l) => l.id === o.listing_id);
    if (!L || String(L.teacher_id) !== profileId) continue;
    out.grantOrSaleCount += 1;
    const g = Number(o.amount) || 0;
    out.totalGross += g;
    out.totalTeacherIncome += Number(o.seller_net_amount) || 0;
    out.totalPlatformIncome += Number(o.commission_amount ?? o.platform_income_amount) || 0;
  }
  return out;
}

/**
 * @param {import('./schema.js').CommerceStoreSnapshot} snap
 * @param {string} listingId
 * @returns {number}
 */
export function countGrantsForListing(snap, listingId) {
  if (!snap?.orders || !listingId) return 0;
  return snap.orders.filter(
    (o) =>
      o.listing_id === listingId && o.status === ORDER_STATUS.paid && o.fulfillment_status === FULFILLMENT_STATUS.granted
  ).length;
}

/**
 * 更新老师资产的 listing 定价（最小编辑；仅内存 store）。
 * @param {string} listingId
 * @param {{ pricing_type: 'free'|'paid', price_amount?: string|number, teacher_profile_id: string }} p
 * @returns {{ ok: boolean, code?: string }}
 */
export function updateListingPricingForTeacher(listingId, p) {
  const pt = p.pricing_type;
  if (pt !== PRICING_TYPE.free && pt !== PRICING_TYPE.paid) return { ok: false, code: "invalid_type" };
  mutateCommerceStore((draft) => {
    const L = draft.listings.find((l) => l.id === listingId);
    if (!L || String(L.teacher_id) !== p.teacher_profile_id) return;
    L.pricing_type = pt;
    L.revenue_share_model = L.revenue_share_model || REVENUE_SHARE_MODEL.platform_split;
    L.teacher_share_rate = L.teacher_share_rate ?? "0.7";
    L.platform_share_rate = L.platform_share_rate ?? "0.3";
    if (pt === PRICING_TYPE.free) {
      L.price_amount = "0";
      L.sale_price_amount = "0";
    } else {
      const n = Math.max(0, Math.round(Number(p.price_amount ?? L.price_amount ?? 0)));
      L.price_amount = String(n);
      L.sale_price_amount = String(n);
    }
    L.price_currency = L.price_currency || DEFAULT_SETTLEMENT_CURRENCY;
    L.updated_at = new Date().toISOString();
  });
  return { ok: true };
}
