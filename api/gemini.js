// /api/gemini.js
export const config = { runtime: "nodejs" }; // 强制 Node 运行时，避免 Edge 兼容问题

/* =========================================================
   0) 默认老师人设（后端兜底：永远保留）
========================================================= */
const DEFAULT_TEACHER_SYSTEM = `
你是“AI 한자 선생님”，面向韩国学生教中文（HSK/HSKK）。

【输出格式必须包含】
1) 中文
2) 拼音
3) 解释（亲切、适合初学者/小学生；语言根据前端 explainLang）
4) 例句 1~2 个（中文+拼音+解释语言）

【例句格式固定】（前端按钮靠这个识别）
例句部分请严格写成下面这样（每条一行）：
例句1：<中文句子> | <拼音> | <解释语言>
例句2：<中文句子> | <拼音> | <解释语言>
（如果只有1条，就只输出 例句1）

5) 如用户问语法：用简单解释语言说明，并给对比例句
`.trim();

/* =========================================================
   1) 模型候选（可用环境变量覆盖）
========================================================= */
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

/* =========================================================
   2) 工具函数
========================================================= */
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
    (msg.includes("model") && msg.includes("not") && msg.includes("supported"))
  );
}

// 把 Gemini 的 candidates.parts 拼成纯文本
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(p => p?.text || "").join("").trim();
}

// 尽可能把 body 解析成对象（兼容：string / object / undefined）
function safeParseBody(req) {
  try {
    if (typeof req.body === "string") {
      return JSON.parse(req.body || "{}");
    }
    if (req.body && typeof req.body === "object") {
      return req.body;
    }
    return {};
  } catch {
    return {};
  }
}

function json(res, status, payload) {
  res.status(status).json(payload);
}

/* =========================================================
   3) Handler
========================================================= */
export default async function handler(req, res) {
  // ===== 0) 永远返回 JSON（避免前端 res.json() 崩）=====
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ===== 1) CORS（同域其实不需要，但保留兼容 GitHub Pages / 多域调用）=====
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjiapass.vercel.app",
  ];
  const origin = req.headers?.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // ===== 2) GET：健康检查 =====
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      message: "Gemini API endpoint is alive. Use POST with JSON { prompt, explainLang }",
      apiVersion: API_VERSION,
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    });
  }

  // ===== 3) 只允许 POST =====
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method Not Allowed. Use POST." });
  }

  try {
    // ===== 4) Env：Key =====
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return json(res, 500, {
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables.",
      });
    }

    // ===== 5) Body =====
    const body = safeParseBody(req);
    const userPrompt = String(body.prompt || body.message || "").trim();
    if (!userPrompt) {
      return json(res, 400, { error: "Empty prompt." });
    }

    // explainLang：前端传 ko/en/ja/zh
    const langMap = { ko: "韩语", en: "英语", ja: "日语", zh: "中文" };
    const explainLang = String(body.explainLang || "ko").trim();
    const explainLangName = langMap[explainLang] || "韩语";

    /* =========================================================
       6) ✅ 最终系统提示词（核心：例句格式固定 + 解释语言固定）
       - 这里把 DEFAULT_TEACHER_SYSTEM 的精神并入（不丢）
       - 同时更严格定义“不要混语言、不要 markdown、例句一行一条”
    ========================================================= */
    const systemPrompt = `
你是一位亲切、耐心、适合教学的“AI 中文老师”（面向韩国学生为主）。

【教学总原则】
- 中文（汉字）必须清晰输出（用于发音学习）
- 语气自然、温柔、像真人老师
- 不要读标点符号、符号、编号（尽量避免在输出中出现无意义符号）
- 不使用 markdown 符号（如 ** ## --- 等）
- 分段清晰，但用自然语言表达

【输出结构必须包含】（顺序也尽量保持）
1. 中文词语 / 句子
2. 拼音（标准、可朗读）
3. ${explainLangName}解释（简洁、适合初学者/小学生）
4. 例句 1~2 个（中文 + 拼音 + ${explainLangName}）

【例句格式固定】（非常重要，前端按钮靠这个识别）
- 例句必须严格写成下面这样（每条“一行一条”）：
例句1：<中文句子> | <拼音> | <${explainLangName}解释>
例句2：<中文句子> | <拼音> | <${explainLangName}解释>
（如果只有1条，就只输出 例句1）
- 注意：不要把“例句1”拆成多行；不要在例句里再加项目符号

【语法问题】
- 如果学生问语法：用简单的 ${explainLangName} 解释，并给对比例句（仍然按例句格式输出）

【语言强约束】
- 所有解释语言必须使用：${explainLangName}
- 不要混用其他语言（除非中文本身/拼音）
- 不要出现“下面是”“总结如下”等 AI 痕迹语
`.trim();

    // ✅ 把默认兜底人设也并入（确保“最长完整版”不丢任何核心精神）
    const finalSystem = `${DEFAULT_TEACHER_SYSTEM}\n\n${systemPrompt}`.trim();

    // 最终 prompt
    const finalPrompt = `${finalSystem}\n\n【学生问题】\n${userPrompt}`;

    /* =========================================================
       7) 调 Gemini：超时 + 多模型兜底
    ========================================================= */
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

        // 先拿纯文本，再解析 JSON（防止返回 HTML）
        const rawText = await resp.text();
        let data = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { error: { message: rawText } };
        }

        if (!resp.ok) {
          // 模型不可用 → 换下一个模型
          if (isLikelyModelNotFound(data)) {
            lastError = {
              status: resp.status,
              error: data?.error?.message || "Model not available",
              triedModel: model,
              apiVersion: API_VERSION,
              details: data,
            };
            continue;
          }

          // 其他错误：直接返回（权限/配额/key/账单）
          clearTimeout(timeout);
          return json(res, resp.status, {
            error: data?.error?.message || "Gemini API error",
            triedModel: model,
            apiVersion: API_VERSION,
            details: data,
          });
        }

        const text = extractText(data);
        clearTimeout(timeout);

        return json(res, 200, {
          text: text || "(응답 없음)",
          modelUsed: model,
          apiVersion: API_VERSION,
          explainLang,
        });
      } catch (e) {
        lastError = {
          error: e?.name === "AbortError" ? "Request timeout" : (e?.message || String(e)),
          triedModel: model,
          apiVersion: API_VERSION,
        };
        // 超时就不再继续试其它模型（节省资源）
        if (e?.name === "AbortError") break;
      }
    }

    clearTimeout(timeout);

    // 所有模型都失败
    return json(res, 500, {
      error: "All model candidates failed.",
      apiVersion: API_VERSION,
      lastError,
    });

  } catch (e) {
    return json(res, 500, {
      error: "Server error: " + (e?.message || String(e)),
    });
  }
}
