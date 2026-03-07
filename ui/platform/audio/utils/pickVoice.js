/**
 * Lumina Audio Engine v2 — 选择语音
 */
export function pickChineseVoice(voices = []) {
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh-cn")) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh")) ||
    voices.find((v) => /chinese|mandarin|中文|普通话/i.test(v.name || "")) ||
    null
  );
}
