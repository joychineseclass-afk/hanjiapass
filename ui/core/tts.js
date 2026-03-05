/**
 * TTS 朗读：优先浏览器 SpeechSynthesis，中文 zh-CN
 */
export function speakChinese(text, opts = {}) {
  const t = String(text ?? "").trim();
  if (!t) return false;

  if (typeof window === "undefined" || !window.speechSynthesis) {
    if (opts.onError) opts.onError(new Error("TTS not supported"));
    else if (typeof alert === "function") alert("TTS not supported");
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(t);
    u.lang = "zh-CN";
    u.rate = opts.rate ?? 0.9;
    if (opts.onStart) u.onstart = opts.onStart;
    if (opts.onEnd) u.onend = opts.onEnd;
    if (opts.onError) u.onerror = (e) => opts.onError(e);
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) {
    if (opts.onError) opts.onError(e);
    else if (typeof alert === "function") alert("TTS error: " + (e?.message || "unknown"));
    return false;
  }
}
