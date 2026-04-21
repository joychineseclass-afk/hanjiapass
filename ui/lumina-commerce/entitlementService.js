import { ENTITLEMENT_STATUS, ENTITLEMENT_TYPE } from "./enums.js";

/**
 * 页面 / 课程门禁应优先查 entitlement，而非直接推断订单支付成功。
 */

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {import('./schema.js').Entitlement} e
 * @param {string} [atIso]
 * @returns {boolean}
 */
export function isEntitlementActiveAt(e, atIso = nowIso()) {
  if (!e || e.status === ENTITLEMENT_STATUS.revoked) return false;
  if (e.status === ENTITLEMENT_STATUS.expired) return false;
  const t = Date.parse(atIso);
  if (Number.isNaN(t)) return false;
  if (e.starts_at && Date.parse(e.starts_at) > t) return false;
  if (e.ends_at && Date.parse(e.ends_at) < t) return false;
  if (e.status === ENTITLEMENT_STATUS.scheduled) {
    return e.starts_at && Date.parse(e.starts_at) <= t && (!e.ends_at || Date.parse(e.ends_at) >= t);
  }
  return e.status === ENTITLEMENT_STATUS.active;
}

/**
 * 是否对某 listing 有学习权益（含 free_access / listing_access / manual_grant 等指向该 listing 的记录）。
 *
 * @param {import('./schema.js').Entitlement[]} entitlements
 * @param {string} userId
 * @param {string} listingId
 * @param {string} [atIso]
 * @returns {boolean}
 */
export function hasListingAccess(entitlements, userId, listingId, atIso) {
  return entitlements.some((e) => {
    if (e.user_id !== userId) return false;
    if (!e.listing_id || e.listing_id !== listingId) return false;
    const typeOk =
      e.entitlement_type === ENTITLEMENT_TYPE.listing_access ||
      e.entitlement_type === ENTITLEMENT_TYPE.manual_grant ||
      e.entitlement_type === ENTITLEMENT_TYPE.invite ||
      e.entitlement_type === ENTITLEMENT_TYPE.free_access;
    if (!typeOk) return false;
    return isEntitlementActiveAt(e, atIso);
  });
}

/**
 * @param {import('./schema.js').Entitlement[]} entitlements
 * @param {string} userId
 * @param {string} [atIso]
 * @returns {import('./schema.js').Entitlement[]}
 */
export function listActiveEntitlementsForUser(entitlements, userId, atIso) {
  return entitlements.filter((e) => e.user_id === userId && isEntitlementActiveAt(e, atIso));
}
