/**
 * TTS 朗读：浏览器 SpeechSynthesis，中文 zh-CN
 */
export async function speakChinese(text, opts = {}) {
  const t = String(text ?? "").trim();
  if (!t) return;

  if (!("speechSynthesis" in window)) {
    if (typeof alert === "function") alert("TTS not supported");
    return;
  }

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(t);
  u.lang = opts.lang || "zh-CN";
  u.rate = typeof opts.rate === "number" ? opts.rate : 0.9;
  u.pitch = typeof opts.pitch === "number" ? opts.pitch : 1;

  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find((v) => /zh|cmn|Chinese/i.test(v.lang) || /zh|Chinese/i.test(v.name));
  };
  u.voice = pickVoice() || null;

  return new Promise((resolve) => {
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });
}
