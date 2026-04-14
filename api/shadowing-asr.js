/**
 * Lumina 跟读：服务端 ASR（MVP）
 * POST multipart/form-data 或 JSON（audioBase64）
 *
 * 模型选择：**独立**于 /api/gemini.js（不使用 GEMINI_MODEL 聊天默认，避免误继承旧模型名）。
 * 仅使用：GEMINI_ASR_MODEL（可选覆盖） + 本文件内 ASR 专用 fallback 列表。
 *
 * Provider：Google Gemini 多模态（音频→文本）。
 */

import formidable from "formidable";
import { readFile, unlink } from "fs/promises";

export const config = { runtime: "nodejs", maxDuration: 60 };

const API_VERSION = String(process.env.GEMINI_API_VERSION || "v1beta").trim();
const GENERATE_METHOD = "generateContent";

/** 明确禁用：曾报 model not found / not supported 的模型，不再作为默认或 fallback */
const DISALLOWED_ASR_MODELS = new Set(["gemini-1.5-flash-8b"]);

/**
 * ASR 专用默认顺序（较新 flash 优先 → 1.5 稳定 → pro 保底）。
 * 与 /api/gemini.js 的 DEFAULT_MODEL_CANDIDATES 无导入关系，避免聊天旧名污染。
 */
const DEFAULT_ASR_MODELS_ORDER = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

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
    .map((part) => part.trim())
    .filter(Boolean);
}

function getApiKeys() {
  const seen = new Set();
  const out = [];
  const pushKey = (k) => {
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

/**
 * 构建 ASR 模型列表（去重、记录来源）。不使用 process.env.GEMINI_MODEL。
 */
function buildAsrModelCandidates() {
  const seen = new Set();
  /** @type {{ name: string, source: string }[]} */
  const out = [];

  const push = (rawName, sourceLabel) => {
    const name = String(rawName || "").trim();
    if (!name) return;
    if (DISALLOWED_ASR_MODELS.has(name)) {
      console.warn(
        `[shadowing-asr] skip disallowed model id: ${name} (${sourceLabel}) — remove from GEMINI_ASR_MODEL on server if set`,
      );
      return;
    }
    if (seen.has(name)) return;
    seen.add(name);
    out.push({ name, source: sourceLabel });
  };

  const envAsr = process.env.GEMINI_ASR_MODEL;
  if (envAsr && String(envAsr).trim()) {
    console.info(`[shadowing-asr] env GEMINI_ASR_MODEL raw: "${String(envAsr).trim()}" → will try first (override)`);
    push(String(envAsr).trim(), "env:GEMINI_ASR_MODEL");
  } else {
    console.info("[shadowing-asr] env GEMINI_ASR_MODEL: (unset) — first candidates from code:default_asr_list only until overridden");
  }

  console.info("[shadowing-asr] note: GEMINI_MODEL (chat) is NOT read — ASR uses only GEMINI_ASR_MODEL + ASR defaults");

  for (const m of DEFAULT_ASR_MODELS_ORDER) {
    push(m, "code:default_asr_list");
  }

  const summary = out.map((x) => `${x.name}[${x.source}]`).join(", ");
  console.info("[shadowing-asr] fallback models (ordered, deduped):", summary || "(empty)");
  return out;
}

function jsonResponse(res, status, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(obj);
}

function setCors(req, res) {
  const envOrigins = String(process.env.ALLOW_ORIGINS || "").trim();
  const allowOrigins = [
    "https://joychineseclass-afk.github.io",
    "https://hanjiapass.vercel.app",
    ...(envOrigins ? envOrigins.split(",").map((s) => s.trim()).filter(Boolean) : []),
  ];
  const origin = req.headers.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeTranscript(s) {
  let x = String(s || "").trim();
  x = x.replace(/^[\s"'「『]+|[\s"'」』]+$/g, "").trim();
  x = x.replace(/\u3000/g, " ");
  return x.trim();
}

function hasChineseChars(s) {
  return /[\u4e00-\u9fff]/.test(String(s || ""));
}

function extractGeminiText(data) {
  const cand0 = data?.candidates?.[0];
  const parts = cand0?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p?.text || "").join("").trim();
}

function apiErrorMessage(data, rawText) {
  return String(data?.error?.message || data?.error || rawText || "").trim();
}

function isLikelyModelNotFoundOrUnsupported(msg) {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("not supported") ||
    (m.includes("model") && m.includes("not") && m.includes("supported")) ||
    (m.includes("generatecontent") && (m.includes("not supported") || m.includes("invalid")))
  );
}

/** 应尝试下一模型：模型名无效、不支持多模态等 */
function isRecoverableModelError(httpStatus, message) {
  if (httpStatus === 404) return true;
  if (httpStatus === 400 && isLikelyModelNotFoundOrUnsupported(message)) return true;
  if (httpStatus >= 500) return true;
  return false;
}

/** 不应再换模型：鉴权、配额、key */
function isAuthQuotaOrPermissionError(httpStatus, message) {
  const m = String(message || "").toLowerCase();
  if (httpStatus === 401 || httpStatus === 403) return true;
  if (httpStatus === 429) return true;
  if (m.includes("api key") || m.includes("permission denied") || m.includes("quota")) return true;
  return false;
}

async function readJsonBody(req) {
  if (typeof req.text === "function") {
    const t = await req.text();
    try {
      return t ? JSON.parse(t) : {};
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} targetText
 * @param {string} apiKey
 * @param {{ name: string, source: string }[]} candidates
 */
async function transcribeWithGemini(buffer, mimeType, targetText, apiKey, candidates) {
  const base64 = buffer.toString("base64");
  const safeTarget = String(targetText || "").slice(0, 200);
  const prompt = `你是中文语音转写助手。请只听音频，把说话人说的中文转写为简体汉字。
要求：
1) 只输出转写正文，不要翻译、不要解释、不要引号或项目符号。
2) 若听不清或没有中文语音，只输出空字符串。
3) 下列「目标句」仅供对齐参考，转写以音频为准：${safeTarget}`;

  const triedModels = [];
  let lastErrorSnippet = "";
  let lastHttpStatus = 0;
  let lastModelTried = "";

  console.info("[shadowing-asr] api version:", API_VERSION, "| method:", GENERATE_METHOD, "| candidates:", candidates.length);

  for (const { name: model, source } of candidates) {
    lastModelTried = model;
    triedModels.push(model);
    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:${GENERATE_METHOD}`;

    console.info(`[shadowing-asr] selected model: ${model} | source: ${source}`);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType || "audio/webm",
                    data: base64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      });

      const rawText = await resp.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { error: { message: rawText.slice(0, 400) } };
      }

      const errMsg = apiErrorMessage(data, rawText);
      lastHttpStatus = resp.status;
      lastErrorSnippet = errMsg.slice(0, 400);

      if (!resp.ok) {
        console.warn("[shadowing-asr] model request failed", {
          model,
          httpStatus: resp.status,
          messagePreview: errMsg.slice(0, 180),
        });

        if (isAuthQuotaOrPermissionError(resp.status, errMsg)) {
          console.error("[shadowing-asr] fatal: auth/quota/permission — not trying more models");
          return {
            ok: false,
            fatalReason: "provider_error",
            httpStatus: resp.status,
            debugMessage: errMsg,
            triedModels,
            lastTriedModel: model,
          };
        }

        if (isRecoverableModelError(resp.status, errMsg)) {
          console.info("[shadowing-asr] recoverable error — trying next model in fallback list");
          continue;
        }

        console.info("[shadowing-asr] non-classified HTTP error — trying next model");
        continue;
      }

      const text = extractGeminiText(data);
      console.info("[shadowing-asr] hit model (success):", model, "| transcriptLen:", text.length);
      return {
        ok: true,
        transcript: text,
        model,
        modelSource: source,
      };
    } catch (e) {
      const em = e?.message || String(e);
      lastErrorSnippet = em.slice(0, 400);
      console.warn("[shadowing-asr] fetch exception", { model, error: em.slice(0, 200) });
      continue;
    }
  }

  console.error("[shadowing-asr] all ASR model candidates failed", {
    triedModels,
    lastHttpStatus,
    lastModelTried,
  });

  return {
    ok: false,
    fatalReason: "no_working_asr_model",
    debugMessage: lastErrorSnippet || "all_models_failed",
    triedModels,
    lastTriedModel: lastModelTried,
  };
}

function baseFailure(reason, extra = {}) {
  return {
    success: false,
    transcript: "",
    normalizedTranscript: "",
    confidence: null,
    provider: extra.provider ?? "gemini",
    reason,
    message: extra.message ?? null,
    debugMessage: extra.debugMessage ?? null,
    triedModels: extra.triedModels ?? null,
    lastTriedModel: extra.lastTriedModel ?? null,
    httpStatus: extra.httpStatus ?? null,
    ...extra,
  };
}

function baseSuccess(transcript, normalized, provider, modelUsed) {
  return {
    success: true,
    transcript,
    normalizedTranscript: normalized,
    confidence: null,
    provider,
    model: modelUsed,
    reason: null,
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const asrCandidates = buildAsrModelCandidates();

  if (req.method === "GET") {
    const keys = getApiKeys();
    return jsonResponse(res, 200, {
      ok: true,
      message: "Lumina shadowing ASR. POST multipart (audio, targetText, lang, mode) or JSON with audioBase64.",
      hasProviderKey: keys.length > 0,
      keyCount: keys.length,
      apiVersion: API_VERSION,
      method: GENERATE_METHOD,
      asrModelsResolved: asrCandidates.map((c) => ({ model: c.name, source: c.source })),
      geminiAsrModelEnv: process.env.GEMINI_ASR_MODEL ? String(process.env.GEMINI_ASR_MODEL).trim() : null,
      note: "GEMINI_MODEL (chat) is not used for this route",
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(res, 405, baseFailure("method_not_allowed", { provider: "none" }));
  }

  const keys = getApiKeys();
  if (!keys.length) {
    console.error("[shadowing-asr] no GEMINI keys configured");
    return jsonResponse(res, 200, baseFailure("service_not_configured", { provider: "none" }));
  }

  if (!asrCandidates.length) {
    console.error("[shadowing-asr] no ASR model candidates after build (misconfiguration)");
    return jsonResponse(
      res,
      200,
      baseFailure("model_not_available", {
        message: "ASR model is not available",
        debugMessage: "empty candidate list",
      }),
    );
  }

  const apiKey = keys[0];
  let buffer = null;
  let mimeType = "audio/webm";
  let targetText = "";
  let lessonId = "";
  let itemId = "";
  let mode = "shadowing";

  const ct = String(req.headers["content-type"] || "");

  try {
    if (ct.includes("application/json")) {
      const body = await readJsonBody(req);
      const b64 = String(body.audioBase64 || "").trim();
      targetText = String(body.targetText || "").trim();
      lessonId = String(body.lessonId || "").trim();
      itemId = String(body.itemId || "").trim();
      mode = String(body.mode || "shadowing").trim();
      mimeType = String(body.mimeType || "audio/webm").trim() || "audio/webm";
      console.info("[shadowing-asr] JSON body", {
        hasAudio: !!b64,
        approxBytes: b64 ? Math.floor((b64.length * 3) / 4) : 0,
        targetLen: targetText.length,
        mode,
      });
      if (!b64) {
        return jsonResponse(res, 400, baseFailure("missing_audio", { provider: "gemini" }));
      }
      buffer = Buffer.from(b64, "base64");
    } else {
      const form = formidable({
        maxFileSize: 12 * 1024 * 1024,
        allowEmptyFiles: false,
      });
      const [fields, files] = await form.parse(req);
      const audioList = files.audio;
      const f = Array.isArray(audioList) ? audioList[0] : audioList;
      targetText = String(fields.targetText?.[0] ?? fields.targetText ?? "").trim();
      lessonId = String(fields.lessonId?.[0] ?? "").trim();
      itemId = String(fields.itemId?.[0] ?? "").trim();
      mode = String(fields.mode?.[0] ?? "shadowing").trim();
      const lang = String(fields.lang?.[0] ?? "zh-CN").trim();
      console.info("[shadowing-asr] multipart received", {
        hasFile: !!f,
        fileSize: f?.size,
        mime: f?.mimetype,
        targetLen: targetText.length,
        lessonId: lessonId ? "[set]" : "",
        itemId: itemId ? "[set]" : "",
        mode,
        lang,
      });
      if (!f || !f.filepath) {
        return jsonResponse(res, 400, baseFailure("missing_audio", { provider: "gemini" }));
      }
      mimeType = f.mimetype || f.mimeType || mimeType;
      try {
        buffer = await readFile(f.filepath);
      } finally {
        await unlink(f.filepath).catch(() => {});
      }
    }

    if (!buffer || buffer.length < 200) {
      console.warn("[shadowing-asr] audio too small", buffer?.length ?? 0);
      return jsonResponse(res, 200, baseFailure("audio_too_small", { provider: "gemini" }));
    }

    console.info("[shadowing-asr] audio bytes", buffer.length, "mime", mimeType);

    const out = await transcribeWithGemini(buffer, mimeType, targetText, apiKey, asrCandidates);

    if (!out.ok) {
      if (out.fatalReason === "provider_error") {
        return jsonResponse(
          res,
          200,
          baseFailure("provider_error", {
            debugMessage: out.debugMessage,
            triedModels: out.triedModels,
            lastTriedModel: out.lastTriedModel,
            httpStatus: out.httpStatus,
            message: "Provider rejected the request (auth/quota/permission)",
          }),
        );
      }
      return jsonResponse(
        res,
        200,
        baseFailure("no_working_asr_model", {
          debugMessage: out.debugMessage,
          triedModels: out.triedModels,
          lastTriedModel: out.lastTriedModel,
          message: "No ASR model in the fallback list succeeded",
        }),
      );
    }

    const raw = String(out.transcript || "").trim();
    const normalized = normalizeTranscript(raw);
    if (!normalized || !hasChineseChars(normalized)) {
      console.info("[shadowing-asr] empty or non-Chinese transcript after normalize");
      return jsonResponse(
        res,
        200,
        Object.assign(baseFailure("empty_transcript", { provider: "gemini", model: out.model }), {
          transcript: raw,
          normalizedTranscript: normalized,
        }),
      );
    }

    return jsonResponse(res, 200, baseSuccess(raw, normalized, "gemini", out.model));
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("[shadowing-asr] handler exception", msg.slice(0, 400));
    return jsonResponse(
      res,
      500,
      baseFailure("server_error", {
        provider: "gemini",
        debugMessage: msg.slice(0, 200),
      }),
    );
  }
}
