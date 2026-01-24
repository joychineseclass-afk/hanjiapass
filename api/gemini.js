export default async function handler(req, res) {
  // ===== 0) CORS =====
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

  // ===== 1) Read env =====
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY;

  // ✅ 建议：Vercel 里放 GEMINI_MODEL（可选），不放就用默认
  const model =
    (process.env.GEMINI_MODEL || "gemini-1.5-flash").replace(/^models\//, "");

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
    });
  }

  // ===== 2) Read body =====
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  // ✅ 前端发 message；兼容旧 prompt
  const message = String(body.message || body.prompt || "").trim();
  if (!message) return res.status(400).json({ error: "Empty message." });

  // ===== 3) Build payload =====
  const payload = {
    contents: [{ role: "user", parts: [{ text: message }] }],
  };

  // ===== 4) Call Gemini (try v1 then v1beta) =====
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  ];

  async function callGemini(url) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text(); // ✅ 先读 text，保证永不崩
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    return { ok: r.ok, status: r.status, data, raw: text, url };
  }

  let last = null;
  for (const url of endpoints) {
    last = await callGemini(url);
    if (last.ok) break;
  }

  if (!last || !last.ok) {
    const msg =
      last?.data?.error?.message ||
      last?.data?.error ||
      last?.raw ||
      "Gemini request failed.";

    return res.status(last?.status || 500).json({
      error: msg,
      triedModel: model,
      triedUrls: endpoints,
    });
  }

  const answer =
    last.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    last.data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("\n") ||
    "无回复内容";

  return res.status(200).json({
    text: answer,
    model,
    usedEndpoint: last.url.includes("/v1beta/") ? "v1beta" : "v1",
  });
}
