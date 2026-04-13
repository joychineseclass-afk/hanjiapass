/**
 * 따라 말하기：getUserMedia + MediaRecorder 真实录音闭环 + Web Speech 中文识别 + 评分
 *
 * 架构（必读）：
 * - 浏览器 SpeechRecognition **仅作前端即时预览**；引擎/网络差异大，**STT 空 transcript 不代表用户未开口**。
 * - **row._hanjiShadowingLastBlob** 为后续 **服务端 ASR / 发音评分** 的正式输入；**正式评分应以后端识别为准**。
 * - 浏览器未识别出文本时，**不得**与「未录音」混同，也**不应**给出正式 0 分（见 recording_ok_no_browser_stt）。
 *
 * 注意：shadowing STT 第二次 toggle 只 recognition.stop()，不更新回调，故 onResult/onError 必须在第一次 toggle 传入。
 */

import { createShadowingZhSpeechSession, isShadowingZhSttSupported } from "./shadowingSpeechRecognition.js";
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

/** 录音已成功，但浏览器 STT 未给出可用文本：不给出正式分数 */
export function buildRecordingOkNoBrowserSttResult() {
  return { score: /** @type {null} */ (null), band: "pending", reason: "recording_ok_no_browser_stt" };
}

/**
 * @param {{ interimFallback?: boolean }} [opts]
 */
export function buildShadowingFeedbackMessage(result, _targetZh, recognizedText, t, opts = {}) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const preview = str(recognizedText).slice(0, 200);
  const interimFallback = !!opts.interimFallback;

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
    return {
      title: safeT("ai.shadowing_feedback_mismatch_title", "识别到了，但还不够接近"),
      body: safeT("ai.shadowing_feedback_mismatch_body", "听到：「{heard}」。请对照上面的中文再说一遍。").replace(
        "{heard}",
        preview,
      ),
      score: result.score,
      band,
      recognizedPreview: preview,
      interimPreviewNote,
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
  };
}

function buildFeedbackHtml(msg, recognizedText, t, extraTopHtml = "", feedbackOpts = {}) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const omitScore = msg.omitScore === true || (msg.score == null && msg.reason === "recording_ok_no_browser_stt");
  const score =
    !omitScore && msg.score != null
      ? `<div class="ai-shadowing-feedback-score"><span class="ai-shadowing-feedback-score-label">${escapeHtml(safeT("ai.shadowing_score_label", "得分"))}</span> <strong>${msg.score}</strong> / 100</div>`
      : "";
  const rec =
    recognizedText && String(recognizedText).trim()
      ? `<div class="ai-shadowing-feedback-rec"><span class="ai-shadowing-feedback-rec-label">${escapeHtml(safeT("ai.shadowing_recognized_label", "识别"))}</span> ${escapeHtml(String(recognizedText).trim())}</div>`
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

      log("calling speech.toggle() to stop recognition (uses handlers from first toggle)");
      speech.toggle({
        onResult: () => {},
        onError: () => {},
        onListeningChange: () => {},
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
      log("SpeechRecognition API missing");
      endRecordingUi();
      abortMediaSession(mediaSession);
      mediaSession = null;
      showFeedback(
        infrastructureBlock(
          t,
          t("ai.shadowing_err_stt_unsupported_title", "不支持语音识别"),
          t(
            "ai.shadowing_err_stt_unsupported_body",
            "当前浏览器不支持 Web Speech API。请使用 Chrome / Edge。麦克风录音已停止。",
          ),
        ),
      );
      return;
    }

    pendingBlobResult = null;

    speech.setTargetTextForDebug(targetZh);
    speech.setMatchStatusForDebug("listening");

    log("speech.toggle() start — registering onResult/onError for this session");
    speech.toggle({
      onResult: async (payload) => {
        const p = parseSttPayload(payload);
        log("speech onResult", p.text.slice(0, 160), p.interimFallback ? "[interim fallback]" : "");
        const blobResult = pendingBlobResult;
        pendingBlobResult = null;
        endRecordingUi();
        const durationMs = blobResult?.blob ? await getBlobAudioDurationMs(blobResult.blob) : 0;
        const blobLine = formatBlobLine(blobResult, durationMs, t);
        const result = scoreShadowingUtterance(targetZh, p.text);
        sttLog("target text=", JSON.stringify(targetZh));
        sttLog("match result=", JSON.stringify(result));
        speech.setMatchStatusForDebug(`${result.band}:${result.reason}`);
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        const msg = buildShadowingFeedbackMessage(result, targetZh, p.text, t, { interimFallback: p.interimFallback });
        const chosenSource = p.interimFallback ? "interim" : "final";
        const devSttHtml = debugOn
          ? buildDevSttHtml(targetZh, p.rawFinal, p.rawInterim, p.text, chosenSource)
          : "";
        // 正式评测输入：见架构说明（文件头）。浏览器 STT 仅预览。
        row._hanjiShadowingLastBlob = blobResult?.blob ?? null;
        row._hanjiShadowingLastBlobMeta = blobResult
          ? { sizeBytes: blobResult.sizeBytes, mimeType: blobResult.mimeType, durationMs }
          : null;
        showFeedback(buildFeedbackHtml(msg, p.text, t, blobLine, { devSttHtml }));
      },
      onError: async (code, detail) => {
        log("speech onError", "code=", code, "detail=", detail);
        speech.setMatchStatusForDebug(`error:${code}`);
        if (wrap._shadowingDbgRefresh) wrap._shadowingDbgRefresh();
        const blobResult = pendingBlobResult;
        pendingBlobResult = null;
        endRecordingUi();
        const durationMs = blobResult?.blob ? await getBlobAudioDurationMs(blobResult.blob) : 0;
        const blobLine = formatBlobLine(blobResult, durationMs, t);
        row._hanjiShadowingLastBlob = blobResult?.blob ?? null;
        row._hanjiShadowingLastBlobMeta = blobResult
          ? { sizeBytes: blobResult.sizeBytes, mimeType: blobResult.mimeType, durationMs }
          : null;

        if (code === "not_supported") {
          abortMediaSession(mediaSession);
          mediaSession = null;
          showFeedback(
            blobLine +
              infrastructureBlock(
                t,
                t("ai.shadowing_err_stt_unsupported_title", "不支持语音识别"),
                t(
                  "ai.shadowing_err_stt_unsupported_body",
                  "当前浏览器不支持 Web Speech 识别。可换用 Chrome / Edge。",
                ),
              ),
          );
          return;
        }
        if (code === "permission_denied") {
          showFeedback(
            blobLine +
              infrastructureBlock(
                t,
                t("ai.shadowing_err_stt_denied_title", "语音识别权限被拒绝"),
                t("ai.shadowing_err_stt_denied_body", "请允许语音识别相关权限后重试。"),
              ),
          );
          return;
        }
        if (code === "start_failed") {
          abortMediaSession(mediaSession);
          mediaSession = null;
          const d = detail != null ? String(detail) : "";
          showFeedback(
            blobLine +
              infrastructureBlock(
                t,
                t("ai.shadowing_err_stt_start_title", "语音识别未能启动"),
                t("ai.shadowing_err_stt_start_body", "详情：{detail}").replace("{detail}", escapeHtml(d)),
              ),
          );
          return;
        }
        if (code === "language_not_supported") {
          showFeedback(
            blobLine +
              infrastructureBlock(
                t,
                t("ai.shadowing_err_stt_lang_title", "浏览器不支持中文语音识别"),
                t(
                  "ai.shadowing_err_stt_lang_body",
                  "当前环境无法使用 zh-CN 语音识别（language-not-supported）。可换 Chrome/Edge，或后续改用服务端识别。",
                ),
              ),
          );
          return;
        }
        if (code === "service_not_allowed") {
          showFeedback(
            blobLine +
              infrastructureBlock(
                t,
                t("ai.shadowing_err_stt_service_title", "语音识别服务不可用"),
                t(
                  "ai.shadowing_err_stt_service_body",
                  "浏览器禁止或无法连接语音识别服务（service-not_allowed）。请检查网络与浏览器设置。",
                ),
              ),
          );
          return;
        }

        const noInput = code === "no_result" || code === "no_speech";
        const hasAudio = blobResult && blobResult.sizeBytes > 800;
        if (noInput && hasAudio) {
          const result = buildRecordingOkNoBrowserSttResult();
          const msg = buildShadowingFeedbackMessage(result, targetZh, "", t);
          const d = typeof speech.getLastDebug === "function" ? speech.getLastDebug() : {};
          const devSttHtml = debugOn
            ? buildDevSttHtml(
                targetZh,
                d.lastRawFinals ?? "",
                d.lastRawInterim ?? "",
                "",
                "none",
              )
            : "";
          showFeedback(buildFeedbackHtml(msg, "", t, blobLine, { devSttHtml }));
          return;
        }
        if (noInput) {
          const msg = {
            title: t("ai.shadowing_feedback_title_retry", "再试一次"),
            body: t(
              "ai.shadowing_feedback_no_speech_short",
              "未检测到有效语音。请确认麦克风已开启并靠近嘴边后再试。",
            ),
            score: null,
            band: "retry",
            omitScore: true,
          };
          const devSttHtml = debugOn
            ? buildDevSttHtml(targetZh, "", "", "", "none")
            : "";
          showFeedback(buildFeedbackHtml(msg, "", t, blobLine, { devSttHtml }));
          return;
        }

        const detailStr = detail != null && detail !== "" ? String(detail) : "";
        const msg = {
          title: t("ai.shadowing_err_stt_generic_title", "语音识别出错"),
          body:
            t("ai.shadowing_err_stt_generic_body", "代码：{code}").replace("{code}", escapeHtml(String(code))) +
            (detailStr ? ` (${escapeHtml(detailStr)})` : ""),
          score: 0,
          band: "retry",
        };
        showFeedback(buildFeedbackHtml(msg, "", t, blobLine));
      },
      onListeningChange: (listening) => {
        log("speech onListeningChange", listening);
      },
    });
  }

  return cleanup;
}
