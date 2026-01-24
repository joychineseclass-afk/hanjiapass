export default async function handler(req, res) {
  // ===== 1) CORS（允许 GitHub Pages + Vercel 域名）=====
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjiapass.vercel.app",
  ];

  const origin = req.headers.origin || "";
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

  // ===== 2) 读取参数 =====
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel environment variables." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || body.message || "").trim();
if (!prompt) return res.status(400).json({ error: "Empty prompt." });

const systemPrompt = `
你是“AI 한자 선생님”，面向韩国学生教中文（HSK/HSKK）。

【回答规则】
1. 默认用韩语说明
2. 必须包含：
   - 中文词语/句子
   - 拼音
   - 简单韩语解释
3. 给 1~2 个例句（中文 + 拼音 + 韩语）
4. 语气亲切，适合小学生或初学者
`;

const finalPrompt = systemPrompt + "\n\n【学生问题】\n" + prompt;
    if (!prompt) return res.status(400).json({ error: "Empty prompt." });

    // ===== 3) ✅ 使用官方文档的 v1beta + x-goog-api-key 方式 =====
    // 选一个“确定存在”的模型：gemini-3-flash-preview
    const model = "gemini-3-flash-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // ✅ 关键点：不要用 ?key=
      },
      body: JSON.stringify({
  contents: [
    {
      parts: [{ text: finalPrompt }]
    }
  ]
});

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // 把 Google 返回的错误原样带回前端，方便定位
      return res.status(resp.status).json({
        error: data?.error?.message || "Gemini API error",
        details: data,
        usedModel: model,
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text: text || "(no text)" , usedModel: model });

  } catch (e) {
    return res.status(500).json({ error: "Server error: " + (e?.message || String(e)) });
  }
}
