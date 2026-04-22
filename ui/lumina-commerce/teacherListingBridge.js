/**
 * 课堂资产 ↔ Commerce listing 桥接：确保 listing、提交审核、按 asset 查找。
 * 不替代 store；所有写入经 mutateCommerceStore。
 */
import {
  DEFAULT_SETTLEMENT_CURRENCY,
  DELIVERY_TYPE,
  LISTING_REVIEW_ACTION,
  LISTING_STATUS,
  LISTING_TYPE,
  PRICING_TYPE,
  REFUND_POLICY_TYPE,
  REVENUE_SHARE_MODEL,
  SELLER_TYPE,
  VISIBILITY,
} from "./enums.js";
import { canTransitionListingStatus } from "./listingStateMachine.js";
import {
  assertCanSubmitClassroomAssetListing,
  assertCanSubmitListingForReview,
} from "./teacherRules.js";
import { initCommerceStore, getCommerceStoreSync, mutateCommerceStore } from "./store.js";
import { findAssetById, ASSET_STATUS } from "./teacherAssetsStore.js";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {import('./schema.js').CommerceStoreSnapshot|Record<string, unknown>|null|undefined} snap
 * @param {string} assetId
 * @returns {import('./schema.js').Listing|null}
 */
export function findListingByAssetId(snap, assetId) {
  if (!snap || !assetId) return null;
  const id = String(assetId);
  const listings = /** @type {import('./schema.js').Listing[]} */ (snap.listings || []);
  return (
    listings.find(
      (L) =>
        (L.asset_id && String(L.asset_id) === id) ||
        (String(L.source_kind) === "classroom_asset" && L.source_id && String(L.source_id) === id),
    ) || null
  );
}

/**
 * 将老师课件资产字段映射为「发布项」展示文案（不写入整段教师私有备注）。
 * @param {import('./teacherAssetsStore.js').TeacherClassroomAsset} asset
 * @returns {{ title: string, summary: string, description: string }}
 */
export function listingDisplayFieldsFromClassroomAsset(asset) {
  const title = String(asset.title || "").trim() || "—";
  const sub = String(asset.subtitle || "").trim();
  const sum = String(asset.summary || "").trim();
  const cover = String(asset.cover_note || "").trim();
  const oneLine = [sub, sum].filter(Boolean);
  const summary = (oneLine.length ? oneLine.join(" · ") : sum || title).slice(0, 500);
  const descParts = [];
  if (sub) descParts.push(sub);
  if (sum) descParts.push(sum);
  if (cover) descParts.push(cover);
  const description = descParts.join("\n\n").trim() || sum || title;
  return { title, summary, description };
}

/**
 * 保存课件后，将标题/副标题/说明等同步到已绑定的发布项，便于公开展示与审核台。
 * @param {string} assetId
 * @returns {{ ok: true, updated: boolean } | { ok: false, code: string }}
 */
export function syncClassroomAssetListingFromAsset(assetId) {
  const asset = findAssetById(String(assetId));
  if (!asset) return { ok: false, code: "asset_not_found" };
  const snap = getCommerceStoreSync();
  if (!snap) return { ok: false, code: "store_unavailable" };
  const L = findListingByAssetId(snap, asset.id);
  if (!L) return { ok: true, updated: false };
  const f = listingDisplayFieldsFromClassroomAsset(asset);
  mutateCommerceStore((draft) => {
    const row = draft.listings.find((x) => x.id === L.id);
    if (!row) return;
    row.title = f.title;
    row.summary = f.summary;
    row.description = f.description;
    row.asset_id = asset.id;
    row.source_id = asset.id;
    row.source_kind = "classroom_asset";
    row.updated_at = new Date().toISOString();
  });
  return { ok: true, updated: true };
}

/**
 * 教师会话态：是否可预览未公开/未过审的 listing（本地规则，非正式 ACL）。
 * @param {import('./schema.js').CommerceStoreSnapshot|Record<string, unknown>|null|undefined} _snap
 * @param {import('./schema.js').Listing} listing
 * @param {{ id?: string, teacherProfileId?: string | null, isGuest?: boolean } | null | undefined} user
 * @returns {boolean}
 */
export function canCurrentUserPreviewTeacherListing(_snap, listing, user) {
  if (!listing || !user || user.isGuest) return false;
  const uid = String(user.id || "");
  if (!uid || uid === "u_guest") return false;
  const lTid = listing.teacher_id != null ? String(listing.teacher_id) : "";
  const uTid = user.teacherProfileId != null ? String(user.teacherProfileId) : "";
  if (lTid && uTid && lTid === uTid) return true;
  if (String(listing.source_kind) === "classroom_asset" && listing.source_id) {
    const asset = findAssetById(String(listing.source_id));
    if (asset) {
      if (String(asset.owner_user_id) === uid) return true;
      if (uTid && String(asset.teacher_profile_id) === uTid) return true;
    }
  }
  return false;
}

/**
 * @param {string} at
 * @returns {import('./enums.js').ListingType}
 */
function listingTypeFromAssetType(at) {
  if (at === "teacher_note_draft" || at === "classroom_material") return LISTING_TYPE.material;
  return LISTING_TYPE.ppt;
}

/**
 * @param {string} assetId
 * @returns {Promise<{ ok: true, listing: import('./schema.js').Listing, created: boolean } | { ok: false, code: string }>}
 */
export async function ensureListingForTeacherAsset(assetId) {
  await initCommerceStore();
  const snap = getCommerceStoreSync();
  if (!snap) return { ok: false, code: "store_unavailable" };
  const asset = findAssetById(String(assetId));
  if (!asset) return { ok: false, code: "asset_not_found" };
  if (asset.status === ASSET_STATUS.archived) return { ok: false, code: "asset_archived" };

  const existing = findListingByAssetId(snap, asset.id);
  if (existing) return { ok: true, listing: existing, created: false };

  const copy = listingDisplayFieldsFromClassroomAsset(asset);
  mutateCommerceStore((draft) => {
    const now = new Date().toISOString();
    const listing = {
      id: uid("lst"),
      seller_type: SELLER_TYPE.teacher,
      teacher_id: asset.teacher_profile_id,
      listing_type: listingTypeFromAssetType(asset.asset_type),
      delivery_type: DELIVERY_TYPE.downloadable,
      title: copy.title,
      summary: copy.summary,
      description: copy.description,
      status: LISTING_STATUS.draft,
      visibility: VISIBILITY.private,
      price_amount: "0",
      price_currency: DEFAULT_SETTLEMENT_CURRENCY,
      list_price_amount: null,
      sale_price_amount: null,
      refund_policy_type: REFUND_POLICY_TYPE.no_refund,
      review_reason_code: null,
      review_reason_text: null,
      ownership_declaration_accepted: true,
      source_kind: "classroom_asset",
      source_id: asset.id,
      asset_id: asset.id,
      created_at: now,
      updated_at: now,
      published_at: null,
      delisted_at: null,
      pricing_type: PRICING_TYPE.free,
      revenue_share_model: REVENUE_SHARE_MODEL.platform_split,
      teacher_share_rate: "0.7",
      platform_share_rate: "0.3",
    };
    draft.listings.push(/** @type {import('./schema.js').Listing} */ (listing));
  });

  const after = getCommerceStoreSync();
  const L = after ? findListingByAssetId(after, asset.id) : null;
  if (!L) return { ok: false, code: "listing_create_failed" };
  return { ok: true, listing: L, created: true };
}

/**
 * @param {import('./schema.js').Listing} L
 * @param {import('./schema.js').TeacherSellerProfile|null} tp
 */
function gateSubmit(L, tp) {
  if (String(L.source_kind) === "classroom_asset") {
    return assertCanSubmitClassroomAssetListing(tp, L);
  }
  return assertCanSubmitListingForReview(tp, L);
}

/**
 * @param {string} assetId
 * @param {string} [actingUserId] 写入 review log
 * @returns {Promise<
 *   | { ok: true, listing: import('./schema.js').Listing }
 *   | { ok: false, code: string }
 * >}
 */
export async function submitTeacherAssetListingForReview(assetId, actingUserId) {
  const ensured = await ensureListingForTeacherAsset(assetId);
  if (!ensured.ok) return ensured;
  const L0 = ensured.listing;
  if (L0.status === LISTING_STATUS.pending_review) {
    return { ok: false, code: "already_pending" };
  }
  if (!canTransitionListingStatus(L0.status, LISTING_STATUS.pending_review)) {
    return { ok: false, code: "invalid_listing_state" };
  }

  const asset = findAssetById(String(assetId));
  if (!asset) return { ok: false, code: "asset_not_found" };
  if (asset.status === ASSET_STATUS.archived) return { ok: false, code: "asset_archived" };

  await initCommerceStore();
  const snap = getCommerceStoreSync();
  if (!snap) return { ok: false, code: "store_unavailable" };
  const tp = snap.teacher_profiles.find((x) => x.id === L0.teacher_id) || null;
  const gate = gateSubmit(L0, tp);
  if (!gate.ok) return { ok: false, code: gate.code || "submit_denied" };

  const reviewer = String(actingUserId || "u_teacher_demo_001");
  mutateCommerceStore((draft) => {
    const row = draft.listings.find((x) => x.id === L0.id);
    if (!row) return;
    if (!canTransitionListingStatus(row.status, LISTING_STATUS.pending_review)) return;
    const now = new Date().toISOString();
    row.status = LISTING_STATUS.pending_review;
    row.updated_at = now;
    draft.listing_review_logs.push({
      id: uid("lrl"),
      listing_id: row.id,
      reviewer_user_id: reviewer,
      action: LISTING_REVIEW_ACTION.submitted,
      reason_code: null,
      reason_text: null,
      created_at: now,
    });
  });
  const after = getCommerceStoreSync();
  const L = after ? findListingByAssetId(after, String(assetId)) : null;
  if (!L) return { ok: false, code: "listing_missing" };
  return { ok: true, listing: L };
}

/**
 * 审核通过且老师希望公开展示时，将 visibility 设为 public（不改变 approved 态）。
 * @param {string} assetId
 * @param {string} teacherProfileId
 * @returns {Promise<{ ok: boolean, code?: string, listing?: import('./schema.js').Listing }>}
 */
export async function setClassroomAssetListingToPublic(assetId, teacherProfileId) {
  await initCommerceStore();
  const L = findListingByAssetId(getCommerceStoreSync(), assetId);
  if (!L) return { ok: false, code: "listing_not_found" };
  if (L.teacher_id !== teacherProfileId) return { ok: false, code: "teacher_mismatch" };
  if (L.status !== LISTING_STATUS.approved) return { ok: false, code: "not_approved" };
  mutateCommerceStore((draft) => {
    const row = draft.listings.find((x) => x.id === L.id);
    if (!row) return;
    row.visibility = VISIBILITY.public;
    row.updated_at = new Date().toISOString();
  });
  const after = getCommerceStoreSync();
  const u = after ? findListingByAssetId(after, String(assetId)) : null;
  return u ? { ok: true, listing: u } : { ok: false, code: "listing_missing" };
}

/**
 * @param {string} teacherProfileId
 * @param {string} currentUserId
 * @param {import('./schema.js').Listing|null} listing
 * @param {import('./teacherAssetsStore.js').TeacherClassroomAsset} asset
 * @param {(k: string) => string} t
 * @returns {{ submitLabel: string, canSubmit: boolean, submitReason?: string, listingStateLabel: string, hasListing: boolean }}
 */
export function getTeacherAssetPublishUiState(teacherProfileId, currentUserId, listing, asset, t) {
  const hasListing = Boolean(listing);
  if (asset.teacher_profile_id !== teacherProfileId) {
    return {
      hasListing,
      canSubmit: false,
      submitReason: t("teacher.publishing.error.teacher_mismatch"),
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: t("teacher.publishing.state.none"),
    };
  }
  if (asset.owner_user_id && currentUserId && asset.owner_user_id !== currentUserId) {
    return {
      hasListing,
      canSubmit: false,
      submitReason: t("teacher.publishing.error.forbidden"),
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: t("teacher.publishing.state.none"),
    };
  }
  if (asset.status === ASSET_STATUS.archived) {
    return {
      hasListing,
      canSubmit: false,
      submitReason: t("teacher.publishing.error.asset_archived"),
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: hasListing ? listingStateKey(listing, t) : t("teacher.publishing.state.no_listing"),
    };
  }

  if (!listing) {
    return {
      hasListing: false,
      canSubmit: true,
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: t("teacher.publishing.state.no_listing"),
      listing: null,
    };
  }

  const st = listing.status;
  if (st === LISTING_STATUS.pending_review) {
    return {
      hasListing: true,
      canSubmit: false,
      submitReason: t("teacher.publishing.error.already_pending"),
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: t("teacher.publishing.state.pending"),
    };
  }
  if (st === LISTING_STATUS.draft || st === LISTING_STATUS.rejected) {
    return {
      hasListing: true,
      canSubmit: true,
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: listingStateKey(listing, t),
    };
  }
  if (st === LISTING_STATUS.approved) {
    return {
      hasListing: true,
      canSubmit: false,
      submitLabel: t("teacher.publishing.submit_review"),
      listingStateLabel: t("teacher.publishing.state.approved"),
    };
  }
  return {
    hasListing: true,
    canSubmit: false,
    listingStateLabel: listingStateKey(listing, t),
  };
}

/**
 * @param {import('./schema.js').Listing} L
 * @param {(k: string) => string} t
 */
function listingStateKey(L, t) {
  const s = L.status;
  if (s === "pending_review") return t("teacher.publishing.state.pending");
  if (s === "approved") return t("teacher.publishing.state.approved");
  if (s === "rejected") return t("teacher.publishing.state.rejected");
  if (s === "draft") return t("teacher.publishing.state.draft");
  return s;
}

/**
 * 课件编辑页 #teacher-asset-editor：发布区状态与按钮显隐
 * @param {string} teacherProfileId
 * @param {string} currentUserId
 * @param {import('./schema.js').Listing|null} listing
 * @param {import('./teacherAssetsStore.js').TeacherClassroomAsset} asset
 * @param {(k: string, p?: object) => string} t
 */
export function getAssetEditorPublishingModel(teacherProfileId, currentUserId, listing, asset, t) {
  const base = getTeacherAssetPublishUiState(teacherProfileId, currentUserId, listing, asset, t);
  const hasListing = base.hasListing;
  const isPublic = Boolean(
    listing && listing.status === LISTING_STATUS.approved && listing.visibility === VISIBILITY.public,
  );
  const canCreate = !hasListing && asset.status !== ASSET_STATUS.archived;
  const canGoPublic =
    Boolean(listing) &&
    listing.status === LISTING_STATUS.approved &&
    listing.visibility !== VISIBILITY.public &&
    String(asset.teacher_profile_id) === String(teacherProfileId) &&
    (!currentUserId || !asset.owner_user_id || String(asset.owner_user_id) === String(currentUserId));
  return {
    hasListing: Boolean(listing),
    listingId: listing?.id || "",
    listingStateLine: base.listingStateLabel,
    canSubmit: base.canSubmit,
    submitReason: base.submitReason,
    isPublic,
    canCreate,
    canGoPublic,
    showViewPublic: hasListing && isPublic,
    showPreviewListing: Boolean(listing?.id) && !isPublic,
    showViewListingConsole: hasListing,
  };
}
