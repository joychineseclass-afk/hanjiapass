// ui/dataPaths.js
// ✅ 目的：统一管理数据路径（尤其是笔顺 svg）
// 你的目录结构：/data/strokes/23458.svg  （文件名 = Unicode 十进制）
//
// 使用：
//   DATA_PATHS.strokeUrl("客")  -> "./data/strokes/23458.svg"
//   DATA_PATHS.strokeFileNameForChar("客") -> "23458.svg"
//
// 注意：这个文件只做“路径映射”，不改你现有逻辑，属于增强版。

(function () {
  "use strict";

  // ---- 配置区：你只需要保证这两个目录正确 ----
  const ROOT = ".";                 // GitHub Pages 下同级路径用 "."
  const STROKES_DIR = "data/strokes";

  // ---- 工具函数 ----
  function isHanChar(ch) {
    return typeof ch === "string" && ch.length > 0;
  }

  // 返回 Unicode code point（支持 emoji/扩展汉字）
  function codePoint(ch) {
    try {
      return ch.codePointAt(0);
    } catch {
      return null;
    }
  }

  // 十进制文件名（你现在的 strokes 文件就是这个）
  function toDecFileName(ch) {
    const cp = codePoint(ch);
    if (cp == null) return "";
    return String(cp); // e.g. 客 U+5BA2 => 23458
  }

  // 可选：如果未来你想支持 u5BA2.svg / U5BA2.svg 等，也预留
  function toHexFileName(ch) {
    const cp = codePoint(ch);
    if (cp == null) return "";
    return "u" + cp.toString(16).toUpperCase(); // u5BA2
  }

  function joinPath(a, b) {
    if (!a) return b || "";
    if (!b) return a || "";
    return a.replace(/\/+$/, "") + "/" + b.replace(/^\/+/, "");
  }

  // ---- 主要 API ----
  function strokeFileNameForChar(ch) {
    if (!isHanChar(ch)) return "";
    const dec = toDecFileName(ch);
    if (!dec) return "";
    return `${dec}.svg`;
  }

  function strokeUrl(ch) {
    // ✅ 返回相对路径，和你 fetch(url) 逻辑兼容
    const fn = strokeFileNameForChar(ch);
    if (!fn) return "";

    // "./data/strokes/23458.svg"
    return joinPath(joinPath(ROOT, STROKES_DIR), fn);
  }

  // ---- 调试辅助：可在 Console 里直接用 ----
  function debugChar(ch) {
    const cp = codePoint(ch);
    return {
      char: ch,
      codePoint: cp,
      hex: cp != null ? "U+" + cp.toString(16).toUpperCase() : null,
      dec: cp != null ? String(cp) : null,
      file: strokeFileNameForChar(ch),
      url: strokeUrl(ch),
      altHexName: cp != null ? `${toHexFileName(ch)}.svg` : null,
    };
  }

  // ---- 暴露到全局 ----
  window.DATA_PATHS = {
    // 笔顺
    strokeUrl,
    strokeFileNameForChar,

    // 工具（可选）
    debugChar,
  };

  // ✅ 可选：启动时打印一次，方便确认加载成功（不想要就注释掉）
  // console.log("[DATA_PATHS] ready:", window.DATA_PATHS);
})();
