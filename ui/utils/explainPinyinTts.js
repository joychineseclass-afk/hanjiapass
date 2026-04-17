/**
 * 多行「汉字 + 拼音 + 韩语说明」展示时，朗读链中去掉仅含拉丁拼音的行，
 * 避免韩语/英语 TTS 误读 jīntiān 等片段。
 */

const PINYIN_LINE_RE = /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜńḿ\u0300-\u036f\s·\-—_,.?!…:;'"0-9]+$/u;

export function stripStandalonePinyinLinesForTts(text) {
  if (text == null) return "";
  const lines = String(text).split("\n");
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/[\u4e00-\u9fff]/.test(t) || /[\uac00-\ud7af]/.test(t)) {
      out.push(line);
      continue;
    }
    if (PINYIN_LINE_RE.test(t)) continue;
    out.push(line);
  }
  return out.join("\n");
}
