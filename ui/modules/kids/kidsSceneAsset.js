/**
 * Kids 场景资源解析：查缓存 → 未命中则生成 → 返回 imageUrl 或 placeholder。
 */

import { buildKidsScenePrompt } from "./kidsScenePrompt.js";

const CACHE_PREFIX = "lumina_kids_scene_";
const SCENE_IMAGE_CACHE = new Map();

// 随机占位图：用于 Scene Image Engine MVP 测试，不调用实际 AI API
async function generateSceneImage(promptResult) {
  const url = "https://picsum.photos/900/600?random=" + Math.random();
  return {
    ok: true,
    imageUrl: url,
    provider: "placeholder",
  };
}

/**
 * 生成稳定 cache key：{book}-{lessonId}-{sceneType}
 */
export function getKidsSceneCacheKey(sceneMeta) {
  const book = sceneMeta?.promptSeed?.book || "kids1";
  const lessonId = sceneMeta?.promptSeed?.lessonId || "lesson";
  const type = sceneMeta?.type || "classroom_greeting";
  return `${book}-${lessonId}-${type}`;
}

function getCacheStorageKey(cacheKey) {
  return CACHE_PREFIX + (cacheKey || "").replace(/\s/g, "_");
}

function readCache(cacheKey) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(getCacheStorageKey(cacheKey));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.imageUrl === "string" && data.imageUrl) return data;
    return null;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, payload) {
  try {
    if (typeof localStorage === "undefined" || !cacheKey) return;
    localStorage.setItem(getCacheStorageKey(cacheKey), JSON.stringify({
      imageUrl: payload.imageUrl,
      prompt: payload.prompt || "",
      provider: payload.provider || "openai-image",
      createdAt: Date.now(),
    }));
  } catch (_) {}
}

/**
 * 统一解析当前应显示的 scene 资源（异步）：先查缓存，未命中则生成并写缓存。
 * @param {Object} sceneMeta - resolveKidsSceneMeta() 或 resolveKidsSceneMetaForScene() 的返回值
 * @param {Object} [promptOrResult] - buildKidsScenePrompt() 的结果，或省略让内部自行构建
 * @param {string} [explicitCacheKey] - 可选的显式 scene 级 cache key（如 kids1_scene_1_greeting）
 * @returns {Promise<{ mode: string, imageUrl: string, alt: string, prompt: string, shortPrompt: string, cacheKey: string, provider?: string, error?: string }>}
 */
export async function resolveKidsSceneAsset(sceneMeta, promptOrResult, explicitCacheKey) {
  const built =
    promptOrResult && typeof promptOrResult === "object" && "prompt" in promptOrResult
      ? promptOrResult
      : buildKidsScenePrompt(sceneMeta);
  const cacheKey = explicitCacheKey || getKidsSceneCacheKey(sceneMeta);
  const alt = sceneMeta?.title || "Scene";

  if (SCENE_IMAGE_CACHE.has(cacheKey)) {
    return SCENE_IMAGE_CACHE.get(cacheKey);
  }

  const cached = readCache(cacheKey);
  if (cached && cached.imageUrl) {
    const result = {
      mode: "generated",
      imageUrl: cached.imageUrl,
      alt,
      prompt: built.prompt,
      shortPrompt: built.shortPrompt,
      stylePreset: built.stylePreset,
      cacheKey,
      provider: cached.provider || "openai-image",
    };
    SCENE_IMAGE_CACHE.set(cacheKey, result);
    return result;
  }

  const gen = await generateSceneImage(built);
  if (gen.ok && gen.imageUrl) {
    writeCache(cacheKey, { imageUrl: gen.imageUrl, prompt: built.prompt, provider: gen.provider });
    const result = {
      mode: "generated",
      imageUrl: gen.imageUrl,
      alt,
      prompt: built.prompt,
      shortPrompt: built.shortPrompt,
      stylePreset: built.stylePreset,
      cacheKey,
      provider: gen.provider || "openai-image",
    };
    SCENE_IMAGE_CACHE.set(cacheKey, result);
    return result;
  }

  const result = {
    mode: "placeholder",
    imageUrl: "",
    alt,
    prompt: built.prompt,
    shortPrompt: built.shortPrompt,
    stylePreset: built.stylePreset,
    cacheKey,
    error: gen.error || "generation_failed",
  };
  SCENE_IMAGE_CACHE.set(cacheKey, result);
  return result;
}
