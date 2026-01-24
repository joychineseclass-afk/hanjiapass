export default async function handler(req, res) {
  // 1) CORS
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjiapass.vercel.app",
  ];
  const origin = req.headers.origin;
  if (allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    // 2) Env
    const apiKey = process.env.GEMINI_API_KEY; // 你 Vercel 里就是这个
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
      });
    }

    // 3) Body
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Empty message." });
    }

    // ✅ 4) 用“统一入口”的 Gemini API（更稳）
    // 模型：gemini-1.5-flash 是最常用的稳定选择
    const model = "gemini-1.5-flash";

    // 注意：这里不是 generativelanguage.googleapis.com，而是新的统一入口
    const url =
      `https://api.google.dev/gemini/v1/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.error?.message || "Gemini API error",
        details: data,
        usingUrl: url.replace(apiKey, "****"), // 防止 key 被回显
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response text.";

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
