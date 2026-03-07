/**
 * TTS Engine v1 — 浏览器原生 speechSynthesis
 * 统一入口：speakText / stopSpeak / isSpeechSupported
 */

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
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[TTS] stopSpeak failed:", e);
    }
  }
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
function speakText(text, options = {}) {
  const t = String(text ?? "").trim();
  if (!t) return;

  if (!isSpeechSupported()) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[TTS] speechSynthesis not supported");
    }
    options.onError?.(new Error("speechSynthesis not supported"));
    return;
  }

  try {
    stopSpeak();

    const u = new SpeechSynthesisUtterance(t);
    u.lang = options.lang ?? "zh-CN";
    u.rate = typeof options.rate === "number" ? options.rate : 0.95;
    u.pitch = typeof options.pitch === "number" ? options.pitch : 1;
    u.volume = typeof options.volume === "number" ? options.volume : 1;

    const voices = window.speechSynthesis.getVoices() || [];
    const zhVoice = voices.find((v) => /zh|cmn|Chinese/i.test(v.lang) || /zh|Chinese/i.test(v.name));
    if (zhVoice) u.voice = zhVoice;

    u.onstart = () => options.onStart?.();
    u.onend = () => options.onEnd?.();
    u.onerror = (e) => {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[TTS] speak error:", e);
      }
      options.onError?.(e);
      options.onEnd?.();
    };

    window.speechSynthesis.speak(u);
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[TTS] speakText failed:", e);
    }
    options.onError?.(e);
    options.onEnd?.();
  }
}

export { speakText, stopSpeak, isSpeechSupported };
