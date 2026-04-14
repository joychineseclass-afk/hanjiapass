/**
 * 따라 말하기：getUserMedia + MediaRecorder 录音 + **后端 ASR 正式评分** + 浏览器 Speech 仅预览
 *
 * 架构（必读）：
 * - **正式 transcript / 正式分数** 仅来自 **POST /api/shadowing-asr**（服务端 Gemini 多模态转写）；不得用浏览器 STT 作为正式评分依据。
 * - 浏览器 SpeechRecognition **仅可选预览**；失败、空串不影响正式主链。
 * - **row._hanjiShadowingLastBlob** 为上传服务端 ASR 的正式输入；浏览器 STT 空结果不代表用户未开口。
 *
 * 注意：shadowing STT 第二次 toggle 只 recognition.stop()；预览回调在首次 toggle 注册。
 */

import { createShadowingZhSpeechSession, isShadowingZhSttSupported } from "./shadowingSpeechRecognition.js";
import { postShadowingAsr } from "./shadowingAsrClient.js";
import { speakText } from "../../platform/audio/ttsEngine.js";
import {
  startMediaRecorderCapture,
  stopMediaRecorderCapture,
  abortMediaSession,
  getRecordingSupportInfo,
  getBlobAudioDurationMs,
} from "./shadowingAudioCapture.js";

const LOG = "[AI Speaking]";
const STT_LOG = "[AI Speaking][STT]";

function log(...args) {
  if (typeof console !== "undefined" && console.log) {
    console.log(LOG, ...args);
  }
}

function sttLog(...args) {
  if (typeof console !== "undefined" && console.log) {
    console.log(STT_LOG, ...args);
  }
}

const str = (v) => (typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "");

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 比对用：去空白与常见标点
 */
export function normalizeChineseForMatch(s) {
  let x = str(s);
  x = x.replace(/\u3000/g, "");
  x = x.replace(/\s+/g, "");
  x = x.replace(/[，。、！？!?,．·…]/g, "");
  return x;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return dp[m][n];
}

/**
 * @returns {{ score: number, band: 'excellent'|'good'|'ok'|'retry', reason: string }}
 */
export function scoreShadowingUtterance(targetZh, recognizedRaw) {
  const target = normalizeChineseForMatch(targetZh);
  const raw = str(recognizedRaw);

  if (!target) {
    return { score: 0, band: "retry", reason: "empty_target" };
  }
  if (!raw) {
    return { score: 0, band: "retry", reason: "stt_empty" };
  }

  const hasCjk = /[\u4e00-\u9fff]/.test(raw);
  if (!hasCjk) {
    return { score: 0, band: "retry", reason: "no_cjk_in_recognition" };
  }

  const rec = normalizeChineseForMatch(raw);
  if (!rec) {
    return { score: 0, band: "retry", reason: "stt_empty" };
  }

  if (target === rec) {
    return { score: 100, band: "excellent", reason: "exact" };
  }

  if (rec.includes(target) || target.includes(rec)) {
    const base = target.length >= rec.length ? 94 : 90;
    return { score: Math.min(98, base + 2), band: "excellent", reason: "contain" };
  }

  const dist = levenshtein(target, rec);
  const maxLen = Math.max(target.length, rec.length, 1);
  let score = Math.round((1 - dist / maxLen) * 100);
  score = Math.max(0, Math.min(100, score));

  let band = "retry";
  if (score >= 88) band = "excellent";
  else if (score >= 70) band = "good";
  else if (score >= 45) band = "ok";
  else band = "retry";

  return { score, band, reason: "similarity" };
}

/** 正式评分：与服务端 transcript 对齐（MVP 规则同 scoreShadowingUtterance） */
export function scoreShadowingServerMvp(targetZh, transcriptRaw) {
  return scoreShadowingUtterance(targetZh, transcriptRaw);
}

/** 录音已成功，但浏览器 STT 未给出可用文本：不给出正式分数 */
export function buildRecordingOkNoBrowserSttResult() {
  return { score: /** @type {null} */ (null), band: "pending", reason: "recording_ok_no_browser_stt" };
}

/**
 * @param {{ interimFallback?: boolean, formalAsr?: boolean }} [opts]
 */
export function buildShadowingFeedbackMessage(result, _targetZh, recognizedText, t, opts = {}) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const preview = str(recognizedText).slice(0, 200);
  const interimFallback = !!opts.interimFallback;
  const formalAsr = !!opts.formalAsr;

  if (result.reason === "recording_ok_no_browser_stt") {
    return {
      title: safeT("ai.shadowing_recording_ok_no_stt_title", "已录音，浏览器未稳定识别"),
      body: safeT(
        "ai.shadowing_recording_ok_no_stt_body",
        "本次音频已保存。浏览器语音识别未返回可靠文本，建议重试或交由服务端评测；正式分数以后端识别为准。",
      ),
      score: null,
      band: result.band,
      recognizedPreview: preview,
      omitScore: true,
    };
  }

  if (result.reason === "empty_target") {
    return {
      title: safeT("ai.shadowing_feedback_title_retry", "再试一次"),
      body: safeT("ai.shadowing_feedback_no_speech", "没有听清楚，请大声、清楚地说一遍。"),
      score: result.score ?? 0,
      band: result.band,
      recognizedPreview: preview,
    };
  }

  if (result.reason === "stt_empty") {
    return {
      title: safeT("ai.shadowing_stt_empty_title", "未识别到文字"),
      body: safeT(
        "ai.shadowing_stt_empty_body",
        "本轮未从语音识别得到有效文本。请稍长按话筒、说完再松，或换 Chrome/Edge 并重试。",
      ),
      score: result.score ?? 0,
      band: result.band,
      recognizedPreview: preview,
    };
  }

  if (result.reason === "no_cjk_in_recognition") {
    return {
      title: safeT("ai.shadowing_stt_no_cjk_title", "未识别到中文"),
      body: safeT(
        "ai.shadowing_stt_no_cjk_body",
        "识别结果里没有汉字。请用中文说出目标词/句，或检查 recognition.lang 是否为中文。",
      ),
      score: result.score ?? 0,
      band: result.band,
      recognizedPreview: preview,
    };
  }

  if (result.reason === "no_speech") {
    return {
      title: safeT("ai.shadowing_feedback_title_retry", "再试一次"),
      body: safeT("ai.shadowing_feedback_no_speech", "没有听清楚，请大声、清楚地说一遍。"),
      score: result.score ?? 0,
      band: result.band,
      recognizedPreview: preview,
    };
  }

  const band = result.band;
  if (band === "retry" && result.reason === "similarity" && preview) {
    const interimPreviewNote = interimFallback
      ? safeT("ai.shadowing_stt_interim_preview_note", "预览识别结果（interim fallback），仅供参考")
      : "";
    const title = formalAsr
      ? safeT("ai.shadowing_server_mismatch_title", "识别结果与目标不够接近")
      : safeT("ai.shadowing_feedback_mismatch_title", "识别到了，但还不够接近");
    const body = formalAsr
      ? safeT(
          "ai.shadowing_server_mismatch_body",
          "服务端听到：「{heard}」。请再接近目标发音说一次。",
        ).replace("{heard}", preview)
      : safeT("ai.shadowing_feedback_mismatch_body", "听到：「{heard}」。请对照上面的中文再说一遍。").replace(
          "{heard}",
          preview,
        );
    return {
      title,
      body,
      score: result.score,
      band,
      recognizedPreview: preview,
      interimPreviewNote,
      scoreLabelKey: formalAsr ? "ai.shadowing_official_score_label" : undefined,
      recognizedLabelKey: formalAsr ? "ai.shadowing_official_recognition_label" : undefined,
    };
  }

  let bodyKey = "ai.shadowing_feedback_retry_1";
  if (band === "excellent") bodyKey = "ai.shadowing_feedback_excellent_1";
  else if (band === "good") bodyKey = "ai.shadowing_feedback_good_1";
  else if (band === "ok") bodyKey = "ai.shadowing_feedback_ok_1";

  const titleKey =
    band === "excellent"
      ? "ai.shadowing_level_excellent"
      : band === "good"
        ? "ai.shadowing_level_good"
        : band === "ok"
          ? "ai.shadowing_level_ok"
          : "ai.shadowing_level_retry";

  const interimPreviewNote = interimFallback
    ? safeT("ai.shadowing_stt_interim_preview_note", "预览识别结果（interim fallback），仅供参考")
    : "";

  return {
    title: safeT(titleKey, band),
    body: safeT(bodyKey, ""),
    score: result.score,
    band,
    recognizedPreview: preview,
    interimPreviewNote,
    scoreLabelKey: formalAsr ? "ai.shadowing_official_score_label" : undefined,
    recognizedLabelKey: formalAsr ? "ai.shadowing_official_recognition_label" : undefined,
  };
}

function buildFeedbackHtml(msg, recognizedText, t, extraTopHtml = "", feedbackOpts = {}) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const omitScore = msg.omitScore === true || (msg.score == null && msg.reason === "recording_ok_no_browser_stt");
  const scoreLabelKey = msg.scoreLabelKey || "ai.shadowing_score_label";
  const recLabelKey = msg.recognizedLabelKey || "ai.shadowing_recognized_label";
  const score =
    !omitScore && msg.score != null
      ? `<div class="ai-shadowing-feedback-score"><span class="ai-shadowing-feedback-score-label">${escapeHtml(safeT(scoreLabelKey, safeT("ai.shadowing_score_label", "得分")))}</span> <strong>${msg.score}</strong> / 100</div>`
      : "";
  const rec =
    recognizedText && String(recognizedText).trim()
      ? `<div class="ai-shadowing-feedback-rec"><span class="ai-shadowing-feedback-rec-label">${escapeHtml(safeT(recLabelKey, safeT("ai.shadowing_recognized_label", "识别")))}</span> ${escapeHtml(String(recognizedText).trim())}</div>`
      : "";
  const body = msg.body ? `<div class="ai-shadowing-feedback-body">${escapeHtml(msg.body)}</div>` : "";
  const interimNote =
    msg.interimPreviewNote && String(msg.interimPreviewNote).trim()
      ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(String(msg.interimPreviewNote).trim())}</div>`
      : "";
  const devStt = feedbackOpts.devSttHtml ? `<div class="ai-shadowing-stt-dev" aria-hidden="true">${feedbackOpts.devSttHtml}</div>` : "";
  return `${extraTopHtml}<div class="ai-shadowing-feedback-inner">
    <div class="ai-shadowing-feedback-title">${escapeHtml(msg.title)}</div>
    ${interimNote}
    ${score}
    ${rec}
    ${body}
    ${devStt}
  </div>`;
}

function mapGetUserMediaError(e, t) {
  const name = e && e.name ? String(e.name) : "";
  const message = e && e.message ? String(e.message) : String(e || "");
  log("getUserMedia error", "name=", name, "message=", message, e);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      title: t("ai.shadowing_err_mic_denied_title", "无法使用麦克风"),
      body: t(
        "ai.shadowing_err_mic_denied_body",
        "浏览器未授予麦克风权限，请在地址栏中允许麦克风后重试。",
      ),
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      title: t("ai.shadowing_err_no_mic_title", "未检测到麦克风"),
      body: t("ai.shadowing_err_no_mic_body", "请连接麦克风设备后重试。"),
    };
  }
  if (name === "NotSecureContext") {
    return {
      title: t("ai.shadowing_err_insecure_title", "需要安全连接"),
      body: t(
        "ai.shadowing_err_insecure_body",
        "录音需要 HTTPS 或 localhost。请使用 https 访问，或本地打开页面。",
      ),
    };
  }
  return {
    title: t("ai.shadowing_err_mic_failed_title", "无法开启麦克风"),
    body: t("ai.shadowing_err_mic_failed_body", "无法访问麦克风：{detail}").replace("{detail}", escapeHtml(message)),
  };
}

function infrastructureBlock(t, title, body) {
  return `<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--error">
    <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
    <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
  </div>`;
}

function formatBlobLine(blobResult, durationMs, safeT) {
  if (!blobResult || !blobResult.blob || blobResult.sizeBytes <= 0) return "";
  const sec = durationMs > 0 ? (durationMs / 1000).toFixed(1) : "?";
  const kb = (blobResult.sizeBytes / 1024).toFixed(1);
  const raw = safeT("ai.shadowing_blob_saved", "已录到音频：约 {seconds} 秒 / {sizeKb} KB");
  return `<div class="ai-shadowing-feedback-blob">${escapeHtml(raw.replace("{seconds}", sec).replace("{sizeKb}", kb))}</div>`;
}

/** @param {unknown} payload */
function parseSttPayload(payload) {
  if (payload && typeof payload === "object" && "text" in payload) {
    const o = /** @type {{ text?: string, interimFallback?: boolean, rawFinal?: string, rawInterim?: string }} */ (payload);
    return {
      text: str(o.text),
      interimFallback: !!o.interimFallback,
      rawFinal: o.rawFinal != null ? String(o.rawFinal) : "",
      rawInterim: o.rawInterim != null ? String(o.rawInterim) : "",
    };
  }
  return { text: str(payload), interimFallback: false, rawFinal: "", rawInterim: "" };
}

function buildDevSttHtml(targetZh, rawFinal, rawInterim, chosen, sourceLabel) {
  const lines = [
    `target: ${targetZh}`,
    `final transcript: ${rawFinal}`,
    `interim transcript: ${rawInterim}`,
    `chosen transcript: ${chosen}`,
    `chosen source: ${sourceLabel}`,
  ];
  return `<pre class="ai-shadowing-stt-dev-pre">${lines.map(escapeHtml).join("\n")}</pre>`;
}

function pickAudioFilename(mimeType) {
  const m = String(mimeType || "");
  if (m.includes("mp4")) return "shadowing.mp4";
  if (m.includes("ogg")) return "shadowing.ogg";
  if (m.includes("wav")) return "shadowing.wav";
  return "shadowing.webm";
}

function buildUploadingFeedbackHtml(blobLine, t) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const title = safeT("ai.shadowing_asr_uploading_title", "正在上传音频并识别");
  const body = safeT("ai.shadowing_asr_uploading_body", "正在进行正式语音评测，请稍候…");
  return `${blobLine}<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--pending">
    <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
    <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
  </div>`;
}

/**
 * @param {{
 *   target: string,
 *   browserPreview: string,
 *   serverTranscript: string,
 *   normalized: string,
 *   chosenSource: string,
 *   score: string | number,
 *   reason: string,
 *   provider: string,
 *   asrStatus: string,
 *   serverReason?: string,
 *   debugMessage?: string,
 *   triedModels?: string,
 *   lastTriedModel?: string,
 *   httpStatus?: string | number,
 * }} ctx
 */
function buildShadowingFormalDebugHtml(ctx) {
  /** 服务端结构化字段（仅 HANJI_DEBUG_SHADOWING=1 时展示本块） */
  const serverHead = [];
  const sr = ctx.serverReason != null && String(ctx.serverReason).trim() !== "" ? String(ctx.serverReason).trim() : "";
  if (sr) serverHead.push(`reason: ${sr}`);
  if (ctx.triedModels) serverHead.push(`triedModels: ${ctx.triedModels}`);
  if (ctx.lastTriedModel) serverHead.push(`lastTriedModel: ${ctx.lastTriedModel}`);
  if (ctx.httpStatus != null && ctx.httpStatus !== "") serverHead.push(`httpStatus: ${ctx.httpStatus}`);
  if (ctx.debugMessage) serverHead.push(`debugMessage: ${ctx.debugMessage}`);

  const lines = [];
  if (serverHead.length) {
    lines.push(...serverHead, "---");
  }

  lines.push(
    `target: ${ctx.target}`,
    `browser preview transcript: ${ctx.browserPreview}`,
    `server transcript: ${ctx.serverTranscript}`,
    `normalized transcript: ${ctx.normalized}`,
    `chosen source: ${ctx.chosenSource}`,
    `score: ${ctx.score}`,
  );
  if (!sr) lines.push(`reason: ${ctx.reason}`);
  lines.push(`provider: ${ctx.provider}`, `asr request status: ${ctx.asrStatus}`);

  return `<pre class="ai-shadowing-stt-dev-pre">${lines.map(escapeHtml).join("\n")}</pre>`;
}

/**
 * 挂载：话筒 = 真实录音 + 中文识别 + 评分；喇叭 = 仅播汉字
 * @returns {() => void} cleanup
 */
export function mountShadowingSpeakingPractice(wrap, t) {
  if (!wrap) return () => {};

  const speech = createShadowingZhSpeechSession();
  let activeMicBtn = null;
  /** @type {null | Awaited<ReturnType<typeof startMediaRecorderCapture>>} */
  let mediaSession = null;
  /** 第二次点击 stop 时先写入，供第一次 toggle 注册的 onResult/onError 读取 */
  let pendingBlobResult = null;

  function cleanup() {
    log("cleanup: abort speech + media");
    speech.abort();
    abortMediaSession(mediaSession);
    mediaSession = null;
    pendingBlobResult = null;
    activeMicBtn = null;
  }

  const debugOn =
    typeof localStorage !== "undefined" && localStorage.getItem("HANJI_DEBUG_SHADOWING") === "1";
  if (debugOn) {
    let dbg = wrap.querySelector(".ai-shadowing-audio-debug");
    if (!dbg) {
      dbg = document.createElement("div");
      dbg.className = "ai-shadowing-audio-debug";
      dbg.setAttribute("aria-hidden", "true");
      const head = wrap.querySelector(".ai-shadowing-session-head");
      if (head) head.appendChild(dbg);
      else wrap.prepend(dbg);
    }
    const refreshDbg = () => {
      const s = getRecordingSupportInfo();
      const d = typeof speech.getLastDebug === "function" ? speech.getLastDebug() : {};
      dbg.textContent = [
        `secureContext: ${s.secureContext}`,
        `mediaDevices: ${s.mediaDevices}`,
        `MediaRecorder: ${s.mediaRecorder}`,
        `SpeechRecognition supported: ${s.speechRecognition}`,
        `recognition.lang: ${d.recognitionLang ?? "n/a"}`,
        `interimResults: ${d.interimResults}`,
        `continuous: ${d.continuous}`,
        `recognition started: ${d.started}`,
        `waitingFinalize: ${d.waitingFinalize}`,
        `last transcript raw (finals): ${d.lastRawFinals ?? ""}`,
        `last transcript raw (interim): ${d.lastRawInterim ?? ""}`,
        `last transcript normalized: ${d.lastNormalizedOut ?? ""}`,
        `last chosen source: ${d.lastChosenSource ?? "none"}`,
        `interim fallback used: ${d.lastInterimFallback}`,
        `target text: ${d.lastTargetText ?? ""}`,
        `last stt error: ${d.lastSttError || "(none)"}`,
        `match status: ${d.matchStatus ?? "idle"}`,
        `mediaSession: ${mediaSession ? "active" : "null"}`,
        `last ASR (server): ${wrap._shadowingLastAsrResponse ? JSON.stringify(wrap._shadowingLastAsrResponse).slice(0, 600) : "(none)"}`,
      ].join("\n");
    };
    refreshDbg();
    wrap._shadowingDbgRefresh = refreshDbg;
  }

  wrap.querySelectorAll(".ai-shadowing-train-listen").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = btn.closest(".ai-shadowing-train-item");
      const zh = row?.getAttribute("data-shadow-zh");
      if (!zh) return;
      speakText(zh, { lang: "zh-CN", rate: 0.95 });
    });
  });

  /**
   * 正式评分主链：上传 Blob → /api/shadowing-asr → 展示服务端 transcript 与分数
   */
  async function runShadowingFormalAsr(ctx) {
    const {
      row,
      targetZh,
      blobResult,
      blobLine,
      lessonId,
      itemId,
      t,
      showFeedback,
      debugOn,
      speech,
    } = ctx;

    const browserSnap = row._hanjiBrowserPreview || {
      text: "",
      rawFinal: "",
      rawInterim: "",
    };
    let asrStatus = "pending";
    /** @type {Record<string, unknown>} */
    let data = {};

    try {
      const form = new FormData();
      form.append("audio", blobResult.blob, pickAudioFilename(blobResult.mimeType));
      form.append("targetText", targetZh);
      form.append("lang", "zh-CN");
      form.append("mode", "shadowing");
      if (lessonId) form.append("lessonId", lessonId);
      if (itemId) form.append("itemId", itemId);

      const postResult = await postShadowingAsr(form);
      asrStatus = `http_${postResult.status}`;
      data = postResult.data && typeof postResult.data === "object" ? postResult.data : {};
      wrap._shadowingLastAsrResponse = data;

      if (!postResult.ok) {
        const title = t("ai.shadowing_server_error_title", "语音识别失败");
        const body = t("ai.shadowing_server_error_body", "服务端暂时不可用，请稍后重试。");
        const dbg = debugOn
          ? wrapDbg(
              buildShadowingFormalDebugHtml({
                target: targetZh,
                browserPreview: browserSnap.text || "",
                serverTranscript: "",
                normalized: "",
                chosenSource: "none",
                score: "—",
                reason: `http_${postResult.status}`,
                provider: "gemini",
                asrStatus,
                serverReason:
                  data && typeof data === "object" && data.reason != null ? String(data.reason) : "",
                httpStatus:
                  data && typeof data === "object" && data.httpStatus != null
                    ? data.httpStatus
                    : postResult.status,
                debugMessage:
                  data && typeof data === "object" && data.debugMessage != null
                    ? String(data.debugMessage).slice(0, 800)
                    : "",
                triedModels:
                  data && typeof data === "object" && Array.isArray(data.triedModels)
                    ? data.triedModels.join(", ")
                    : "",
                lastTriedModel:
                  data && typeof data === "object" && data.lastTriedModel != null
                    ? String(data.lastTriedModel)
                    : "",
              }),
            )
          : "";
        showFeedback(`${blobLine}${infrastructureBlock(t, title, body)}${dbg}`);
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        return;
      }
    } catch (e) {
      log("postShadowingAsr network error", e && e.message, e);
      asrStatus = `network_error`;
      const title = t("ai.shadowing_asr_network_title", "上传失败");
      const body = t("ai.shadowing_asr_network_body", "无法连接语音识别服务，请检查网络后重试。");
      const devHtml = debugOn
        ? `<div class="ai-shadowing-stt-dev" aria-hidden="true">${buildShadowingFormalDebugHtml({
            target: targetZh,
            browserPreview: browserSnap.text || "",
            serverTranscript: "",
            normalized: "",
            chosenSource: "none",
            score: "—",
            reason: "network",
            provider: "—",
            asrStatus,
          })}</div>`
        : "";
      showFeedback(`${blobLine}${infrastructureBlock(t, title, body)}${devHtml}`);
      if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
      return;
    }

    const transcriptRaw = String(data.normalizedTranscript || data.transcript || "").trim();
    const provider = String(data.provider || "gemini");
    const success = data.success === true;

    function asrServerDebugPatch() {
      return {
        serverReason: data && data.reason != null ? String(data.reason) : "",
        debugMessage:
          data && data.debugMessage != null ? String(data.debugMessage).slice(0, 800) : "",
        triedModels: Array.isArray(data.triedModels) ? data.triedModels.join(", ") : "",
        lastTriedModel: data.lastTriedModel != null ? String(data.lastTriedModel) : "",
        httpStatus: data.httpStatus != null ? data.httpStatus : "",
      };
    }

    function debugBlock(chosenSource, scoreVal, reasonStr) {
      if (!debugOn) return "";
      const patch = asrServerDebugPatch();
      return buildShadowingFormalDebugHtml({
        target: targetZh,
        browserPreview: browserSnap.text || "",
        serverTranscript: String(data.transcript || ""),
        normalized: String(data.normalizedTranscript || transcriptRaw || ""),
        chosenSource,
        score: scoreVal,
        reason: reasonStr,
        provider,
        asrStatus,
        ...patch,
      });
    }
    function wrapDbg(inner) {
      return inner ? `<div class="ai-shadowing-stt-dev" aria-hidden="true">${inner}</div>` : "";
    }

    if (!success) {
      const reason = String(data.reason || "unknown");
      speech.setMatchStatusForDebug(`asr_fail:${reason}`);

      if (reason === "service_not_configured") {
        const title = t("ai.shadowing_asr_not_configured_title", "未配置正式语音识别");
        const body = t(
          "ai.shadowing_asr_not_configured_body",
          "当前服务器未配置语音识别服务。请联系管理员或稍后再试。",
        );
        const previewNote =
          browserSnap.text && browserSnap.text.trim()
            ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_footer", "浏览器预览（非正式评分）："))} ${escapeHtml(browserSnap.text.trim())}</div>`
            : "";
        showFeedback(
          `${blobLine}<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--error">
            <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
            <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
          </div>${previewNote}${wrapDbg(debugBlock("none", "—", reason))}`,
        );
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        return;
      }

      if (reason === "empty_transcript" || reason === "audio_too_small") {
        const title = t("ai.shadowing_server_empty_title", "未识别到有效中文");
        const body = t(
          "ai.shadowing_server_empty_body",
          "已收到录音，但服务端未识别出有效中文文本。请重试或稍后评测。",
        );
        const previewNote =
          browserSnap.text && browserSnap.text.trim()
            ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_footer", "浏览器预览（非正式评分）："))} ${escapeHtml(browserSnap.text.trim())}</div>`
            : "";
        showFeedback(
          `${blobLine}<div class="ai-shadowing-feedback-inner">
            <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
            <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
          </div>${previewNote}${wrapDbg(debugBlock("none", "—", reason))}`,
        );
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        return;
      }

      if (reason === "provider_error") {
        const title = t("ai.shadowing_asr_provider_unavailable_title", "无法使用语音服务");
        const body = t(
          "ai.shadowing_asr_provider_unavailable_body",
          "服务器语音服务暂时不可用，请稍后重试。",
        );
        const previewNote =
          browserSnap.text && browserSnap.text.trim()
            ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_footer", "浏览器预览（非正式评分）："))} ${escapeHtml(browserSnap.text.trim())}</div>`
            : "";
        showFeedback(
          `${blobLine}<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--error">
            <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
            <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
          </div>${previewNote}${wrapDbg(debugBlock("none", "—", reason))}`,
        );
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        return;
      }

      if (reason === "no_working_asr_model" || reason === "model_not_available") {
        const title = t("ai.shadowing_asr_no_model_title", "无法加载语音识别模型");
        const body = t(
          "ai.shadowing_asr_no_model_body",
          "暂时无法完成语音识别，请稍后再试。",
        );
        const previewNote =
          browserSnap.text && browserSnap.text.trim()
            ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_footer", "浏览器预览（非正式评分）："))} ${escapeHtml(browserSnap.text.trim())}</div>`
            : "";
        showFeedback(
          `${blobLine}<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--error">
            <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
            <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
          </div>${previewNote}${wrapDbg(debugBlock("none", "—", reason))}`,
        );
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        return;
      }

      if (reason === "server_error") {
        const title = t("ai.shadowing_server_error_title", "语音识别失败");
        const body = t("ai.shadowing_server_error_body", "服务端暂时不可用，请稍后重试。");
        const previewNote =
          browserSnap.text && browserSnap.text.trim()
            ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_footer", "浏览器预览（非正式评分）："))} ${escapeHtml(browserSnap.text.trim())}</div>`
            : "";
        showFeedback(
          `${blobLine}<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--error">
            <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
            <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
          </div>${previewNote}${wrapDbg(debugBlock("none", "—", reason))}`,
        );
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        return;
      }

      const title = t("ai.shadowing_server_error_title", "语音识别失败");
      const body = t("ai.shadowing_server_error_body", "服务端暂时不可用，请稍后重试。");
      const previewNote =
        browserSnap.text && browserSnap.text.trim()
          ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_footer", "浏览器预览（非正式评分）："))} ${escapeHtml(browserSnap.text.trim())}</div>`
          : "";
      showFeedback(
        `${blobLine}<div class="ai-shadowing-feedback-inner ai-shadowing-feedback--error">
          <div class="ai-shadowing-feedback-title">${escapeHtml(title)}</div>
          <div class="ai-shadowing-feedback-body">${escapeHtml(body)}</div>
        </div>${previewNote}${wrapDbg(debugBlock("none", "—", reason))}`,
      );
      if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
      return;
    }

    const result = scoreShadowingServerMvp(targetZh, transcriptRaw);
    sttLog("server ASR target=", JSON.stringify(targetZh), "transcript=", JSON.stringify(transcriptRaw), "match=", JSON.stringify(result));
    speech.setMatchStatusForDebug(`asr_ok:${result.band}:${result.reason}`);

    const msg = buildShadowingFeedbackMessage(result, targetZh, transcriptRaw, t, { formalAsr: true });
    const browserNote =
      browserSnap.text && browserSnap.text.trim() && browserSnap.text.trim() !== transcriptRaw.trim()
        ? `<div class="ai-shadowing-feedback-interim-note">${escapeHtml(t("ai.shadowing_browser_preview_note", "浏览器预览（仅供参考，非正式评分）"))}</div>`
        : "";

    showFeedback(
      `${blobLine}${browserNote}${buildFeedbackHtml(msg, transcriptRaw, t, "", {
        devSttHtml: debugBlock("server", result.score, result.reason),
      })}`,
    );
    if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
  }

  wrap.querySelectorAll(".ai-shadowing-train-mic").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void handleMicClick(btn);
    });
  });

  async function handleMicClick(btn) {
    const row = btn.closest(".ai-shadowing-train-item");
    if (!row) return;
    const targetZh = row.getAttribute("data-shadow-zh") || "";
    const feedbackEl = row.querySelector(".ai-shadowing-train-feedback");
    const statusEl = row.querySelector(".ai-shadowing-train-status");

    const showFeedback = (html) => {
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.innerHTML = html;
      }
    };

    const endRecordingUi = () => {
      row.classList.remove("is-recording");
      btn.classList.remove("is-recording");
      btn.setAttribute("aria-pressed", "false");
      if (statusEl) statusEl.hidden = true;
      activeMicBtn = null;
    };

    if (speech.isListening()) {
      if (activeMicBtn !== btn) {
        speech.abort();
        abortMediaSession(mediaSession);
        mediaSession = null;
        pendingBlobResult = null;
        return;
      }

      log("mic: stop sequence — MediaRecorder.stop then SpeechRecognition.stop");
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = t("ai.shadowing_status_processing", "处理中…");
      }

      try {
        pendingBlobResult = await stopMediaRecorderCapture(mediaSession);
        log("MediaRecorder finished", pendingBlobResult ? pendingBlobResult.sizeBytes : 0);
      } catch (err) {
        log("stopMediaRecorderCapture threw", err && err.name, err && err.message, err);
        pendingBlobResult = null;
      }
      mediaSession = null;
      if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();

      log("stop recognition (preview session)");
      if (speech.isListening()) {
        speech.toggle({
          onResult: () => {},
          onError: () => {},
          onListeningChange: () => {},
        });
      }

      const blobResult = pendingBlobResult;
      pendingBlobResult = null;
      endRecordingUi();

      if (!blobResult?.blob || blobResult.sizeBytes <= 0) {
        showFeedback(
          infrastructureBlock(
            t,
            t("ai.shadowing_err_recording_empty_title", "未录到有效音频"),
            t("ai.shadowing_err_recording_empty_body", "请长按话筒并清晰说话后再试。"),
          ),
        );
        return;
      }

      const durationMs = blobResult.blob ? await getBlobAudioDurationMs(blobResult.blob) : 0;
      const blobLine = formatBlobLine(blobResult, durationMs, t);
      row._hanjiShadowingLastBlob = blobResult.blob;
      row._hanjiShadowingLastBlobMeta = {
        sizeBytes: blobResult.sizeBytes,
        mimeType: blobResult.mimeType,
        durationMs,
      };

      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = t("ai.shadowing_status_uploading", "上传中…");
      }
      showFeedback(buildUploadingFeedbackHtml(blobLine, t));

      const lessonId = wrap.getAttribute("data-lesson-id") || "";
      const itemId = row.id || row.getAttribute("id") || "";

      void runShadowingFormalAsr({
        row,
        targetZh,
        blobResult,
        blobLine,
        lessonId,
        itemId,
        t,
        showFeedback,
        debugOn,
        speech,
      });
      return;
    }

    if (activeMicBtn && activeMicBtn !== btn) {
      speech.abort();
      abortMediaSession(mediaSession);
      mediaSession = null;
      pendingBlobResult = null;
    }

    activeMicBtn = btn;
    row.classList.add("is-recording");
    btn.classList.add("is-recording");
    btn.setAttribute("aria-pressed", "true");
    if (feedbackEl) {
      feedbackEl.innerHTML = "";
      feedbackEl.hidden = true;
    }

    const sup = getRecordingSupportInfo();
    log("mic: start — support", sup);
    if (!sup.secureContext) {
      endRecordingUi();
      showFeedback(
        infrastructureBlock(
          t,
          t("ai.shadowing_err_insecure_title", "需要安全连接"),
          t(
            "ai.shadowing_err_insecure_body",
            "录音需要 HTTPS 或 localhost。请使用 https 访问，或本地打开页面。",
          ),
        ),
      );
      return;
    }
    if (!sup.mediaDevices) {
      endRecordingUi();
      showFeedback(
        infrastructureBlock(
          t,
          t("ai.shadowing_err_no_getusermedia_title", "无法访问麦克风 API"),
          t("ai.shadowing_err_no_getusermedia_body", "当前环境不支持 navigator.mediaDevices.getUserMedia。"),
        ),
      );
      return;
    }
    if (!sup.mediaRecorder) {
      endRecordingUi();
      showFeedback(
        infrastructureBlock(
          t,
          t("ai.shadowing_err_no_mediarecorder_title", "不支持录音"),
          t("ai.shadowing_err_no_mediarecorder_body", "当前浏览器不支持 MediaRecorder，请使用最新 Chrome / Edge。"),
        ),
      );
      return;
    }

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = t("ai.shadowing_status_requesting_mic", "正在请求麦克风权限…");
    }

    try {
      log("getUserMedia + MediaRecorder.start");
      mediaSession = await startMediaRecorderCapture();
    } catch (e) {
      log("startMediaRecorderCapture failed", e && e.name, e && e.message, e);
      abortMediaSession(mediaSession);
      mediaSession = null;
      endRecordingUi();
      const { title, body } = mapGetUserMediaError(e, t);
      showFeedback(infrastructureBlock(t, title, body));
      return;
    }

    if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();

    if (statusEl) {
      statusEl.textContent = t("ai.shadowing_speak_now", "请说吧");
    }

    if (!isShadowingZhSttSupported()) {
      log("SpeechRecognition unavailable — skip browser preview; formal ASR still runs");
    }

    pendingBlobResult = null;
    row._hanjiBrowserPreview = { text: "", rawFinal: "", rawInterim: "", interimFallback: false };

    speech.setTargetTextForDebug(targetZh);
    speech.setMatchStatusForDebug("idle");

    if (isShadowingZhSttSupported()) {
      speech.setMatchStatusForDebug("listening");
      log("speech.toggle — browser STT preview only (non-formal)");
      speech.toggle({
        onResult: (payload) => {
          const p = parseSttPayload(payload);
          row._hanjiBrowserPreview = {
            text: p.text,
            rawFinal: p.rawFinal,
            rawInterim: p.rawInterim,
            interimFallback: p.interimFallback,
          };
          sttLog("preview only", p.text.slice(0, 120));
          speech.setMatchStatusForDebug("browser_preview");
          if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        },
        onError: (code, detail) => {
          sttLog("preview STT error (non-formal)", code, detail);
          speech.setMatchStatusForDebug(`preview_err:${code}`);
          if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        },
        onListeningChange: (listening) => {
          log("speech onListeningChange (preview)", listening);
        },
      });
    }
  }

  return cleanup;
}
