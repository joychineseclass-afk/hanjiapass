/**
 * Kids 场景图生成 API（MVP）：接收 prompt，调用 OpenAI Images，返回 imageUrl。
 * 需要环境变量 OPENAI_API_KEY。无 key 时返回 503，前端回退 placeholder。
 */

export const config = { runtime: "nodejs" };

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const origin = req.headers?.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY not configured", imageUrl: "" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ error: "Invalid JSON", imageUrl: "" });
  }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "missing prompt", imageUrl: "" });

  try {
    const response = await fetch(OPENAI_IMAGE_URL, {
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data?.error?.message || data?.error || `OpenAI ${response.status}`;
      return res.status(response.status >= 500 ? 502 : 400).json({ error: err, imageUrl: "" });
    }
    const imageUrl = data?.data?.[0]?.url || "";
    const revisedPrompt = data?.data?.[0]?.revised_prompt || prompt;
    if (!imageUrl) return res.status(502).json({ error: "No URL in OpenAI response", imageUrl: "" });
    return res.status(200).json({ imageUrl, revisedPrompt, provider: "openai-image" });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "upstream_error", imageUrl: "" });
  }
}
