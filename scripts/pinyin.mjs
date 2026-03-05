import { pinyin } from "pinyin-pro";

/**
 * 确保拼音字段：优先使用已有 existing；缺失时用 pinyin-pro 补齐
 */
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
}
