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
const err = (msg, e) => {
  if (typeof console !== "undefined" && console.error) console.error(msg, e);
};

function isBrowser() {
  return typeof window !== "undefined";
}

function getSpeechSynthesisSafe() {
  if (!isBrowser()) return null;
  if ("speechSynthesis" in window && window.speechSynthesis) {
    return window.speechSynthesis;
  }
  return null;
}

function isSpeechSupported() {
  return !!getSpeechSynthesisSafe() && typeof window.SpeechSynthesisUtterance !== "undefined";
}

function stopSpeak() {
  const synth = getSpeechSynthesisSafe();
  if (!synth) return;
  try {
    synth.cancel();
  } catch (e) {
    warn("[TTS] stopSpeak failed: " + (e?.message || e));
  }
}

/** 安全获取 voices，若为空则等待 voiceschanged */
async function getVoicesSafe() {
  const synth = getSpeechSynthesisSafe();
  if (!synth) return [];

  let voices = synth.getVoices();
  if (voices && voices.length) return voices;

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);
    synth.onvoiceschanged = () => {
      clearTimeout(timer);
      resolve();
    };
  });

  return synth.getVoices() || [];
}

/** 按优先级选择中文 voice */
function pickChineseVoice(voices = []) {
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh-cn")) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh")) ||
    voices.find((v) => /chinese|mandarin|中文|普通话/i.test(v.name || "")) ||
    null
  );
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

  const synth = getSpeechSynthesisSafe();

  if (!isSpeechSupported()) {
    warn("[TTS] speechSynthesis not supported");
    options.onError?.(new Error("speechSynthesis not supported"));
    return false;
  }

  log("[TTS] speakText:", t);
  log("[TTS] supported:", isSpeechSupported());
  log("[TTS] synth exists:", !!synth);
  log("[TTS] utter exists:", typeof window.SpeechSynthesisUtterance !== "undefined");

  try {
    const voices = await getVoicesSafe();
    log("[TTS] voices count:", voices.length);

    const voice = pickChineseVoice(voices);
    if (voice) {
      log("[TTS] picked voice:", voice.name, voice.lang);
    } else {
      warn("[TTS] no chinese voice found, fallback to lang only");
    }

    const utter = new SpeechSynthesisUtterance(t);
    utter.lang = options?.lang || "zh-CN";
    utter.rate = options?.rate ?? 0.95;
    utter.pitch = options?.pitch ?? 1;
    utter.volume = options?.volume ?? 1;
    if (voice) utter.voice = voice;

    utter.onstart = () => {
      log("[TTS] onstart");
      options.onStart?.();
    };
    utter.onend = () => {
      log("[TTS] onend");
      options.onEnd?.();
    };
    utter.onerror = (e) => {
      err("[TTS] onerror", e);
      options.onError?.(e);
      options.onEnd?.();
    };

    synth.cancel();
    setTimeout(() => {
      try {
        synth.speak(utter);
      } catch (errThrown) {
        warn("[TTS] speak() threw: " + (errThrown?.message || errThrown));
        options.onError?.(errThrown);
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
 * 诊断 TTS 状态
 */
async function debugTTS() {
  const synth = getSpeechSynthesisSafe();
  const supported = isSpeechSupported();
  const voices = supported ? await getVoicesSafe() : [];
  const chineseVoice = pickChineseVoice(voices);

  const result = {
    supported,
    hasWindow: typeof window !== "undefined",
    hasSpeechSynthesis: !!synth,
    hasUtterance: typeof window !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined",
    voicesCount: voices.length,
    chineseVoice: chineseVoice ? { name: chineseVoice.name, lang: chineseVoice.lang } : null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  log("[TTS] debugTTS()", result);
  return result;
}

export { speakText, stopSpeak, isSpeechSupported, debugTTS };
