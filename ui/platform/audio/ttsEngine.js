/**
 * TTS Engine v1 — 浏览器原生 speechSynthesis
 * 统一入口：speakText / stopSpeak / isSpeechSupported / debugTTS
 */

const log = (msg) => {
  if (typeof console !== "undefined" && console.log) console.log(msg);
};
const warn = (msg) => {
  if (typeof console !== "undefined" && console.warn) console.warn(msg);
};

function isSpeechSupported() {
  if (typeof window === "undefined") return false;
  try {
    return !!window.speechSynthesis;
  } catch {
    return false;
  }
}

function stopSpeak() {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    warn("[TTS] stopSpeak failed: " + (e?.message || e));
  }
}

/** 安全获取 voices，若为空则等待一次 voiceschanged */
function getVoicesSafe() {
  if (!isSpeechSupported()) return [];
  let voices = window.speechSynthesis.getVoices() || [];
  if (voices.length > 0) return voices;
  return new Promise((resolve) => {
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // 某些浏览器可能不再派发，短时后再取一次
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(window.speechSynthesis.getVoices() || []);
    }, 500);
  });
}

/** 按优先级选择中文 voice */
function pickChineseVoice(voices) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const byLangZhCN = voices.find((v) => /^zh-CN/i.test(v.lang));
  if (byLangZhCN) return byLangZhCN;
  const byLangZh = voices.find((v) => /^zh/i.test(v.lang));
  if (byLangZh) return byLangZh;
  const byName = voices.find((v) =>
    /Chinese|Mandarin|中文|普通话/i.test(v.name || "")
  );
  if (byName) return byName;
  return null;
}

function stopSpeakSync() {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (_) {}
}

/**
 * @param {string} text - 要朗读的文本
 * @param {object} [options]
 * @param {string} [options.lang="zh-CN"]
 * @param {number} [options.rate=0.95]
 * @param {number} [options.pitch=1]
 * @param {number} [options.volume=1]
 * @param {()=>void} [options.onStart]
 * @param {()=>void} [options.onEnd]
 * @param {(err:unknown)=>void} [options.onError]
 */
async function speakText(text, options = {}) {
  const t = String(text ?? "").trim();
  if (!t) return;

  if (!isSpeechSupported()) {
    warn("[TTS] speechSynthesis not supported");
    options.onError?.(new Error("speechSynthesis not supported"));
    return;
  }

  try {
    stopSpeakSync();

    const voices = await getVoicesSafe();
    const voicesArr = Array.isArray(voices) ? voices : [];
    const zhVoice = pickChineseVoice(voicesArr);

    log("[TTS] speakText: " + t);
    log("[TTS] voices count: " + voicesArr.length);
    if (zhVoice) {
      log("[TTS] picked voice: " + (zhVoice.name || "—") + " / " + (zhVoice.lang || "zh-CN"));
    } else {
      warn("[TTS] no chinese voice found");
    }

    const u = new SpeechSynthesisUtterance(t);
    u.lang = options.lang ?? "zh-CN";
    u.rate = typeof options.rate === "number" ? options.rate : 0.95;
    u.pitch = typeof options.pitch === "number" ? options.pitch : 1;
    u.volume = typeof options.volume === "number" ? options.volume : 1;
    if (zhVoice) u.voice = zhVoice;

    u.onstart = () => {
      log("[TTS] onstart");
      options.onStart?.();
    };
    u.onend = () => {
      log("[TTS] onend");
      options.onEnd?.();
    };
    u.onerror = (e) => {
      warn("[TTS] onerror " + (e?.error || e?.message || e));
      options.onError?.(e);
      options.onEnd?.();
    };

    // cancel 后延迟再 speak，避免部分浏览器 cancel 后立即 speak 不发声
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(u);
      } catch (err) {
        warn("[TTS] speak() threw: " + (err?.message || err));
        options.onError?.(err);
        options.onEnd?.();
      }
    }, 30);
  } catch (e) {
    warn("[TTS] speakText failed: " + (e?.message || e));
    options.onError?.(e);
    options.onEnd?.();
  }
}

/**
 * 诊断 TTS 状态，打印到 console 并返回结果
 */
async function debugTTS() {
  const supported = isSpeechSupported();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let voicesCount = 0;
  let chineseVoice = null;

  if (supported) {
    const voices = await getVoicesSafe();
    const arr = Array.isArray(voices) ? voices : [];
    voicesCount = arr.length;
    const v = pickChineseVoice(arr);
    if (v) chineseVoice = { name: v.name || "", lang: v.lang || "" };
  }

  const result = { supported, voicesCount, chineseVoice, userAgent };
  log("[TTS] debugTTS: " + JSON.stringify(result, null, 2));
  if (!supported) warn("[TTS] speechSynthesis not supported");
  if (supported && !chineseVoice) warn("[TTS] no chinese voice found");
  return result;
}

export { speakText, stopSpeak, isSpeechSupported, debugTTS };
