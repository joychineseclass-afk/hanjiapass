/**
 * Kids 场景图生成 API：优先 Gemini（与项目现有 key 一致），其次 OpenAI。
 * 明确错误码：NO_IMAGE_PROVIDER_CONFIGURED | GEMINI_IMAGE_GENERATION_NOT_AVAILABLE | OPENAI_API_KEY_NOT_CONFIGURED | IMAGE_GENERATION_FAILED
 */

export const config = { runtime: "nodejs" };

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const API_VERSION = String(process.env.GEMINI_API_VERSION || "v1beta").trim();

/** 当前代码实际检查的环境变量名（按优先级） */
const GEMINI_ENV_NAMES = ["GEMINI_API_KEYS", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GOOGLE_API_KEY"];
const OPENAI_ENV_NAME = "OPENAI_API_KEY";

function envStatus(name) {
  const v = process.env[name];
  return v != null && String(v).trim() !== "" ? "present" : "missing";
}

function getGeminiKeys() {
  const fromList = String(process.env.GEMINI_API_KEYS || "").trim();
  if (fromList) {
    const keys = fromList.split(",").map((s) => s.trim()).filter(Boolean);
    if (keys.length) return keys;
  }
  const geminiKey =
    String(process.env.GEMINI_API_KEY || "").trim() ||
    String(process.env.GOOGLE_API_KEY || "").trim();
  const k2 = String(process.env.GEMINI_API_KEY_2 || "").trim();
  return [geminiKey, k2].filter(Boolean);
}

function getOpenAIKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function logProviderEnvCheck() {
  const lines = ["[KidsSceneImage] env check:"];
  for (const n of GEMINI_ENV_NAMES) lines.push(`  ${n} = ${envStatus(n)}`);
  lines.push(`  ${OPENAI_ENV_NAME} = ${envStatus(OPENAI_ENV_NAME)}`);
  console.log(lines.join("\n"));
}

async function generateWithGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/gemini-2.0-flash-exp:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || "";
    return { ok: false, error: msg, status: res.status };
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return { ok: false, error: "no_candidates" };
  for (const p of parts) {
    if (p?.inlineData?.data) {
      const mime = p.inlineData.mimeType || "image/png";
      const dataUrl = `data:${mime};base64,${p.inlineData.data}`;
      return { ok: true, imageUrl: dataUrl, revisedPrompt: prompt, provider: "gemini" };
    }
  }
  return { ok: false, error: "no_image_in_response" };
}

async function generateWithOpenAI(apiKey, prompt) {
  const res = await fetch(OPENAI_IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      response_format: "url",
      quality: "standard",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error?.message || data?.error || `OpenAI ${res.status}`;
    return { ok: false, error: err };
  }
  const imageUrl = data?.data?.[0]?.url || "";
  const revisedPrompt = data?.data?.[0]?.revised_prompt || prompt;
  if (!imageUrl) return { ok: false, error: "no_url_in_response" };
  return { ok: true, imageUrl, revisedPrompt, provider: "openai-image" };
}

function getRuntimeKind() {
  if (typeof process.env.VERCEL_RUNTIME !== "undefined") return process.env.VERCEL_RUNTIME;
  return typeof globalThis.EdgeRuntime !== "undefined" ? "edge" : "node";
}

export default async function handler(req, res) {
  // 请求时立即打印运行时与 env（不打印 key 内容），便于排查 NO_IMAGE_PROVIDER_CONFIGURED
  const runtimeKind = getRuntimeKind();
  console.log(
    "[KidsSceneImage] runtime env:\n" +
      `OPENAI_API_KEY=${envStatus("OPENAI_API_KEY")}\n` +
      `GEMINI_API_KEY=${envStatus("GEMINI_API_KEY")}\n` +
      `GOOGLE_API_KEY=${envStatus("GOOGLE_API_KEY")}\n` +
      `runtime=${runtimeKind}`
  );

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const origin = req.headers?.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ error: "Invalid JSON", code: "INVALID_JSON", imageUrl: "" });
  }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "missing prompt", code: "MISSING_PROMPT", imageUrl: "" });

  if (process.env.NODE_ENV !== "test") logProviderEnvCheck();

  const geminiKeys = getGeminiKeys();
  const openaiKey = getOpenAIKey();

  // Provider 选择逻辑：有 Gemini key 则优先 Gemini，否则用 OpenAI，两者都没有则 NO_IMAGE_PROVIDER_CONFIGURED
  if (geminiKeys.length === 0 && !openaiKey) {
    if (process.env.NODE_ENV !== "test") console.warn("[KidsSceneImage] no image provider available");
    return res.status(503).json({
      error: "No image provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.",
      code: "NO_IMAGE_PROVIDER_CONFIGURED",
      imageUrl: "",
    });
  }

  if (geminiKeys.length > 0) {
    if (process.env.NODE_ENV !== "test") console.log("[KidsSceneImage] provider=gemini");
    for (const key of geminiKeys) {
      const result = await generateWithGemini(key, prompt);
      if (result.ok) return res.status(200).json({ imageUrl: result.imageUrl, revisedPrompt: result.revisedPrompt, provider: result.provider });
      const msg = (result.error || "").toLowerCase();
      const notSupported = msg.includes("not supported") || msg.includes("invalid") || msg.includes("responseModalities") || result.status === 400 || result.status === 404;
      if (notSupported) {
        if (process.env.NODE_ENV !== "test") console.warn("[KidsSceneImage] Gemini image generation not available", result.error);
        return res.status(503).json({
          error: "Gemini image generation not available with current model or key.",
          code: "GEMINI_IMAGE_GENERATION_NOT_AVAILABLE",
          imageUrl: "",
        });
      }
    }
    if (process.env.NODE_ENV !== "test") console.warn("[KidsSceneImage] Gemini image generation failed after retries");
    return res.status(502).json({
      error: "Gemini image generation failed.",
      code: "IMAGE_GENERATION_FAILED",
      imageUrl: "",
    });
  }

  if (openaiKey) {
    if (process.env.NODE_ENV !== "test") console.log("[KidsSceneImage] provider=openai");
    const result = await generateWithOpenAI(openaiKey, prompt);
    if (result.ok) return res.status(200).json({ imageUrl: result.imageUrl, revisedPrompt: result.revisedPrompt, provider: result.provider });
    if (process.env.NODE_ENV !== "test") console.warn("[KidsSceneImage] OpenAI generation failed", result.error);
    return res.status(502).json({ error: result.error || "OpenAI failed", code: "IMAGE_GENERATION_FAILED", imageUrl: "" });
  }

  return res.status(503).json({
    error: "OPENAI_API_KEY not configured.",
    code: "OPENAI_API_KEY_NOT_CONFIGURED",
    imageUrl: "",
  });
}
