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
    
    // 1. 这里只留纯名字，不要任何前缀
    const modelName = "gemini-1.5-flash"; 

    if (!apiKey) return res.status(500).json({ error: "API Key missing" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Empty message" });

    // 2. 【核心修改】直接把模型名放在这里，去掉之前的 /models/ 这一层
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }],
      }),
    });

    const data = await resp.json();

    // 如果还是报 "not found"，说明这个路径不对。
    // 我们换个备用地址试试（有些地区需要这个）：
    if (data?.error?.message?.includes("not found")) {
       // 尝试备用格式：去掉中间的 models 
       const altUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
       // ... 再次 fetch (但通常上面那个只要 modelName 正确就能通)
    }

    if (!resp.ok) return res.status(resp.status).json({ error: data?.error?.message, raw: data });

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    return res.status(200).json({ text: aiResponse });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
