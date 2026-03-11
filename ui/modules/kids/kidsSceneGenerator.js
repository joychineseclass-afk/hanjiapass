/**
 * Kids 场景图生成 MVP：调用后端生图接口，返回 imageUrl。
 * 业务逻辑与 prompt 仅使用 buildKidsScenePrompt() 的结果，不在此处拼装。
 */

function getApiUrl() {
  if (typeof window !== "undefined" && window.__KIDS_SCENE_IMAGE_API__) {
    return String(window.__KIDS_SCENE_IMAGE_API__).trim();
  }
  const base = typeof window !== "undefined" && window.__APP_BASE__ ? String(window.__APP_BASE__).replace(/\/+$/, "") : "";
  return base ? `${base}/api/kids-scene-image` : "/api/kids-scene-image";
}

/**
 * 调用真实图片生成接口（MVP：按需生成，失败回退 placeholder）。
 * @param {Object} sceneMeta - resolveKidsSceneMeta() 的返回值
 * @param {Object} promptResult - buildKidsScenePrompt() 的返回 { prompt, shortPrompt, stylePreset }
 * @returns {Promise<{ ok: boolean, imageUrl?: string, revisedPrompt?: string, provider?: string, error?: string }>}
 */
export async function generateKidsSceneImage(sceneMeta, promptResult) {
  const prompt = promptResult?.prompt || "";
  if (!prompt.trim()) {
    return { ok: false, error: "missing_prompt" };
  }

  const url = getApiUrl();
  const cacheKey = sceneMeta?.promptSeed ? `${sceneMeta.promptSeed.book}-${sceneMeta.promptSeed.lessonId}-${sceneMeta.type}` : "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        shortPrompt: promptResult?.shortPrompt || "",
        stylePreset: promptResult?.stylePreset || "lumina-kids-picturebook-v1",
        cacheKey,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error || `HTTP ${res.status}`;
      const code = data?.code || "";
      if (typeof console !== "undefined") console.warn("[KidsSceneImage] generation failed", code || err);
      return { ok: false, error: err, code };
    }
    const imageUrl = data?.imageUrl || data?.url || "";
    if (!imageUrl) {
      if (typeof console !== "undefined") console.warn("[KidsSceneImage] no imageUrl in response", data);
      return { ok: false, error: "no_image_url" };
    }
    if (typeof console !== "undefined" && data?.provider) console.log("[KidsSceneImage] provider=" + data.provider);
    return {
      ok: true,
      imageUrl,
      revisedPrompt: data?.revisedPrompt || prompt,
      provider: data?.provider || "openai-image",
    };
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[KidsSceneImage] generation failed", e?.message || e);
    return { ok: false, error: e?.message || "network_error" };
  }
}
