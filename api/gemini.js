export default async function handler(req, res) {
  // ---- CORS（同域不一定需要，但加了更稳）----
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
        text: ""
      });
    }

    // 允许你在环境变量里写 GEMINI_MODEL
    // 但必须是 "gemini-1.5-flash" 这种，不要带 "models/"
    let model = (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
    model = model.replace(/^models\//, ""); // ✅ 自动修正：去掉 models/

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    const context = body.context ? String(body.context) : "";

    if (!message) {
      return res.status(400).json({ error: "Empty message", text: "" });
    }

    // 组装提示词（你也可以改成更教学的风格）
    const prompt = context
      ? `${context}\n\n사용자 질문: ${message}`
      : message;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 512
      }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    // Google 错误直接透出，方便你定位
    if (!r.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return res.status(r.status).json({ error: msg, text: "" });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "";

    return res.status(200).json({ text: text || "(빈 응답)" });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e), text: "" });
  }
}
