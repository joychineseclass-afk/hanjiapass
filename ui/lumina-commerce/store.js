import { SCHEMA_VERSION_STAGE0 } from "./schema.js";
import { builtinStage0Examples, createInitialStoreSnapshot } from "./mockSeed.js";

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
      return _cache;
    }
    let examples = builtinStage0Examples();
    try {
      examples = await fetchExamplesJson();
    } catch {
      /* use builtin */
    }
    _cache = createInitialStoreSnapshot(examples);
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
