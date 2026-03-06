/**
 * 浏览器端拼音生成：缺失时用 pinyin-pro（CDN）补齐
 * HSK1-6 强制显示拼音；HSK7-9 预留扩展
 */
let _pinyinFn = null;

export async function ensurePinyin(hanzi, existing = "") {
  const h = String(hanzi ?? "").trim();
  const ex = String(existing ?? "").trim();
  if (ex) return ex;
  if (!h) return "";
  if (!_pinyinFn) {
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/pinyin-pro@3.21.0/dist/index.esm.js");
      _pinyinFn = mod.pinyin;
    } catch (e) {
      console.warn("[pinyinBrowser] load failed:", e);
      return "";
    }
  }
  try {
    return String(_pinyinFn(h, { toneType: "symbol", v: true }) ?? "").trim();
  } catch (e) {
    return "";
  }
}
