// /api/gemini.js
import { classifyFreeQuestionIntent, LUMINA_LESSON_QA_PROMPT_REV } from "../ui/modules/ai/freeQuestionIntent.js";

export const config = { runtime: "nodejs", maxDuration: 60 };

/* =========================
   0) Model candidates（失败自动降级）
========================= */
const DEFAULT_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-2.0-flash",
  "gemini-3-flash-preview",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
].filter(Boolean);

const API_VERSION = (process.env.GEMINI_API_VERSION || "v1beta").trim();

/* =========================
   1) Keys（自动轮换）
   读取顺序与 kids-scene-image 等对齐；兼容 Vercel 上常见命名
========================= */
/** 参与「是否有值」统计的变量名（不记录具体值） */
const GEMINI_KEY_ENV_NAMES = [
  "GEMINI_API_KEYS",
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_2",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
];

function splitKeyList(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(/[\s,;|]+/u)
    .map(part => part.trim())
    .filter(Boolean);
}

function getApiKeys() {
  const seen = new Set();
  const out = [];

  const pushKey = k => {
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };

  for (const k of splitKeyList(process.env.GEMINI_API_KEYS)) pushKey(k);

  for (const name of GEMINI_KEY_ENV_NAMES) {
    if (name === "GEMINI_API_KEYS") continue;
    const v = String(process.env[name] || "").trim();
    if (v) pushKey(v);
  }

  return out;
}

/** 安全：仅布尔与计数，便于对照 Vercel 是否注入成功 */
function getGeminiKeyEnvDiagnostics(resolvedKeys) {
  let presentEnvNameCount = 0;
  const envPresence = {};
  for (const n of GEMINI_KEY_ENV_NAMES) {
    const raw = process.env[n];
    const ok = raw !== undefined && String(raw).trim() !== "";
    envPresence[n] = ok;
    if (ok) presentEnvNameCount += 1;
  }
  const keys = resolvedKeys ?? getApiKeys();
  return {
    hasGeminiKey: keys.length > 0,
    keyCount: keys.length,
    presentEnvNameCount,
    envPresence,
  };
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

function summarizeApiKey(keys) {
  const k = keys[0] || "";
  return {
    keyCount: keys.length,
    hasGeminiKey: keys.length > 0,
    keyLength: k.length,
    keyPrefix: k.length >= 4 ? `${k.slice(0, 4)}…` : k.length ? "(short)" : "(none)",
  };
}

function extractText(data) {
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    return { text: "", blockReason };
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) {
    const fr = data?.candidates?.[0]?.finishReason;
    return { text: "", finishReason: fr || undefined, apiError: data?.error };
  }
  const text = parts.map(p => p?.text || "").join("").trim();
  return { text };
}

/** Vercel 部分环境下 req.body 未解析时，从流中读取 JSON */
async function readPostJson(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString("utf8"));
    } catch {
      body = {};
    }
  }
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  }
  if (body && typeof body === "object" && Object.keys(body).length > 0) {
    return body;
  }
  const cl = Number(req.headers["content-length"] || 0);
  if (cl <= 0) return {};
  try {
    if (typeof req.text === "function") {
      const t = await req.text();
      return t ? JSON.parse(t) : {};
    }
  } catch (e) {
    console.warn("[api/gemini] req.text() parse failed:", e?.message || e);
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("[api/gemini] stream body read failed:", e?.message || e);
  }
  return {};
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
    const keys = getApiKeys();
    const diag = getGeminiKeyEnvDiagnostics(keys);
    return res.status(200).json({
      ok: true,
      message: "Gemini endpoint alive. POST { prompt, explainLang, mode?, context? }",
      apiVersion: API_VERSION,
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
      hasGeminiKey: diag.hasGeminiKey,
      keyCount: diag.keyCount,
      presentEnvNameCount: diag.presentEnvNameCount,
      envPresence: diag.envPresence,
      vercelEnv: process.env.VERCEL_ENV || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      luminaLessonQAPromptRev: LUMINA_LESSON_QA_PROMPT_REV,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    const keys = getApiKeys();
    const keyInfo = summarizeApiKey(keys);
    const diag = getGeminiKeyEnvDiagnostics(keys);
    console.info("[api/gemini] POST entered", keyInfo);

    if (!keys.length) {
      console.error(
        "[api/gemini] MISSING_GEMINI_KEY — no usable key after checking:",
        GEMINI_KEY_ENV_NAMES.join(", "),
        "| presentEnvNameCount=",
        diag.presentEnvNameCount,
        "| envPresence=",
        diag.envPresence
      );
      return res.status(500).json({
        error: "Missing GEMINI API key(s) in Environment Variables.",
        code: "MISSING_GEMINI_KEY",
        hasGeminiKey: false,
        keyCount: 0,
        presentEnvNameCount: diag.presentEnvNameCount,
        envPresence: diag.envPresence,
        checkedEnvNames: GEMINI_KEY_ENV_NAMES,
        vercelEnv: process.env.VERCEL_ENV || null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      });
    }

    const body = await readPostJson(req);
    const promptFromBody = String(body.prompt || body.message || "").trim();
    console.info("[api/gemini] body parsed", {
      hasPrompt: !!promptFromBody,
      promptLength: promptFromBody.length,
      mode: body.mode,
      explainLang: body.explainLang,
      hasContext: body.context != null,
      lessonQA: !!(body.context && body.context.lessonQA),
      bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
    });

    if (!promptFromBody) {
      console.warn("[api/gemini] empty prompt after parse — check Content-Type: application/json and Vercel body parsing.");
    }

    // ✅ 新增：mode / context（可选）
    const explainLang = String(body.explainLang || "ko").trim();
    const mode = String(body.mode || "teach").trim(); // teach | ask | quiz
    const context = body.context || null;

    // ✅ 输入保护（避免超长）
    const userPromptRaw = promptFromBody;
    const userPrompt = clampString(userPromptRaw, context?.lessonQA ? 4500 : 2000);
    if (!userPrompt) return res.status(400).json({ error: "Empty prompt." });

    const qaMeta = context?.lessonQA && typeof context.lessonQA === "object" ? context.lessonQA : null;
    const lessonQAIntent =
      qaMeta?.questionIntent &&
      ["difference", "usage", "sentence_explain", "meaning"].includes(String(qaMeta.questionIntent))
        ? String(qaMeta.questionIntent)
        : classifyFreeQuestionIntent(userPrompt);

    const contextMax = context?.lessonQA ? 8000 : 4000;
    const contextText = context ? safeJsonStringify(context, contextMax) : "";

    const langMapName = { ko: "韩语", en: "英语", ja: "日语", zh: "中文" };
    const explainLangName = langMapName[explainLang] || "韩语";

    const lessonQAIntentGuide = (() => {
      switch (lessonQAIntent) {
        case "difference":
          return `
【问题类型：表达对比】（本题为「区别/对比」类）
- 学习者是在比较两种说法或两个词。禁止写成「A 一条释义 + B 一条释义」或两栏词条。
- 先直接说明两者最主要差别（语气、礼貌程度、常用对象/关系），再各用一小句补「通常对谁、在什么关系里用」。
- 最后用引号给出至多 1 个本课范围内的简单对照例子即可（不要把例子拆成「例句1：」字段）。
`.trim();
        case "usage":
          return `
【问题类型：使用场景】
- 不要从生词释义开头。优先回答：常对谁说、在什么场合、礼貌程度大致如何。
- 再联系本课对话或本课学习目标里出现的场景，用一两句话串起来。
- 需要举例时最多 1 句，用引号写中文原句，嵌入叙述中。
`.trim();
        case "sentence_explain":
          return `
【问题类型：句子讲解】
- 先用 ${explainLangName} 把句意说清楚（初学者能懂）；再补一句常用场景或说话目的。
- 若学习者要「更简单」，可给一个更短、更口语的改写，但仍用引号保留中文原句或关键词。
- 至多 1 个补充小例，避免堆砌。
`.trim();
        default:
          return `
【问题类型：词义/一般理解】
- 先正面回答「是什么/怎么说」，再一句场景或搭配提示；不要写成词典词条。
- 仍须保留所涉中文词语的汉字原文。
`.trim();
      }
    })();

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
      if (mode === "ask" && context?.lessonQA) {
        return `
【任务：本课问答 lesson_qa】
- 你是「本课范围内的中文初学者课」任课老师，不是百科或词典数据库。回答要短、清楚、口语化，像课堂上随口解释。
- 必须优先使用下方「可用上下文」JSON 中的本课标题、学习目标、重点表达、词汇、对话行、语法说明；不要编造课内没有的对话原文。
- 说明文字一律用 ${explainLangName}；凡出现教材中的中文词语、固定搭配、对话句，必须保留汉字原文（不要用 ${explainLangName} 翻译顶替原文）。需要时可把拼音轻轻夹在自然句里，但不要单独开「拼音：」一行。
- 篇幅：通常 2～4 个小句为宜；不要长段落、不要讲义体。
- 例句：全篇最多 1 个；优先选自本课对话或本课词语，没有合适再自拟极简句；把例句嵌进叙述，用引号标示中文即可。
- 若问题明显超出本课，先用本课能给出的最接近说明作答，再用一句温和提示「更广的用法以后课会学到」之类，不要拒答、不要展开成语法书。
- 不使用 markdown 符号（如 ** ## --- 等）；不要用「-」做很长列表。

【禁止“词条模板感”（本课问答必须遵守）】
- 严禁出现类似字段名或标签行：中文：、拼音：、韩语：、韩文：、英语：、日语：、解释：、释义：、例句1：、例句2：、注：、翻译：
- 禁止像数据库字段那样「键：值」分行堆叠；禁止「例句1｜例句2」式栏目。
- 读起来要像老师对初学者说话，而不是导出词典卡片。

${lessonQAIntentGuide}
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

${context?.lessonQA ? `【输出结构：本课问答】
- 自然连续的小段话：第一句就触及问题核心；再视需要补 1～2 句说明原因、对象或场景。
- 全文 2～4 个小句为主；至多嵌入 1 个带引号的中文例句（例句里可含必要拼音，但不要单列「拼音：」栏）。
- 不要「1.2.3.4」编号长列表；不要百科、论文或技术文档口吻。
- （内部参考）问题类型判定：${lessonQAIntent}` : `【输出结构】（尽量保持；quiz 模式可用“题目”替代例句）
1. 中文词语 / 句子
2. 拼音（标准、可朗读）
3. ${explainLangName}解释（简洁、适合初学者）
4. 例句 1~2 个（中文 + 拼音 + ${explainLangName}）

【例句格式固定】（非常重要）
例句1：<中文句子> | <拼音> | <${explainLangName}解释>
例句2：<中文句子> | <拼音> | <${explainLangName}解释>`}

【可用上下文】（如果提供了 context）
${contextText ? contextText : "(none)"}
    `.trim();

    const finalPrompt = `${systemPrompt}\n\n【学生问题】\n${userPrompt}`;
    console.info("[api/gemini] model request prepared", {
      mode,
      finalPromptLength: finalPrompt.length,
      contextJsonLength: contextText.length,
      lessonQA: !!(context && context.lessonQA),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let lastError = null;

    for (const apiKey of keys) {
      for (const model of DEFAULT_MODEL_CANDIDATES) {
        const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent`;

        try {
          console.info("[api/gemini] gemini fetch start", { model, apiVersion: API_VERSION });
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
            const errMsg = data?.error?.message || data?.error || rawText?.slice?.(0, 500) || "";
            console.warn("[api/gemini] gemini HTTP error", {
              status: resp.status,
              model,
              message: String(errMsg).slice(0, 400),
            });
            if (isLikelyModelNotFound(data)) {
              lastError = { status: resp.status, triedModel: model, details: data };
              continue;
            }
            lastError = { status: resp.status, triedModel: model, details: data };
            break;
          }

          const extracted = extractText(data);
          const text = extracted.text || "";
          if (extracted.blockReason) {
            console.warn("[api/gemini] prompt blocked", { model, blockReason: extracted.blockReason });
          }
          if (extracted.finishReason && extracted.finishReason !== "STOP") {
            console.warn("[api/gemini] unusual finishReason", { model, finishReason: extracted.finishReason });
          }

          if (text && text.trim()) {
            clearTimeout(timeout);
            console.info("[api/gemini] gemini success", { model, textLength: text.length });
            if (context?.lessonQA) {
              res.setHeader("X-Lumina-LessonQA-Rev", LUMINA_LESSON_QA_PROMPT_REV);
            }
            return res.status(200).json({
              text,
              modelUsed: model,
              apiVersion: API_VERSION,
              explainLang,
              mode,
              fallback: false,
              hasGeminiKey: true,
              keyCount: keys.length,
              ...(context?.lessonQA ? { luminaLessonQAPromptRev: LUMINA_LESSON_QA_PROMPT_REV } : {}),
            });
          }

          console.warn("[api/gemini] empty text from model, try next", { model, hasCandidates: !!data?.candidates?.length });
          lastError = { triedModel: model, emptyText: true, snippet: rawText?.slice?.(0, 200) };

        } catch (e) {
          const msg = e?.name === "AbortError" ? "Request timeout" : (e?.message || String(e));
          console.warn("[api/gemini] gemini fetch exception", { model, error: msg });
          lastError = { error: msg, triedModel: model };
          if (e?.name === "AbortError") break;
        }
      }
    }

    clearTimeout(timeout);

    console.warn("[api/gemini] all models failed or empty, using offline fallback", lastError);
    const offline = offlineFallback(userPrompt, explainLang);
    if (context?.lessonQA) {
      res.setHeader("X-Lumina-LessonQA-Rev", LUMINA_LESSON_QA_PROMPT_REV);
    }
    return res.status(200).json({
      text: offline,
      modelUsed: null,
      apiVersion: API_VERSION,
      explainLang,
      mode,
      fallback: true,
      lastError,
      hasGeminiKey: keys.length > 0,
      keyCount: keys.length,
      ...(context?.lessonQA ? { luminaLessonQAPromptRev: LUMINA_LESSON_QA_PROMPT_REV } : {}),
    });

  } catch (e) {
    return res.status(500).json({
      error: "Server error: " + (e?.message || String(e)),
    });
  }
}
