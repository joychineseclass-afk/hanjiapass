/**
 * 자유 질문：内存 + sessionStorage 轻缓存（TTL，不存失败/空答案）
 */

const STORAGE_PREFIX = "luminaFreeTalk_v1_";
const TTL_MS = 30 * 60 * 1000;

/** @type {Map<string, { expiresAt: number, value: object }>} */
const memoryCache = new Map();

/**
 * 问题规范化：trim、空白合并、全角空格、换行合并；仅对 ASCII 字母转小写
 * @param {string} q
 * @returns {string}
 */
export function normalizeQuestion(q) {
  let s = String(q || "").trim();
  s = s.replace(/\u3000/g, " ");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\s+/g, " ");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else if (code >= 97 && code <= 122) out += ch;
    else out += ch;
  }
  return out.trim();
}

/**
 * @param {string} courseId
 * @param {string} lessonId
 * @param {string} uiLang
 * @param {string} normalizedQuestion
 * @returns {string}
 */
export function makeCacheKey(courseId, lessonId, uiLang, normalizedQuestion) {
  return JSON.stringify([
    String(courseId ?? ""),
    String(lessonId ?? ""),
    String(uiLang ?? "").toLowerCase(),
    normalizedQuestion,
  ]);
}

function hashKey(cacheKey) {
  let h = 0;
  for (let i = 0; i < cacheKey.length; i++) {
    h = (Math.imul(31, h) + cacheKey.charCodeAt(i)) | 0;
  }
  return STORAGE_PREFIX + (h >>> 0).toString(16);
}

/**
 * @param {object} result — runTutor 返回值 { text, raw, error?, usedMock? }
 */
export function shouldCacheFreeTalkAnswer(result) {
  if (!result || result.error || result.usedMock) {
    return false;
  }
  const text = String(result.text ?? "").trim();
  if (!text) return false;
  const outer = result.raw && typeof result.raw === "object" ? result.raw : null;
  const payload =
    outer && outer.raw && typeof outer.raw === "object"
      ? outer.raw
      : outer && (typeof outer.fallback === "boolean" || outer.luminaResponseSource != null)
        ? outer
        : null;
  if (!payload || typeof payload !== "object") return false;
  if (payload.fallback === true) return false;
  if (payload.luminaResponseSource != null && payload.luminaResponseSource !== "gemini") return false;
  return true;
}

/**
 * @returns {null | { answerText: string, question: string, normalizedQuestion: string, courseId: string, lessonId: string, uiLang: string, createdAt: number, source: string, cacheKey: string }}
 */
export function getCachedAnswer(courseId, lessonId, uiLang, rawQuestion) {
  const normalizedQuestion = normalizeQuestion(rawQuestion);
  const cacheKey = makeCacheKey(courseId, lessonId, uiLang, normalizedQuestion);
  const now = Date.now();

  const entry = memoryCache.get(cacheKey);
  if (entry && entry.expiresAt > now && entry.value?.answerText) {
    console.info("[HANJIPASS freeTalk] cache hit", { layer: "memory", lessonId, uiLang });
    return entry.value;
  }
  if (entry && entry.expiresAt <= now) memoryCache.delete(cacheKey);

  removeExpiredSessionEntries();

  const sk = hashKey(cacheKey);
  try {
    const raw = sessionStorage.getItem(sk);
    if (!raw) {
      console.info("[HANJIPASS freeTalk] cache miss", { lessonId, uiLang });
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed.cacheKey !== cacheKey) {
      sessionStorage.removeItem(sk);
      console.info("[HANJIPASS freeTalk] cache miss", { reason: "key_mismatch" });
      return null;
    }
    if (parsed.expiresAt <= now) {
      sessionStorage.removeItem(sk);
      console.info("[HANJIPASS freeTalk] cache miss", { reason: "expired" });
      return null;
    }
    memoryCache.set(cacheKey, { expiresAt: parsed.expiresAt, value: parsed });
    console.info("[HANJIPASS freeTalk] cache hit", { layer: "sessionStorage", lessonId, uiLang });
    return parsed;
  } catch {
    console.info("[HANJIPASS freeTalk] cache miss", { reason: "parse_error" });
    return null;
  }
}

/**
 * @param {string} finalAnswerText — 已通过 formatTutorOutput 的最终展示文本（或与之等价）
 */
export function setCachedAnswer(courseId, lessonId, uiLang, rawQuestion, finalAnswerText, source = "gemini") {
  const normalizedQuestion = normalizeQuestion(rawQuestion);
  const cacheKey = makeCacheKey(courseId, lessonId, uiLang, normalizedQuestion);
  const expiresAt = Date.now() + TTL_MS;
  const value = {
    answerText: String(finalAnswerText ?? ""),
    question: String(rawQuestion ?? ""),
    normalizedQuestion,
    courseId: String(courseId ?? ""),
    lessonId: String(lessonId ?? ""),
    uiLang: String(uiLang ?? ""),
    createdAt: Date.now(),
    source,
    cacheKey,
    expiresAt,
  };
  memoryCache.set(cacheKey, { expiresAt, value });
  try {
    const sk = hashKey(cacheKey);
    sessionStorage.setItem(sk, JSON.stringify(value));
    console.info("[HANJIPASS freeTalk] cache set", { lessonId, uiLang, ttlMin: 30 });
  } catch (e) {
    console.warn("[HANJIPASS freeTalk] cache set sessionStorage failed", e?.message || e);
  }
}

export function removeExpiredSessionEntries() {
  const now = Date.now();
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      try {
        const raw = sessionStorage.getItem(k);
        if (!raw) continue;
        const p = JSON.parse(raw);
        if (p.expiresAt != null && p.expiresAt <= now) sessionStorage.removeItem(k);
      } catch {
        sessionStorage.removeItem(k);
      }
    }
  } catch (_) {}
}

export const FREE_TALK_CACHE_TTL_MS = TTL_MS;
