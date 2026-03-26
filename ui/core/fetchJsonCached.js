/**
 * Deduplicates concurrent JSON fetches and caches successful parses by URL string.
 * On failure: in-flight + resolved entry for that URL are cleared so the next call can retry.
 */

const inflight = new Map();
const resolved = new Map();

export function clearFetchJsonCache() {
  inflight.clear();
  resolved.clear();
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
export async function fetchJsonCached(url, init = {}) {
  const key = String(url);
  if (resolved.has(key)) return resolved.get(key);

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = fetch(key, init)
    .then(async (res) => {
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} - ${key}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    })
    .then((data) => {
      resolved.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((e) => {
      inflight.delete(key);
      resolved.delete(key);
      throw e;
    });

  inflight.set(key, p);
  return p;
}
