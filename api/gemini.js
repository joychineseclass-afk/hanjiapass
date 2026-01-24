export default async function handler(req, res) {
  // ====== CORS（如果你前端在 github.io，这一步必须要）======
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjapass.vercel.app",
  ];
  const origin = req.headers.origin;
  if (allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 预检请求：浏览器会先发 OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // 只允许 POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel env." });
    }

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt (string)." });
    }

    const model = "gemini-1.5-flash"; // 你也可以用你现在的模型名
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: "Gemini API error",
        status: r.status,
        details: data,
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
