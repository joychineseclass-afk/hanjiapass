// ui/dataPaths.js
(function () {
  // GitHub Pages 子路径兼容（如果你不是放在根域名，而是 /hanjapass/ 这种）
  // 一般保持 "" 就行；如果你的 Pages 地址是 https://xxx.github.io/hanjapass/
  // 那么 BASE 写成 "/hanjapass" 更稳。
  const BASE = "";

  // 词库 JSON（按 level）
  function vocabUrl(level) {
    return `${BASE}/data/vocab/hsk${level}_vocab.json`;
  }

  // 课程 JSON（按 level）——✅ 你报错的就是缺这个
  function lessonsUrl(level) {
    return `${BASE}/data/lessons/hsk${level}_lessons.json`;
  }

  // 单字笔顺 SVG（makemeahanzi：按 Unicode codepoint）
  function strokeFileNameForChar(ch) {
    const code = ch.codePointAt(0);
    return `${code}.svg`;
  }

  function strokeUrl(ch) {
    return `${BASE}/data/strokes/${strokeFileNameForChar(ch)}`;
  }

  // 暴露给 window
  window.DATA_PATHS = {
    BASE,
    vocabUrl,
    lessonsUrl,
    strokeUrl,
    strokeFileNameForChar,
  };
})();
