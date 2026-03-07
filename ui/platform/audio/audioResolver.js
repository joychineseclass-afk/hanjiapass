/**
 * Lumina Audio Engine v2 — 音频来源解析
 */
export function resolveAudio({ text, audioUrl }) {
  if (audioUrl) {
    return {
      engine: "audioFile",
      url: audioUrl,
    };
  }

  return {
    engine: "browserTTS",
    text,
  };
}
