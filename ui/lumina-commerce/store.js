import { SCHEMA_VERSION_STAGE0 } from "./schema.js";
import { PRICING_TYPE, REVENUE_SHARE_MODEL } from "./enums.js";
import { builtinStage0Examples, createInitialStoreSnapshot } from "./mockSeed.js";
import { ensureE2eCommerceFixture } from "./e2eClassroomFixture.js";

/**
 * 老数据补全 Step5 商业字段（不改变 schema_version，仅补字段）。
 * @param {import('./schema.js').CommerceStoreSnapshot} snap
 * @returns {boolean} 是否改过
 */
function applyCommerceStep5Defaults(snap) {
  let changed = false;
  if (Array.isArray(snap.listings)) {
    for (const L of snap.listings) {
      if (!L) continue;
      if (L.pricing_type == null || L.pricing_type === undefined) {
        const amt = Number(L.price_amount);
        L.pricing_type = !Number.isFinite(amt) || amt <= 0 ? PRICING_TYPE.free : PRICING_TYPE.paid;
        changed = true;
      }
      if (L.revenue_share_model == null) {
        L.revenue_share_model = REVENUE_SHARE_MODEL.platform_split;
        changed = true;
      }
      if (L.teacher_share_rate == null) {
        L.teacher_share_rate = "0.7";
        changed = true;
      }
      if (L.platform_share_rate == null) {
        L.platform_share_rate = "0.3";
        changed = true;
      }
    }
  }
  return changed;
}

const LS_KEY = "lumina_commerce_stage0_store_v1";

/**
 * @typedef {ReturnType<typeof createInitialStoreSnapshot>} CommerceStoreSnapshot
 */

/**
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchExamplesJson() {
  const url = new URL("../../data/lumina/stage0-mock-examples.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch examples failed: ${res.status}`);
  return /** @type {Record<string, unknown>} */ (await res.json());
}

/**
 * @returns {CommerceStoreSnapshot}
 */
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema_version !== SCHEMA_VERSION_STAGE0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {CommerceStoreSnapshot} snap
 */
function saveToLocalStorage(snap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
}

let _cache = /** @type {CommerceStoreSnapshot|null} */ (null);
let _initPromise = /** @type {Promise<CommerceStoreSnapshot>|null} */ (null);

/**
 * 初始化商店：优先 localStorage，否则拉 JSON 种子。
 * @returns {Promise<CommerceStoreSnapshot>}
 */
export function initCommerceStore() {
  if (_cache) return Promise.resolve(_cache);
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const existing = loadFromLocalStorage();
    if (existing) {
      _cache = existing;
      let needsSave = false;
      if (applyCommerceStep5Defaults(_cache)) needsSave = true;
      if (ensureE2eCommerceFixture(_cache)) needsSave = true;
      if (applyCommerceStep5Defaults(_cache)) needsSave = true;
      if (needsSave) saveToLocalStorage(_cache);
      return _cache;
    }
    let examples = builtinStage0Examples();
    try {
      examples = await fetchExamplesJson();
    } catch {
      /* use builtin */
    }
    _cache = createInitialStoreSnapshot(examples);
    applyCommerceStep5Defaults(_cache);
    ensureE2eCommerceFixture(_cache);
    applyCommerceStep5Defaults(_cache);
    saveToLocalStorage(_cache);
    return _cache;
  })();

  return _initPromise;
}

/** @returns {CommerceStoreSnapshot|null} */
export function getCommerceStoreSync() {
  return _cache;
}

/**
 * @param {(draft: CommerceStoreSnapshot) => void} fn
 */
export function mutateCommerceStore(fn) {
  if (!_cache) throw new Error("mutateCommerceStore: store not initialized");
  fn(_cache);
  saveToLocalStorage(_cache);
}

export function resetCommerceStoreToSeed() {
  localStorage.removeItem(LS_KEY);
  _cache = null;
  _initPromise = null;
  return initCommerceStore();
}

/**
 * @param {string} userId
 * @param {import('./enums.js').UserRole} role
 */
export function userHasRole(snapshot, userId, role) {
  return snapshot.user_roles.some((r) => r.user_id === userId && r.role === role);
}
