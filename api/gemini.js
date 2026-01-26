// /api/gemini.js
export const config = { runtime: "nodejs" };

// ===== 模型候选 =====
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3-flash-preview",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
].filter(Boolean);

const API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";

// ===== 工具 =====
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(p => p.text || "").join("").trim();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
  }

  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : (req.body || {});

  const userPrompt = String(body.prompt || "").trim();
  const explainLang = body.explainLang || "ko";

  const langMap = {
    ko: "韩语",
    en: "英语",
    ja: "日语",
    zh: "中文"
  };

  const explainLangName = langMap[explainLang] || "韩语";

  const systemPrompt = `
你是一位亲切、耐心、适合儿童和初学者的 AI 中文老师。

教学要求：
- 中文必须清楚朗读
- 不读标点符号
- 不使用 markdown
- 语气自然、像真人老师

输出结构：
1. 中文
2. 拼音
3. ${explainLangName}解释
4. 例句（格式固定）：
例句1：中文 | 拼音 | ${explainLangName}
例句2：中文 | 拼音 | ${explainLangName}

所有解释语言只使用：${explainLangName}
`;

  const finalPrompt = `${systemPrompt}\n\n学生问题：${userPrompt}`;

  for (const model of MODEL_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }]
        })
      });

      const raw = await resp.text();
      const data = JSON.parse(raw);

      if (!resp.ok) continue;

      return res.status(200).json({
        text: extractText(data),
        modelUsed: model
      });

    } catch (e) {
      continue;
    }
  }

  res.status(500).json({ error: "All models failed" });
}
