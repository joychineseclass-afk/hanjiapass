// /api/gemini.js
import { classifyFreeQuestionIntent, LUMINA_LESSON_QA_PROMPT_REV } from "../ui/modules/ai/freeQuestionIntent.js";
import { sanitizeLessonQAOutput, firstHanziFromLearnerQuestion } from "../ui/modules/ai/lessonQaSanitize.js";

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

/**
 * @returns {{ text: string, blockReason?: string, finishReason?: string, apiError?: unknown, emptyParts?: boolean, blockSource?: string }}
 */
function extractText(data) {
  const pfBlock = data?.promptFeedback?.blockReason;
  const cand0 = data?.candidates?.[0];
  const finishReason = cand0?.finishReason;
  if (pfBlock) {
    return { text: "", blockReason: String(pfBlock), finishReason, blockSource: "prompt_feedback" };
  }
  const parts = cand0?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) {
    return {
      text: "",
      finishReason: finishReason || undefined,
      emptyParts: true,
      apiError: data?.error,
    };
  }
  const text = parts.map(p => p?.text || "").join("").trim();
  if (!text && (finishReason === "SAFETY" || finishReason === "BLOCKLIST")) {
    return {
      text: "",
      blockReason: String(finishReason),
      finishReason,
      blockSource: "candidate_finish",
    };
  }
  return { text, finishReason };
}

function safeErrMessage(data, rawFallback) {
  const m = data?.error?.message ?? data?.error;
  if (typeof m === "string") return m.slice(0, 800);
  if (m && typeof m === "object") return JSON.stringify(m).slice(0, 800);
  return String(rawFallback || "").slice(0, 500);
}

function googleApiErrorCode(data) {
  const e = data?.error;
  if (!e || typeof e !== "object") return null;
  if (e.code != null) return String(e.code);
  if (e.status != null) return String(e.status);
  return null;
}

/**
 * @param {object} p
 * @returns {{ type: string, message: string, status: number | null, model: string | null, code: string | null, blockReason: string | null }}
 */
function buildLastError(p) {
  return {
    type: p.type,
    message: String(p.message || "").slice(0, 1200),
    status: p.status != null ? Number(p.status) : null,
    model: p.model != null ? String(p.model) : null,
    code: p.code != null ? String(p.code) : null,
    blockReason: p.blockReason != null ? String(p.blockReason) : null,
  };
}

function deploymentMeta() {
  return {
    deploymentEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    vercelUrl: process.env.VERCEL_URL || null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
  };
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
/**
 * @param {string} userPrompt - 可为完整 tutor prompt；本课问答须用学习者提问段取词
 * @param {boolean} isLessonQA - true 时不使用「中文：/拼音：」词典行，避免与学生可见模板混淆
 */
function offlineFallback(userPrompt, explainLang, isLessonQA = false) {
  if (isLessonQA) {
    const hint = firstHanziFromLearnerQuestion(userPrompt);
    const out = {
      ko: `지금 AI 연결이 잠시 불안정해 자세한 설명을 드리기 어려워요. 잠시 후 같은 질문을 다시 보내 주세요. 질문에 나온 표현은 본과 복습과 함께 「${hint}」를 중심으로 천천히 살펴보면 좋아요.`,
      en: `The tutor link is unstable right now, so I can’t give a full answer. Please try again in a moment. You can review the expression 「${hint}」with this lesson’s vocabulary and dialogue.`,
      ja: `いま接続が不安定なため、詳しい説明ができません。しばらくして同じ質問をもう一度送ってください。本課の語句・会話とあわせて「${hint}」を復習してみてください。`,
      zh: `目前连接不稳定，暂时无法详细讲解。请稍后在同一界面重试。可结合本课词语与对话，重点看看「${hint}」。`,
    };
    return out[explainLang] || out.ko;
  }

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
      checkedEnvNames: GEMINI_KEY_ENV_NAMES,
      triedModels: [],
      fallback: false,
      luminaResponseSource: "health_check",
      modelUsed: null,
      rawGeminiTextLength: 0,
      sanitizedEmpty: false,
      blockReason: null,
      lastError: null,
      ...deploymentMeta(),
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
        text: null,
        hasGeminiKey: false,
        keyCount: 0,
        presentEnvNameCount: diag.presentEnvNameCount,
        envPresence: diag.envPresence,
        checkedEnvNames: GEMINI_KEY_ENV_NAMES,
        triedModels: [],
        fallback: true,
        luminaResponseSource: "missing_key",
        modelUsed: null,
        rawGeminiTextLength: 0,
        sanitizedEmpty: false,
        blockReason: null,
        lastError: buildLastError({
          type: "missing_key",
          message: "No GEMINI_API_KEY (or compatible) in server environment.",
          status: 500,
          model: null,
          code: "MISSING_GEMINI_KEY",
          blockReason: null,
        }),
        ...deploymentMeta(),
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
    if (!userPrompt) {
      const d400 = getGeminiKeyEnvDiagnostics(keys);
      return res.status(400).json({
        error: "Empty prompt.",
        fallback: true,
        luminaResponseSource: "bad_request",
        modelUsed: null,
        rawGeminiTextLength: 0,
        sanitizedEmpty: false,
        blockReason: null,
        triedModels: [],
        lastError: buildLastError({
          type: "bad_request",
          message: "prompt / message body empty",
          status: 400,
          model: null,
          code: "EMPTY_PROMPT",
          blockReason: null,
        }),
        hasGeminiKey: keys.length > 0,
        keyCount: keys.length,
        presentEnvNameCount: d400.presentEnvNameCount,
        envPresence: d400.envPresence,
        checkedEnvNames: GEMINI_KEY_ENV_NAMES,
        ...deploymentMeta(),
      });
    }

    const qaMeta = context?.lessonQA && typeof context.lessonQA === "object" ? context.lessonQA : null;
    const lessonQAIntent =
      qaMeta?.questionIntent &&
      ["difference", "usage", "sentence_explain", "meaning"].includes(String(qaMeta.questionIntent))
        ? String(qaMeta.questionIntent)
        : classifyFreeQuestionIntent(userPrompt);

    const contextMax = context?.lessonQA ? 8000 : 4000;
    /** 不把 questionIntent 喂给模型，避免输出 difference / usage 等枚举 */
    const contextForPrompt =
      context && context.lessonQA
        ? {
            ...context,
            lessonQA: { ...context.lessonQA, questionIntent: undefined },
          }
        : context;
    const contextText = contextForPrompt ? safeJsonStringify(contextForPrompt, contextMax) : "";

    const langMapName = { ko: "韩语", en: "英语", ja: "日语", zh: "中文" };
    const explainLangName = langMapName[explainLang] || "韩语";

    /** 不向模型展示「问题类型」等可被复述的标题；仅用短横线说明写法 */
    const lessonQAIntentGuide = (() => {
      switch (lessonQAIntent) {
        case "difference":
          return `
- 学习者在比较两种说法：先一句话说清礼貌程度或常用对象有何不同，再各补一句典型使用关系；至多 1 个带引号的对照小例。
- 禁止写成两条独立「释义」或两栏对比表。
`.trim();
        case "usage":
          return `
- 优先说明：常对谁说、在什么场合、语气礼貌度如何；再联系本课对话或目标里出现的情境，用一两句串起来；至多 1 个带引号的中文例，嵌在叙述里。
`.trim();
        case "sentence_explain":
          return `
- 先用 ${explainLangName} 把句意说清楚；再补一句常用场景或说话目的。若要更简单，可给更短口语改写，引号保留原句关键词；至多 1 个小例。
`.trim();
        default:
          return `
- 先正面回答「是什么、怎么用」，再一句场景或搭配提示；保留所涉词语的汉字原文。
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
【任务：本课问答】
- 你是本课「中文初学者」任课老师。回答短、清楚、口语化，像课堂随口讲解；不要百科腔、讲义体、技术文档体。
- 优先使用下方 JSON 上下文中的本课标题、学习目标、重点表达、词汇、对话行、语法；不要编造课内没有的对话。
- 说明语用 ${explainLangName}；教材里的中文词语、固定搭配、对话句必须保留汉字原文（不要用说明语翻译顶替原文）。需要时把拼音夹在自然句里，禁止单独一行「拼音：」。
- 通常 2～4 个小句；全篇最多 1 个带引号的中文小例，嵌在叙述里。超纲时先给本课最接近的说法，再一句温和提示即可。
- 不使用 markdown；不要长编号列表。

【绝对禁止写入你的回答（不得以任何形式出现，含作小标题、中英混写、仿字段）】
任务类型、问题类型、lesson_qa、difference、usage、sentence_explain、meaning、
中文：、拼音：、韩语解释：、韩文：、英语解释：、日语解释：、한국어해석、例句1：、例句2：、
「中文：xxx」「拼音：xxx」式分行、管道符分列「xxx | xxx | xxx」的词条行。
你的输出只能是连续自然段落，像老师对学生说话；不要展示内部分类、意图名、系统标签、思考步骤。

【禁止“词条模板感”】
- 禁止键值分行堆叠；禁止词典卡片、数据库字段感。
- 下列词若出现在你的输出中即视为严重错误：任务类型、difference、usage、sentence_explain、meaning。

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
- 自然连续小段话：第一句就答在问题核心上；再视需要 1～2 句补原因、对象或场景。
- 全文 2～4 个小句；至多 1 个带引号的中文例，拼音若需要则写在自然句里。
- 不要编号长列表；不要复述本提示中的任何标记或方括号用语。` : `【输出结构】（尽量保持；quiz 模式可用“题目”替代例句）
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

    const triedModels = [];
    let lastAggregateError = null;

    const baseFields = {
      hasGeminiKey: true,
      keyCount: keys.length,
      checkedEnvNames: GEMINI_KEY_ENV_NAMES,
      envPresence: diag.envPresence,
      presentEnvNameCount: diag.presentEnvNameCount,
      ...deploymentMeta(),
      apiVersion: API_VERSION,
      explainLang,
      mode,
    };

    outer: for (const apiKey of keys) {
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
          try {
            data = JSON.parse(rawText);
          } catch {
            data = { error: { message: rawText } };
          }

          if (!resp.ok) {
            const errMsg = safeErrMessage(data, rawText);
            const code = googleApiErrorCode(data);
            triedModels.push({
              model,
              ok: false,
              status: resp.status,
              textLength: 0,
              blockReason: null,
              errorType: "model_http_error",
              message: errMsg.slice(0, 400),
              code,
            });
            lastAggregateError = buildLastError({
              type: "model_http_error",
              message: errMsg,
              status: resp.status,
              model,
              code,
              blockReason: null,
            });
            console.warn("[api/gemini] gemini HTTP error", { status: resp.status, model, code, message: errMsg.slice(0, 200) });
            if (isLikelyModelNotFound(data)) continue;
            continue;
          }

          const extracted = extractText(data);
          const text = extracted.text || "";

          if (extracted.blockReason && !String(text).trim()) {
            triedModels.push({
              model,
              ok: false,
              status: 200,
              textLength: 0,
              blockReason: extracted.blockReason,
              errorType: "model_blocked",
              message: `Input/output blocked (${extracted.blockSource || "unknown"})`,
              code: null,
            });
            lastAggregateError = buildLastError({
              type: "model_blocked",
              message: `Blocked: ${extracted.blockReason}`,
              status: 200,
              model,
              code: null,
              blockReason: extracted.blockReason,
            });
            console.warn("[api/gemini] blocked", { model, blockReason: extracted.blockReason });
            continue;
          }

          if (extracted.finishReason && extracted.finishReason !== "STOP" && extracted.finishReason !== "MAX_TOKENS") {
            console.warn("[api/gemini] unusual finishReason", { model, finishReason: extracted.finishReason });
          }

          if (text && text.trim()) {
            clearTimeout(timeout);
            const rawGeminiTextLength = text.length;
            let outText = context?.lessonQA ? sanitizeLessonQAOutput(text) : text;
            const sanitizedEmpty = !!(context?.lessonQA && !String(outText || "").trim());
            if (sanitizedEmpty) {
              outText = offlineFallback(userPrompt, explainLang, true);
            }
            const luminaResponseSource = sanitizedEmpty ? "sanitize_to_empty" : "gemini";
            const usedFallback = sanitizedEmpty;

            triedModels.push({
              model,
              ok: true,
              status: 200,
              textLength: rawGeminiTextLength,
              blockReason: null,
              errorType: sanitizedEmpty ? "sanitize_to_empty" : "ok",
              message: sanitizedEmpty ? "Model returned text but sanitize removed all visible lines" : "ok",
              code: null,
            });

            console.info("[api/gemini] gemini success", {
              model,
              rawGeminiTextLength,
              luminaResponseSource,
              sanitizedEmpty,
            });

            if (context?.lessonQA) {
              res.setHeader("X-Lumina-LessonQA-Rev", LUMINA_LESSON_QA_PROMPT_REV);
            }

            return res.status(200).json({
              text: outText,
              modelUsed: model,
              fallback: usedFallback,
              luminaResponseSource,
              rawGeminiTextLength,
              sanitizedEmpty,
              blockReason: null,
              lastError: usedFallback
                ? buildLastError({
                    type: "sanitize_to_empty",
                    message: "lesson_qa sanitizer removed all lines; using offline copy",
                    status: 200,
                    model,
                    code: null,
                    blockReason: null,
                  })
                : null,
              triedModels,
              ...baseFields,
              ...(context?.lessonQA ? { luminaLessonQAPromptRev: LUMINA_LESSON_QA_PROMPT_REV } : {}),
            });
          }

          const emptyType = extracted.finishReason === "SAFETY" || extracted.blockReason ? "model_blocked" : "model_empty_text";
          const br = extracted.blockReason || (extracted.finishReason === "SAFETY" ? "SAFETY" : null);
          triedModels.push({
            model,
            ok: false,
            status: 200,
            textLength: 0,
            blockReason: br,
            errorType: emptyType,
            message: extracted.emptyParts ? "No candidates/parts" : "Empty text",
            code: extracted.finishReason || null,
          });
          lastAggregateError = buildLastError({
            type: emptyType,
            message: extracted.emptyParts ? "Empty candidates or parts" : "Model returned empty text",
            status: 200,
            model,
            code: extracted.finishReason ? String(extracted.finishReason) : null,
            blockReason: br,
          });
          console.warn("[api/gemini] empty text from model, try next", { model, finishReason: extracted.finishReason });
        } catch (e) {
          const isAbort = e?.name === "AbortError";
          const msg = isAbort ? "Request timeout (55s)" : (e?.message || String(e));
          triedModels.push({
            model,
            ok: false,
            status: isAbort ? 408 : 0,
            textLength: 0,
            blockReason: null,
            errorType: isAbort ? "request_timeout" : "fetch_exception",
            message: msg.slice(0, 400),
            code: null,
          });
          lastAggregateError = buildLastError({
            type: isAbort ? "request_timeout" : "fetch_exception",
            message: msg,
            status: isAbort ? 408 : null,
            model,
            code: null,
            blockReason: null,
          });
          console.warn("[api/gemini] gemini fetch exception", { model, error: msg });
          if (isAbort) break outer;
        }
      }
    }

    clearTimeout(timeout);

    const offline = offlineFallback(userPrompt, explainLang, !!context?.lessonQA);
    const finalLastError =
      lastAggregateError ||
      buildLastError({
        type: "all_models_failed",
        message: "Every model candidate returned HTTP error, blocked, or empty text.",
        status: null,
        model: triedModels.length ? triedModels[triedModels.length - 1].model : null,
        code: null,
        blockReason: null,
      });

    console.warn("[api/gemini] all models failed or empty, using offline fallback", {
      triedCount: triedModels.length,
      lastType: finalLastError.type,
    });

    if (context?.lessonQA) {
      res.setHeader("X-Lumina-LessonQA-Rev", LUMINA_LESSON_QA_PROMPT_REV);
    }

    return res.status(200).json({
      text: offline,
      modelUsed: null,
      fallback: true,
      luminaResponseSource: "all_models_failed",
      rawGeminiTextLength: 0,
      sanitizedEmpty: false,
      blockReason: finalLastError.blockReason,
      lastError: finalLastError,
      triedModels,
      ...baseFields,
      ...(context?.lessonQA ? { luminaLessonQAPromptRev: LUMINA_LESSON_QA_PROMPT_REV } : {}),
    });

  } catch (e) {
    const msg = e?.message || String(e);
    let k = [];
    let diag = { envPresence: {}, presentEnvNameCount: 0 };
    try {
      k = getApiKeys();
      diag = getGeminiKeyEnvDiagnostics(k);
    } catch (_) {}
    return res.status(500).json({
      error: "Server error: " + msg,
      text: null,
      fallback: true,
      luminaResponseSource: "server_exception",
      modelUsed: null,
      rawGeminiTextLength: 0,
      sanitizedEmpty: false,
      blockReason: null,
      triedModels: [],
      lastError: buildLastError({
        type: "server_exception",
        message: msg.slice(0, 800),
        status: 500,
        model: null,
        code: "SERVER_ERROR",
        blockReason: null,
      }),
      hasGeminiKey: k.length > 0,
      keyCount: k.length,
      presentEnvNameCount: diag.presentEnvNameCount,
      envPresence: diag.envPresence,
      checkedEnvNames: GEMINI_KEY_ENV_NAMES,
      ...deploymentMeta(),
    });
  }
}
