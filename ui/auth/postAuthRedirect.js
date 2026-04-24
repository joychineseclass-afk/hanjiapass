/**
 * 登录/注册后落地：与 resolveSessionRoute 配合，用 sessionStorage 存「登录成功后要去的目标 hash」
 */

const STORAGE_KEY = "lumina_post_auth_target_hash_v1";

/** 默认第一课：HSK 2.0 · 一级 · 第 1 课（考试学习 → HSK 内嵌，稳定有数据） */
export const LUMINA_DEFAULT_LEARNING_ENTRY_HASH =
  "#exam-learning?tab=hsk&ver=hsk2.0&lv=1&lesson=1";

function safeParseHash(h) {
  const s = String(h || "").trim();
  if (!s.startsWith("#")) return null;
  if (s.length < 2) return null;
  return s;
}

export function setPendingPostAuthTargetHash(hash) {
  const ok = safeParseHash(hash);
  if (!ok) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, ok);
  } catch {
    /* */
  }
}

export function getPendingPostAuthTargetHash() {
  try {
    return safeParseHash(sessionStorage.getItem(STORAGE_KEY) || "");
  } catch {
    return null;
  }
}

export function clearPendingPostAuthTargetHash() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}

/** 读取并清除；若无则返回 null */
export function consumePendingPostAuthTargetHash() {
  const h = getPendingPostAuthTargetHash();
  if (h) clearPendingPostAuthTargetHash();
  return h;
}
