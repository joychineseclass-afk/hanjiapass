// /api/gemini.js
export const config = { runtime: "nodejs" }; // 强制 Node 运行时，避免 Edge 兼容问题

// ===== 默认老师人设（后端兜底）=====
const DEFAULT_TEACHER_SYSTEM = `
你是“AI 한자 선생님”，面向韩国学生教中文（HSK/HSKK）。

【输出格式必须包含】
1) 中文
2) 拼音
3) 韩语解释（亲切、适合初学者/小学生）
4) 例句 1~2 个（中文+拼音+韩语）
5) 如用户问语法：用简单韩语解释，并给对比例句
`.trim();

// 你可以在 Vercel 环境变量里设置（可选）
// GEMINI_MODEL="gemini-3-flash-preview"
// GEMINI_API_VERSION="v1beta" 或 "v1"
const DEFAULT_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,          // 用户自定义优先
  "gemini-3-flash-preview",          // 你之前跑通的
  "gemini-1.5-flash",                // 常见备用
  "gemini-1.5-pro",                  // 再备用
].filter(Boolean);

const API_VERSION = (process.env.GEMINI_API_VERSION || "v1beta").trim(); // 默认 v1beta 更兼容

function isLikelyModelNotFound(details) {
  const msg = (
    details?.error?.message ||
    details?.error ||
    details?.message ||
    ""
  ).toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("not supported") ||
    msg.includes("model") && msg.includes("not") && msg.includes("supported")
  );
}

// 把 Gemini 的 candidates.parts 拼成纯文本
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(p => p?.text || "").join("").trim();
}

export default async function handler(req, res) {
  // ===== 0) 基础 Header：确保永远返回 JSON（避免 HTML 导致前端 json() 崩）=====
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ===== 1) CORS（同域调用其实不需要，但保留兼容 GitHub Pages）=====
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjiapass.vercel.app",
  ];
  const origin = req.headers.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // ===== 2) GET 健康检查（你页面那张卡会显示 200）=====
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Gemini API endpoint is alive. Use POST with JSON { prompt, system? }",
      apiVersion: API_VERSION,
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    });
  }

  // ===== 3) 只允许 POST =====
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    // ===== 4) Env =====
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
      });
    }

    // ===== 5) Body =====
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const userPrompt = String(body.prompt || body.message || "").trim();
    if (!userPrompt) return res.status(400).json({ error: "Empty prompt." });
// 根据 explainLang 决定解释语言
const langMap = {
  ko: "韩语",
  en: "英语",
  ja: "日语",
  zh: "中文"
};

const explainLang = body.explainLang || "ko";
const explainLangName = langMap[explainLang] || "韩语";

const systemPrompt = `
你是一位亲切、耐心、适合教学的“AI 中文老师”。

【教学总原则】
- 中文（汉字）必须读出来（用于发音学习）
- 不要读标点符号、符号、编号
- 语气自然、温柔、像真人老师
- 不使用 markdown 符号（如 ** ## --- 等）
- 分段清晰，但用自然语言表达

【输出结构】
1. 中文词语 / 句子
2. 拼音（标准、可朗读）
3. ${explainLangName}解释（简洁、适合初学者）
4. 1~2 个例句（中文 + 拼音 + ${explainLangName}）

【重要】
- 所有解释语言必须使用：${explainLangName}
- 不要混用其他语言
- 不要出现“下面是”“总结如下”等 AI 痕迹语
`;

    // ✅ 支持前端传 system；不传就用后端默认
    const systemFromClient = String(body.system || "").trim();
    const systemPrompt = systemFromClient || DEFAULT_TEACHER_SYSTEM;

    // 最终 prompt
    const finalPrompt = `${systemPrompt}\n\n【学生问题】\n${userPrompt}`;

    // ===== 6) 调 Gemini：带超时、模型兜底 =====
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25 秒超时

    let lastError = null;

    for (const model of DEFAULT_MODEL_CANDIDATES) {
      const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent`;

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey, // ✅ 只放 header，绝不拼到 URL
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: finalPrompt }] }],
          }),
          signal: controller.signal,
        });

        // 无论如何先拿到文本，再尝试 JSON（防止返回 HTML）
        const rawText = await resp.text();
        let data = {};
        try { data = JSON.parse(rawText); } catch { data = { error: { message: rawText } }; }

        if (!resp.ok) {
          // 如果是模型不存在/不支持，换下一个模型继续试
          if (isLikelyModelNotFound(data)) {
            lastError = {
              status: resp.status,
              error: data?.error?.message || "Model not available",
              triedModel: model,
              details: data,
            };
            continue;
          }

          // 其他错误：直接返回（例如 key leaked / permission / quota）
          return res.status(resp.status).json({
            error: data?.error?.message || "Gemini API error",
            triedModel: model,
            apiVersion: API_VERSION,
            details: data,
          });
        }

        const text = extractText(data);
        clearTimeout(timeout);

        return res.status(200).json({
          text: text || "(응답 없음)",
          modelUsed: model,
          apiVersion: API_VERSION,
        });
      } catch (e) {
        // fetch/network/timeout 错误：记录后尝试下一个模型
        lastError = {
          error: e?.name === "AbortError" ? "Request timeout" : (e?.message || String(e)),
          triedModel: model,
        };

        // 如果是超时，没必要继续试多个模型（节省资源）
        if (e?.name === "AbortError") break;
      }
    }

    clearTimeout(timeout);

    // 所有模型都失败
    return res.status(500).json({
      error: "All model candidates failed.",
      apiVersion: API_VERSION,
      lastError,
    });
  } catch (e) {
    return res.status(500).json({
      error: "Server error: " + (e?.message || String(e)),
    });
  }
}
