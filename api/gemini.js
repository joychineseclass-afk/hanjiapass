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
    
    // 【修改点 1】直接写死最准确的模型路径，不给它拼接出错的机会
    const modelPath = "gemini-1.5-flash"; 

    if (!apiKey) {
      return res.status(500).json({ error: "Vercel 环境变量中缺少 GEMINI_API_KEY" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();

    if (!message) return res.status(400).json({ error: "消息内容为空" });

    // 【修改点 2】使用 v1 版本，并且确保 URL 格式最简化
    // 注意：这里去掉了 models/ 前缀，直接拼在 v1 后面试试
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelPath}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }],
      }),
    });

    const data = await resp.json();

    // 如果 v1 还是不行，代码会自动尝试 v1beta (双保险)
    if (!resp.ok && data?.error?.message?.includes("not found")) {
      const betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelPath}:generateContent?key=${apiKey}`;
      const respBeta = await fetch(betaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: message }] }],
        }),
      });
      const dataBeta = await respBeta.json();
      
      if (!respBeta.ok) {
        return res.status(respBeta.status).json({ error: dataBeta?.error?.message, details: dataBeta });
      }
      
      const textBeta = dataBeta?.candidates?.[0]?.content?.parts?.[0]?.text || "无回复";
      return res.status(200).json({ text: textBeta });
    }

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message, details: data });
    }

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "无回复内容";
    return res.status(200).json({ text: aiResponse });

  } catch (e) {
    return res.status(500).json({ error: "服务器错误: " + e.message });
  }
}
