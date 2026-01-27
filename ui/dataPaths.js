// ui/dataPaths.js
(function () {
  const BASE = "."; // GitHub Pages/本地都用相对路径最稳

  function codePoint(ch) {
    return ch.codePointAt(0);
  }

  window.DATA_PATHS = {
    // 单词库
    vocabUrl(level) {
      return `${BASE}/data/vocab/hsk${level}_vocab.json`;
    },

    // 课程库（10课制）
    lessonsUrl(level) {
      return `${BASE}/data/lessons/hsk${level}_lessons.json`;
    },

    // 笔顺 SVG（makemeahanzi：文件名是 unicode 十进制）
    strokeUrl(ch) {
      return `${BASE}/data/strokes/${codePoint(ch)}.svg`;
    },

    strokeFileNameForChar(ch) {
      return `${codePoint(ch)}.svg`;
    },
  };
})();
