// /api/gemini.js
export const config = { runtime: "nodejs" }; // 强制 Node 运行时，避免 Edge 兼容问题

export default async function handler(req, res) {
  // ===== 1) CORS =====
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

  try {
    // ===== 2) Env =====
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
      });
    }

    // ===== 3) Body =====
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const userPrompt = String(body.prompt || body.message || "").trim();
    if (!userPrompt) return res.status(400).json({ error: "Empty prompt." });

    // ===== 4) System Prompt（你要加的“老师规则”就放这里）=====
    const systemPrompt = `
你是“AI 한자 선생님”，面向韩国学生教中文（HSK/HSKK）。

【输出格式必须包含】
1) 中文
2) 拼音
3) 韩语解释（亲切、适合初学者/小学生）
4) 例句 1~2 个（中文+拼音+韩语）
5) 如用户问语法：用简单韩语解释，并给对比例句
`.trim();

    const finalPrompt = `${systemPrompt}\n\n【学生问题】\n${userPrompt}`;

    // ===== 5) 调 Gemini（你之前成功过：v1beta + x-goog-api-key + gemini-3-flash-preview）=====
    // 如果以后模型变了，只改这里 model 字符串就行
    const model = "gemini-3-flash-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // ✅ 不用 ?key=
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // 这里把 Google 返回的错误完整带回去，方便你一眼看到原因
      return res.status(resp.status).json({
        error: data?.error?.message || "Gemini API error",
        details: data,
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    return res.status(200).json({ text: text || "(응답 없음)" });
  } catch (e) {
    // 关键：把异常信息返回（否则只看到 FUNCTION_INVOCATION_FAILED）
    return res.status(500).json({
      error: "Server error: " + (e?.message || String(e)),
    });
  }
}
