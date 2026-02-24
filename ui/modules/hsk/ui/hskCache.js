// /ui/modules/hsk/ui/hskCache.js
// ✅ Simple TTL cache helpers

export function createTTLCache({ ttlMs }) {
  const map = new Map();

  function get(key) {
    const hit = map.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > ttlMs) {
      map.delete(key);
      return null;
    }
    return hit.value;
  }

  function set(key, value) {
    map.set(key, { ts: Date.now(), value });
  }

  function clear() {
    map.clear();
  }

  return { get, set, clear, _map: map };
}
