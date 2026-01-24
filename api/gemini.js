export default async function handler(req, res) {
  // ===== CORS =====
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

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // POST only
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST.", text: "" });
  }

  try {
    // ===== ENV =====
    const apiKey = process.env.GEMINI_API_KEY; // ✅ 你Vercel里是 GEMINI_API_KEY
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // ✅ 不要 models/

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
        text: "",
      });
    }

    // ===== BODY =====
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Empty message", text: "" });
    }

    // ===== CALL GEMINI (v1) =====
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

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
        raw: data,
        text: "",
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "";

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e), text: "" });
  }
}
