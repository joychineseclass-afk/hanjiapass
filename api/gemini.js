export default async function handler(req, res) {
  // ---------- 1) CORS ----------
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
    // ---------- 2) Read env ----------
    const apiKey = process.env.GEMINI_API_KEY; // ✅ 跟你Vercel里一致
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-001"; // ✅ 建议默认值

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
        text: "",
      });
    }

    // ---------- 3) Read body ----------
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Empty message", text: "" });
    }

    // ---------- 4) Call Gemini ----------
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 512,
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || `Gemini API error (${r.status})`,
        raw: data,
        text: "",
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({
      error: e?.message || "Server error",
      text: "",
    });
  }
}
