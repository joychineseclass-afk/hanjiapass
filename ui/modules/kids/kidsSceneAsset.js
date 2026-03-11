/**
 * Kids 场景资源解析：查缓存 → 未命中则生成 → 返回 imageUrl 或 placeholder。
 */

import { buildKidsScenePrompt } from "./kidsScenePrompt.js";
import { generateKidsSceneImage } from "./kidsSceneGenerator.js";

const CACHE_PREFIX = "lumina_kids_scene_";

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
 * @param {Object} sceneMeta - resolveKidsSceneMeta() 的返回值
 * @param {Object} [promptResult] - buildKidsScenePrompt() 的结果；不传则内部调用一次
 * @returns {Promise<{ mode: string, imageUrl: string, alt: string, prompt: string, shortPrompt: string, cacheKey: string, provider?: string, error?: string }>}
 */
export async function resolveKidsSceneAsset(sceneMeta, promptResult) {
  const built = promptResult || buildKidsScenePrompt(sceneMeta);
  const cacheKey = getKidsSceneCacheKey(sceneMeta);
  const alt = sceneMeta?.title || "Scene";

  const cached = readCache(cacheKey);
  if (cached && cached.imageUrl) {
    return {
      mode: "generated",
      imageUrl: cached.imageUrl,
      alt,
      prompt: built.prompt,
      shortPrompt: built.shortPrompt,
      stylePreset: built.stylePreset,
      cacheKey,
      provider: cached.provider || "openai-image",
    };
  }

  const gen = await generateKidsSceneImage(sceneMeta, built);
  if (gen.ok && gen.imageUrl) {
    writeCache(cacheKey, { imageUrl: gen.imageUrl, prompt: built.prompt, provider: gen.provider });
    return {
      mode: "generated",
      imageUrl: gen.imageUrl,
      alt,
      prompt: built.prompt,
      shortPrompt: built.shortPrompt,
      stylePreset: built.stylePreset,
      cacheKey,
      provider: gen.provider || "openai-image",
    };
  }

  return {
    mode: "placeholder",
    imageUrl: "",
    alt,
    prompt: built.prompt,
    shortPrompt: built.shortPrompt,
    stylePreset: built.stylePreset,
    cacheKey,
    error: gen.error || "generation_failed",
  };
}
