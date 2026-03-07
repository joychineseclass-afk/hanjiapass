/**
 * 拼音生成/修复：优先使用已有；缺失时用 pinyin-pro 补
 */
import { pinyin } from "pinyin-pro";

export function ensurePinyin(hanzi, existing = "") {
  const h = String(hanzi ?? "").trim();
  const ex = String(existing ?? "").trim();
  if (ex) return ex;
  if (!h) return "";

  try {
    const py = pinyin(h, { toneType: "symbol", v: true });
    return String(py ?? "").trim();
  } catch (e) {
    return "";
  }
}npm run build:pinyin
