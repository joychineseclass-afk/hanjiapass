// api/gemini.js
// ✅ Vercel Serverless Function (Node.js)
// ✅ POST only, returns { text } always
// ✅ CORS for your GitHub Pages + Vercel domains
// ✅ Uses env: GEMINI_KEY (required), GEMINI_MODEL (optional)

export default async function handler(req, res) {
  // 1) CORS (필요한 도메인만 허용)
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://joychineseclass-afk.github.io/hanjapass",
    "https://hanjapass.vercel.app",
  ];

  const origin = req.headers.origin || "";
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
    // 2) Read env
    const apiKey = process.env.GEMINI_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-pro"; // ✅ 안정 기본값

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_KEY in Vercel Environment Variables.",
        text: "",
      });
    }

    // 3) Read body
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    const context = body.context || null;

    if (!message) {
      return res.status(400).json({ error: "Empty message", text: "" });
    }

    // 4) Build prompt (간단/안전/안정)
    const contextText = context
      ? [
          "선택된 항목(단어) 정보:",
          `- 중국어: ${context.cn || ""}`,
          `- 병음: ${context.py || ""}`,
          `- 한국어: ${context.kr || ""}`,
          `- 뜻/번역: ${context.trans || ""}`,
          `- 예문(중문): ${context.sentence_cn || ""}`,
          `- 예문(병음): ${context.sentence_py || ""}`,
        ].join("\n")
      : "";

    const prompt = [
      "당신은 'HSK 한자 선생님' 입니다.",
      "대답은 기본적으로 한국어로 하되, 필요하면 중국어/병음도 함께 제공합니다.",
      "짧고 명확하게, 학습자 친화적으로 설명하세요.",
      contextText ? "\n" + contextText + "\n" : "",
      `사용자 질문: ${message}`,
    ].join("\n");

    // 5) Call Gemini REST API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          topP: 0.9,
          maxOutputTokens: 512,
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // Gemini 에러 원문을 최대한 전달
      return res.status(resp.status).json({
        error: data?.error?.message || `Gemini API error (HTTP ${resp.status})`,
        raw: data,
        text: "",
      });
    }

    // 6) Extract text safely
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text || "")
        .join("")
        .trim() || "";

    return res.status(200).json({ text: text || "답변을 생성하지 못했습니다.", ok: true });
  } catch (e) {
    return res.status(500).json({
      error: String(e?.message || e),
      text: "",
    });
  }
}
