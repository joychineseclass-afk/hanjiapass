/**
 * 상황 대화：浏览器中文语音识别（Web Speech API，zh-CN）
 * 含 getUserMedia 预检、音量粗检、错误分层与调试日志
 */

export const SITUATION_ASR_CODE = {
  OK: "ok",
  PERMISSION_DENIED: "permission_denied",
  MIC_OPEN_FAILED: "mic_open_failed",
  NO_AUDIO_INPUT: "recording_started_but_no_audio",
  NOT_SUPPORTED: "speech_recognition_not_supported",
  NO_RESULT: "speech_recognition_no_result",
  RECOGNITION_ERROR: "speech_recognition_error",
};

const LOG = "[SituationASR]";
const REC_LANG = "zh-CN";
/** 时间域振幅峰值阈值（约 0–128），低于此认为几乎无有效人声 */
const NO_INPUT_LEVEL_THRESHOLD = 6;

export function isSituationZhSpeechSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function str(v) {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/**
 * 创建一次会话用的识别器（每轮可复用同一实例，但 start 前会清理）
 */
export function createZhSituationRecognizer() {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  let recognition = null;
  let accumulated = "";
  let active = false;
  let lastSpeechError = null;
  let micStream = null;
  let levelTimer = null;
  let maxAmplitude = 0;
  let audioCtx = null;
  let micAcquired = false;

  function cleanupMic() {
    if (levelTimer) {
      clearInterval(levelTimer);
      levelTimer = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      micStream = null;
    }
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch (_) {}
      audioCtx = null;
    }
    micAcquired = false;
  }

  function log(...args) {
    if (typeof console !== "undefined" && console.log) console.log(LOG, ...args);
  }

  async function _startImpl() {
    lastSpeechError = null;
    accumulated = "";
    maxAmplitude = 0;
    cleanupMic();

    log("recognition.lang (configured)", REC_LANG);

    if (!SR) {
      log("failure_layer", SITUATION_ASR_CODE.NOT_SUPPORTED, "SpeechRecognition API missing");
      return { ok: false, code: SITUATION_ASR_CODE.NOT_SUPPORTED };
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      log("failure_layer", SITUATION_ASR_CODE.MIC_OPEN_FAILED, "getUserMedia not available");
      return { ok: false, code: SITUATION_ASR_CODE.MIC_OPEN_FAILED };
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micAcquired = true;
      log("mic_stream_acquired", true, "track0_label=", micStream.getAudioTracks()[0]?.label || "(no label)");
    } catch (e) {
      const name = e && e.name ? e.name : "";
      log("mic_stream_acquired", false, "error_name=", name, "message=", e && e.message ? e.message : e);
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        return { ok: false, code: SITUATION_ASR_CODE.PERMISSION_DENIED, error: e };
      }
      return { ok: false, code: SITUATION_ASR_CODE.MIC_OPEN_FAILED, error: e };
    }

    try {
      audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(micStream);
      const an = audioCtx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      levelTimer = setInterval(() => {
        try {
          an.getByteTimeDomainData(buf);
          let m = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = Math.abs(buf[i] - 128);
            if (v > m) m = v;
          }
          if (m > maxAmplitude) maxAmplitude = m;
        } catch (_) {}
      }, 90);
    } catch (e) {
      log("audio_level_monitor_init_failed", e && e.message ? e.message : e);
    }

    recognition = new SR();
    recognition.lang = REC_LANG;
    log("recognition.lang (instance after set)", recognition.lang);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) accumulated += str(res[0]?.transcript);
      }
    };

    recognition.onerror = (ev) => {
      lastSpeechError = {
        error: ev && "error" in ev ? String(ev.error) : "unknown",
        message: ev && "message" in ev ? String(ev.message || "") : "",
      };
      log("speech_recognition_error_event", "error=", lastSpeechError.error, "message=", lastSpeechError.message);
    };

    try {
      recognition.start();
      active = true;
      return { ok: true };
    } catch (e) {
      log("recognition.start threw", e && e.message ? e.message : e);
      cleanupMic();
      return { ok: false, code: SITUATION_ASR_CODE.RECOGNITION_ERROR, error: e };
    }
  }

  function classifyEmptyResult() {
    if (lastSpeechError) {
      const err = lastSpeechError.error;
      if (err === "network") {
        return SITUATION_ASR_CODE.RECOGNITION_ERROR;
      }
      if (err === "not-allowed") {
        return SITUATION_ASR_CODE.PERMISSION_DENIED;
      }
      if (err === "audio-capture") {
        return SITUATION_ASR_CODE.MIC_OPEN_FAILED;
      }
      if (err === "no-speech" || err === "aborted") {
        return SITUATION_ASR_CODE.NO_RESULT;
      }
      return SITUATION_ASR_CODE.RECOGNITION_ERROR;
    }
    if (maxAmplitude < NO_INPUT_LEVEL_THRESHOLD) {
      return SITUATION_ASR_CODE.NO_AUDIO_INPUT;
    }
    return SITUATION_ASR_CODE.NO_RESULT;
  }

  function _stopImpl() {
    return new Promise((resolve) => {
      const finish = (finalCode, rawOverride) => {
        const rawText = rawOverride != null ? str(rawOverride) : str(accumulated);
        log("raw_recognition_text", JSON.stringify(rawText));
        log("max_audio_level_observed", maxAmplitude, "threshold", NO_INPUT_LEVEL_THRESHOLD);
        log("mic_stream_acquired (snapshot)", micAcquired);
        log("final_layer", finalCode);
        if (lastSpeechError) {
          log(
            "speech_recognition_error_snapshot",
            "error=",
            lastSpeechError.error,
            "message=",
            lastSpeechError.message,
          );
        }

        const out = {
          finalCode,
          rawText,
          recognitionLang: REC_LANG,
          micStreamAcquired: micAcquired,
          maxAudioLevel: maxAmplitude,
          speechError: lastSpeechError,
        };
        cleanupMic();
        active = false;
        recognition = null;
        accumulated = "";
        resolve(out);
      };

      if (!recognition || !active) {
        log("stop called while inactive");
        finish(SITUATION_ASR_CODE.NO_RESULT, "");
        return;
      }

      const r = recognition;
      r.onend = () => {
        const raw = str(accumulated).trim();
        if (raw) {
          finish(SITUATION_ASR_CODE.OK, raw);
          return;
        }
        finish(classifyEmptyResult(), "");
      };

      try {
        r.stop();
      } catch (e) {
        log("recognition.stop threw", e && e.message ? e.message : e);
        finish(classifyEmptyResult(), "");
      }
    });
  }

  function abort() {
    try {
      if (recognition && active) recognition.abort();
    } catch (_) {}
    cleanupMic();
    active = false;
    recognition = null;
    accumulated = "";
    lastSpeechError = null;
    maxAmplitude = 0;
  }

  return {
    start: _startImpl,
    stop: _stopImpl,
    abort,
    isActive: () => active,
    /** @internal for situationAsrStart wrapper */
    _startImpl,
    _stopImpl,
  };
}
