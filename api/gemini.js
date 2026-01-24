export default async function handler(req, res) {
  // CORS 设置
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    // ✅ 重点：确保这里没有 "models/" 前缀
    const modelName = "gemini-1.5-flash"; 

    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing in Vercel" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();

    if (!message) return res.status(400).json({ error: "Empty message" });

    // ✅ 这里我们使用 v1beta 配合 干净的模型名称
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
        error: data?.error?.message || "Gemini Error",
        details: data
      });
    }

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    return res.status(200).json({ text: aiResponse });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
