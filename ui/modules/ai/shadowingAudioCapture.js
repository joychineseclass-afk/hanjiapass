/**
 * 따라 말하기：麦克风真实录音（getUserMedia + MediaRecorder）与能力探测
 * 日志前缀 [AI Speaking]
 */

const LOG = "[AI Speaking]";

function log(...args) {
  if (typeof console !== "undefined" && console.log) {
    console.log(LOG, ...args);
  }
}

export function getRecordingSupportInfo() {
  if (typeof window === "undefined") {
    return {
      secureContext: false,
      mediaDevices: false,
      mediaRecorder: false,
      speechRecognition: false,
    };
  }
  return {
    secureContext: !!window.isSecureContext,
    mediaDevices: !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}

/**
 * @returns {string} mimeType 或 "" 表示使用浏览器默认
 */
export function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) {
      log("pickSupportedMimeType", m);
      return m;
    }
  }
  log("pickSupportedMimeType", "fallback default (no explicit type)");
  return "";
}

/**
 * @returns {Promise<{ stream: MediaStream, recorder: MediaRecorder, mimeType: string }>}
 */
export async function startMediaRecorderCapture() {
  log("requesting microphone permission");
  if (!window.isSecureContext) {
    const err = new Error("NotSecureContext");
    err.name = "NotSecureContext";
    throw err;
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    const err = new Error("getUserMedia not available");
    err.name = "NoMediaDevices";
    throw err;
  }
  if (typeof MediaRecorder === "undefined") {
    const err = new Error("MediaRecorder not supported");
    err.name = "NoMediaRecorder";
    throw err;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  log("microphone stream acquired", "label=", stream.getAudioTracks()[0]?.label || "(no label)");

  const mimeType = pickSupportedMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  log("mediaRecorder created", "mime=", recorder.mimeType || mimeType || "default", "state=", recorder.state);

  const chunks = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
      log("audio chunk received", "bytes=", ev.data.size, "total_chunks=", chunks.length);
    }
  };

  recorder.addEventListener("error", (ev) => {
    log("mediaRecorder error event", ev);
  });

  const startedMime = recorder.mimeType || mimeType || "audio/webm";
  recorder.start(120);
  log("mediaRecorder started", "state=", recorder.state);

  return { stream, recorder, chunks, mimeType: startedMime };
}

/**
 * 停止录音、释放麦克风轨道、返回 Blob
 * @returns {Promise<{ blob: Blob, sizeBytes: number, mimeType: string } | null>}
 */
export function stopMediaRecorderCapture(session) {
  if (!session || !session.recorder) {
    log("recorder stopped (no session)");
    return Promise.resolve(null);
  }
  const { recorder, chunks, stream } = session;
  return new Promise((resolve) => {
    if (recorder.state === "inactive") {
      log("recorder already inactive");
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      }
      resolve(null);
      return;
    }
    recorder.onstop = () => {
      const type = (recorder.mimeType || session.mimeType || "audio/webm").split(";")[0].trim();
      const blob = new Blob(chunks, { type: type || "audio/webm" });
      log("recorder stopped", "blob_bytes=", blob.size, "mime=", type);
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
        log("microphone tracks stopped");
      }
      resolve({
        blob,
        sizeBytes: blob.size,
        mimeType: type || "audio/webm",
      });
    };
    try {
      log("calling mediaRecorder.stop()");
      recorder.stop();
    } catch (e) {
      log("mediaRecorder.stop() threw", e && e.name, e && e.message, e);
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      }
      resolve(null);
    }
  });
}

export function abortMediaSession(session) {
  if (!session) return;
  try {
    if (session.recorder && session.recorder.state !== "inactive") {
      session.recorder.stop();
    }
  } catch (_) {}
  if (session.stream) {
    session.stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (_) {}
    });
  }
  log("abortMediaSession done");
}

/**
 * 从 Blob 估算时长（异步）
 */
export function getBlobAudioDurationMs(blob) {
  return new Promise((resolve) => {
    if (!blob || !blob.size) {
      resolve(0);
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = Number(audio.duration);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? Math.round(d * 1000) : 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}
