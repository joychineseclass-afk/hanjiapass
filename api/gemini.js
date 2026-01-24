// api/gemini.js
// ✅ Vercel Serverless Function (Node) — 最稳最终版
// 需要在 Vercel Environment Variables 设置：
// GEMINI_API_KEY=xxxxx
// （可选）GEMINI_MODEL=models/gemini-1.5-flash

export default async function handler(req, res) {
  // ===== 1) CORS（如果你前端在 GitHub Pages / Vercel 都能用）=====
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjapass.vercel.app",
    // 也可以加你自己的自定义域名
  ];

  const origin = req.headers.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 预检请求
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // 只允许 POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST.", text: "" });
  }

  // ===== 2) 读取环境变量 =====
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY; // 兼容你之前写法
  const model = process.env.GEMINI_MODEL || "models/gemini-1.5-flash"; // ✅ 最稳默认

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
      text: "",
    });
  }

  // ===== 3) 读取 body（兼容各种情况）=====
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const message = String(body?.message || "").trim();
  const context = body?.context || null;

  if (!message) {
    return res.status(400).json({ error: "Empty message", text: "" });
  }

  // ===== 4) 组装 prompt（你可以按你应用风格再微调）=====
  const systemHint = `
너는 "AI 한자 선생님"이야.
사용자는 한국인 중국어 학습자야.
- 답변은 기본적으로 한국어로 설명하되, 필요한 중국어(한자/간체/병음)도 같이 보여줘.
- 예문 2~3개 제공해줘.
- 발음(병음)과 뜻(한국어) 정리해줘.
- 너무 길면 핵심만.
`.trim();

  const userText = context
    ? `${systemHint}\n\n[컨텍스트]\n${JSON.stringify(context)}\n\n[질문]\n${message}`
    : `${systemHint}\n\n[질문]\n${message}`;

  // ===== 5) Gemini generateContent 호출 (v1beta) =====
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: userText }],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 800,
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    // 如果 API 返回错误
    if (!resp.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        JSON.stringify(data).slice(0, 500) ||
        "Gemini API error";
      return res.status(resp.status).json({ error: msg, text: "" });
    }

    // 取出文本
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text || "")
        .join("")
        .trim() || "";

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Server error",
      text: "",
    });
  }
}
