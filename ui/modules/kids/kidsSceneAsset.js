/**
 * Kids 场景资源解析：统一决定当前 lesson 应显示什么 scene image。
 * 当前阶段返回 placeholder；后续可扩展为：查缓存 → 无则生成 → 保存并返回。
 */

import { buildKidsScenePrompt } from "./kidsScenePrompt.js";

/**
 * 生成稳定 cache key：{book}-{lessonId}-{sceneType}
 */
export function getKidsSceneCacheKey(sceneMeta) {
  const book = sceneMeta?.promptSeed?.book || "kids1";
  const lessonId = sceneMeta?.promptSeed?.lessonId || "lesson";
  const type = sceneMeta?.type || "classroom_greeting";
  return `${book}-${lessonId}-${type}`;
}

/**
 * 统一解析当前应显示的 scene 资源。
 * @param {Object} sceneMeta - resolveKidsSceneMeta() 的返回值
 * @param {Object} promptResult - 可选，buildKidsScenePrompt() 的结果；不传则内部调用一次
 * @returns {{ mode: string, imageUrl: string, alt: string, prompt: string, shortPrompt: string, cacheKey: string }}
 */
export function resolveKidsSceneAsset(sceneMeta, promptResult) {
  const built = promptResult || buildKidsScenePrompt(sceneMeta);
  const cacheKey = getKidsSceneCacheKey(sceneMeta);
  const alt = sceneMeta?.title || "Scene";

  return {
    mode: "placeholder",
    imageUrl: "",
    alt,
    prompt: built.prompt,
    shortPrompt: built.shortPrompt,
    stylePreset: built.stylePreset,
    cacheKey,
  };
}

/**
 * 预留：未来自动生图入口。当前不接任何 API。
 * @param {Object} sceneMeta
 * @param {Object} promptResult - buildKidsScenePrompt() 的返回
 * @returns {Promise<{ url?: string, error?: string } | null>}
 */
export async function generateKidsSceneImage(sceneMeta, promptResult) {
  // TODO: future image generation hook — call external API, then cache and return url
  return null;
}
