// ui/dataPaths.js
// 简化安全版，不使用 IIFE，避免 CSP 拦截

window.DATA_PATHS = {
  strokeUrl: function (ch) {
    if (!ch) return "";
    var cp = ch.codePointAt(0);
    if (!cp) return "";
    return "./data/strokes/" + cp + ".svg";
  },

  strokeFileNameForChar: function (ch) {
    if (!ch) return "";
    var cp = ch.codePointAt(0);
    if (!cp) return "";
    return cp + ".svg";
  }
};
