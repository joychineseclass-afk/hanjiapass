import { LISTING_STATUS } from "./enums.js";

/** @type {Record<string, string[]>} */
const ALLOWED = {
  [LISTING_STATUS.draft]: [LISTING_STATUS.pending_review],
  [LISTING_STATUS.pending_review]: [LISTING_STATUS.approved, LISTING_STATUS.rejected],
  [LISTING_STATUS.approved]: [LISTING_STATUS.delisted, LISTING_STATUS.archived],
  [LISTING_STATUS.rejected]: [LISTING_STATUS.pending_review, LISTING_STATUS.archived],
  [LISTING_STATUS.delisted]: [LISTING_STATUS.approved, LISTING_STATUS.archived],
  [LISTING_STATUS.archived]: [],
  [LISTING_STATUS.appeal_pending]: [],
};

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransitionListingStatus(from, to) {
  const next = ALLOWED[from];
  if (!next) return false;
  return next.includes(to);
}

/**
 * @param {string} status
 * @returns {string[]}
 */
export function listingStatusTransitionsFrom(status) {
  return [...(ALLOWED[status] || [])];
}
