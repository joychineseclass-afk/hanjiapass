/**
 * Lumina 跟读：服务端 ASR（MVP）
 * POST multipart/form-data: audio, targetText, lang, mode, lessonId?, itemId?
 * 或 POST application/json: { audioBase64, mimeType, targetText, ... }（便于本地调试）
 *
 * Provider：Google Gemini 多模态（音频→文本）。未配置 GEMINI 系列 key 时返回 service_not_configured，不伪造识别结果。
 */

import formidable from "formidable";
import { readFile, unlink } from "fs/promises";

export const config = { runtime: "nodejs", maxDuration: 60 };

const API_VERSION = String(process.env.GEMINI_API_VERSION || "v1beta").trim();

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

const ASR_MODEL_CANDIDATES = [
  process.env.GEMINI_ASR_MODEL,
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
].filter(Boolean);

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
 * @returns {Promise<{ ok: boolean, transcript?: string, model?: string, error?: string }>}
 */
async function transcribeWithGemini(buffer, mimeType, targetText, apiKey) {
  const base64 = buffer.toString("base64");
  const safeTarget = String(targetText || "").slice(0, 200);
  const prompt = `你是中文语音转写助手。请只听音频，把说话人说的中文转写为简体汉字。
要求：
1) 只输出转写正文，不要翻译、不要解释、不要引号或项目符号。
2) 若听不清或没有中文语音，只输出空字符串。
3) 下列「目标句」仅供对齐参考，转写以音频为准：${safeTarget}`;

  let lastErr = "";
  for (const model of ASR_MODEL_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent`;
    try {
      console.info("[shadowing-asr] calling Gemini ASR", { model, bytes: buffer.length, mimeType });
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
      if (!resp.ok) {
        const msg = data?.error?.message || rawText || `HTTP ${resp.status}`;
        lastErr = String(msg).slice(0, 500);
        console.warn("[shadowing-asr] Gemini HTTP error", resp.status, model, lastErr.slice(0, 200));
        continue;
      }
      const text = extractGeminiText(data);
      console.info("[shadowing-asr] Gemini ASR success", { model, transcriptLen: text.length });
      return { ok: true, transcript: text, model };
    } catch (e) {
      lastErr = e?.message || String(e);
      console.warn("[shadowing-asr] Gemini fetch exception", model, lastErr.slice(0, 200));
    }
  }
  return { ok: false, error: lastErr || "all_models_failed" };
}

function baseFailure(reason, extra = {}) {
  return {
    success: false,
    transcript: "",
    normalizedTranscript: "",
    confidence: null,
    provider: extra.provider ?? "gemini",
    reason,
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

  if (req.method === "GET") {
    const keys = getApiKeys();
    return jsonResponse(res, 200, {
      ok: true,
      message: "Lumina shadowing ASR. POST multipart (audio, targetText, lang, mode) or JSON with audioBase64.",
      hasProviderKey: keys.length > 0,
      keyCount: keys.length,
      models: ASR_MODEL_CANDIDATES,
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
      mimeType = (f.mimetype || f.mimeType || mimeType);
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

    const out = await transcribeWithGemini(buffer, mimeType, targetText, apiKey);
    if (!out.ok) {
      return jsonResponse(res, 200, baseFailure("provider_error", { provider: "gemini", detail: out.error }));
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
    return jsonResponse(res, 500, baseFailure("server_error", { provider: "gemini", detail: msg.slice(0, 200) }));
  }
}
