// /api/gemini.js
export const config = { runtime: "nodejs" };

/* =========================
   0) Model candidates（失败自动降级）
========================= */
const DEFAULT_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3-flash-preview",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
].filter(Boolean);

const API_VERSION = (process.env.GEMINI_API_VERSION || "v1beta").trim();

/* =========================
   1) Keys（自动轮换）
========================= */
function getApiKeys() {
  const fromList = String(process.env.GEMINI_API_KEYS || "").trim();
  if (fromList) {
    const keys = fromList.split(",").map(s => s.trim()).filter(Boolean);
    if (keys.length) return keys;
  }
  const k1 = String(process.env.GEMINI_API_KEY || "").trim();
  const k2 = String(process.env.GEMINI_API_KEY_2 || "").trim();
  return [k1, k2].filter(Boolean);
}

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

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(p => p?.text || "").join("").trim();
}

/* =========================
   2) 离线兜底（API挂了也能教）
========================= */
function offlineFallback(userPrompt, explainLang) {
  const langName = { ko: "한국어", en: "English", ja: "日本語", zh: "中文" }[explainLang] || "한국어";
  const term = (userPrompt.match(/[\u4e00-\u9fff]{1,4}/)?.[0]) || "你好";
  const pinyin = term === "你好" ? "nǐ hǎo" : "pīn yīn";

  const explain = {
    ko: `${term}는 처음 만났을 때 쓰는 아주 기본 인사말이에요. 웃으면서 말해 보세요.`,
    en: `"${term}" is a basic greeting in Chinese. Try saying it with a friendly smile.`,
    ja: `「${term}」は中国語の基本のあいさつです。にこやかに言ってみましょう。`,
    zh: `“${term}”是中文里最常用的基本问候语之一，可以微笑着说。`
  }[explainLang] || `${term}는 기본 인사말이에요.`;

  const ex1 = {
    ko: `例句1：你好！ | nǐ hǎo | 안녕하세요!`,
    en: `Example1: 你好！ | nǐ hǎo | Hello!`,
    ja: `例文1：你好！ | nǐ hǎo | こんにちは（中国語のあいさつ）`,
    zh: `例句1：你好！ | nǐ hǎo | 你好！`
  }[explainLang] || `例句1：你好！ | nǐ hǎo | 안녕하세요!`;

  return [
    `中文：${term}`,
    `拼音：${pinyin}`,
    `${langName}解释：${explain}`,
    ex1
  ].join("\n");
}

/* =========================
   3) Utils: input limits
========================= */
function clampString(s, maxLen) {
  const str = String(s || "");
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

function safeJsonStringify(obj, maxLen) {
  try {
    const s = JSON.stringify(obj ?? {});
    return clampString(s, maxLen);
  } catch {
    return "{}";
  }
}

/* =========================
   4) Main handler
========================= */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ✅ allowOrigins 可用环境变量扩展（逗号分隔）
  const envOrigins = String(process.env.ALLOW_ORIGINS || "").trim();
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjiapass.vercel.app",
    ...(
      envOrigins
        ? envOrigins.split(",").map(s => s.trim()).filter(Boolean)
        : []
    )
  ];

  const origin = req.headers.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Gemini endpoint alive. POST { prompt, explainLang, mode?, context? }",
      apiVersion: API_VERSION,
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
      keyCount: getApiKeys().length
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    const keys = getApiKeys();
    if (!keys.length) {
      return res.status(500).json({ error: "Missing GEMINI API key(s) in Environment Variables." });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    // ✅ 新增：mode / context（可选）
    const explainLang = String(body.explainLang || "ko").trim();
    const mode = String(body.mode || "teach").trim(); // teach | ask | quiz
    const context = body.context || null;

    // ✅ 输入保护（避免超长）
    const userPromptRaw = String(body.prompt || body.message || "").trim();
    const userPrompt = clampString(userPromptRaw, 2000);
    if (!userPrompt) return res.status(400).json({ error: "Empty prompt." });

    const contextText = context ? safeJsonStringify(context, 4000) : "";

    const langMapName = { ko: "韩语", en: "英语", ja: "日语", zh: "中文" };
    const explainLangName = langMapName[explainLang] || "韩语";

    // ✅ 根据 mode 微调任务
    const modeGuide = (() => {
      if (mode === "quiz") {
        return `
【任务】
- 针对学生内容出 3 道练习题：1)选择题 2)填空 3)排序/替换
- 每题给出答案（用 ${explainLangName}）
- 仍然保持结构输出（中文/拼音/解释/例句 或 题目）
        `.trim();
      }
      if (mode === "ask") {
        return `
【任务】
- 先回答学生的问题（用自然语言、${explainLangName}）
- 若学生问题与某个词/句子有关，补充：中文/拼音/解释/例句（保持结构）
        `.trim();
      }
      return `
【任务】
- 以老师口吻讲解学生提到的词语/句子
- 解释简洁、适合初学者
      `.trim();
    })();

    const systemPrompt = `
你是一位亲切、耐心、适合教学的“AI 中文老师”。

【教学总原则】
- 解释文字要自然，允许正常使用标点符号，让阅读更舒服
- 不使用 markdown 符号（如 ** ## --- 等）
- 分段清晰，但用自然语言表达
- 所有解释语言必须使用：${explainLangName}
- 不要混用其他语言
- 不要出现“下面是”“总结如下”等 AI 痕迹语

${modeGuide}

【输出结构】（尽量保持；quiz 模式可用“题目”替代例句）
1. 中文词语 / 句子
2. 拼音（标准、可朗读）
3. ${explainLangName}解释（简洁、适合初学者）
4. 例句 1~2 个（中文 + 拼音 + ${explainLangName}）

【例句格式固定】（非常重要）
例句1：<中文句子> | <拼音> | <${explainLangName}解释>
例句2：<中文句子> | <拼音> | <${explainLangName}解释>

【可用上下文】（如果提供了 context）
${contextText ? contextText : "(none)"}
    `.trim();

    const finalPrompt = `${systemPrompt}\n\n【学生问题】\n${userPrompt}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let lastError = null;

    for (const apiKey of keys) {
      for (const model of DEFAULT_MODEL_CANDIDATES) {
        const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent`;

        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: finalPrompt }] }],
            }),
            signal: controller.signal,
          });

          const rawText = await resp.text();
          let data = {};
          try { data = JSON.parse(rawText); }
          catch { data = { error: { message: rawText } }; }

          if (!resp.ok) {
            if (isLikelyModelNotFound(data)) {
              lastError = { status: resp.status, triedModel: model, details: data };
              continue;
            }
            lastError = { status: resp.status, triedModel: model, details: data };
            break;
          }

          clearTimeout(timeout);

          const text = extractText(data);
          return res.status(200).json({
            text: text || "(응답 없음)",
            modelUsed: model,
            apiVersion: API_VERSION,
            explainLang,
            mode,
            fallback: false
          });

        } catch (e) {
          lastError = { error: e?.name === "AbortError" ? "Request timeout" : (e?.message || String(e)), triedModel: model };
          if (e?.name === "AbortError") break;
        }
      }
    }

    clearTimeout(timeout);

    const offline = offlineFallback(userPrompt, explainLang);
    return res.status(200).json({
      text: offline,
      modelUsed: null,
      apiVersion: API_VERSION,
      explainLang,
      mode,
      fallback: true,
      lastError
    });

  } catch (e) {
    return res.status(500).json({
      error: "Server error: " + (e?.message || String(e)),
    });
  }
}
