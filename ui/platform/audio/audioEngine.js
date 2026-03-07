/**
 * Lumina Audio Engine v2 — 统一音频能力层
 */
import { resolveAudio } from "./audioResolver.js";
import * as browserTTS from "./drivers/browserTTS.js";
import * as audioFile from "./drivers/audioFile.js";

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

export function playText(text, options = {}) {
  const res = resolveAudio({
    text,
    audioUrl: options.audioUrl,
  });

  if (res.engine === "audioFile") {
    audioFile.play(res.url);
    return;
  }

  browserTTS.speak(res.text, options);
}

export function stop() {
  browserTTS.stop();
  audioFile.stop();
}
