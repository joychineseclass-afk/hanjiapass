export default async function handler(req, res) {
  // ===== CORS 设置 =====
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
  if (req.method !== "POST") return res.status(405).json({ error: "请使用 POST 方法" });

  try {
    // 1. 获取 API Key (确保你在 Vercel 后台设置了 GEMINI_API_KEY)
    const apiKey = process.env.GEMINI_API_KEY;
    
    // 2. 强制指定一个最稳定的模型名称，避免环境变量里的名称太旧
    const modelName = "gemini-1.5-flash"; 

    if (!apiKey) {
      return res.status(500).json({ error: "缺少 API Key，请在 Vercel 环境变量中设置" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();

    if (!message) return res.status(400).json({ error: "消息不能为空" });

    // 3. 【核心修改】这里改成了 v1beta，解决你之前的 404/Not Found 错误
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
        error: data?.error?.message || "Gemini 接口返回错误",
        details: data
      });
    }

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "AI 没有返回内容";
    
    // 返回给前端
    return res.status(200).json({ text: aiResponse });

  } catch (e) {
    return res.status(500).json({ error: "服务器内部错误: " + e.message });
  }
}
