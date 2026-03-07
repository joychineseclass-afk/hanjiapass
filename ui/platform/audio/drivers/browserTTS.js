/**
 * Lumina Audio Engine v2 — 浏览器原生 TTS 驱动
 */
export function speak(text, options = {}) {
  const synth = window.speechSynthesis;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = options.lang || "zh-CN";
  utter.rate = options.rate ?? 0.95;

  utter.onstart = () => options.onStart?.();
  utter.onend = () => options.onEnd?.();
  utter.onerror = (e) => {
    options.onError?.(e);
    options.onEnd?.();
  };

  synth.cancel();

  setTimeout(() => {
    synth.speak(utter);
  }, 30);
}

export function stop() {
  window.speechSynthesis.cancel();
}
