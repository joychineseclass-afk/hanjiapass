// ui/dataPaths.js
(function () {
  // ====== base path: 支持 github.io 子路径 /repo/ ======
  function getBasePath() {
    const baseTag = document.querySelector("base");
    if (baseTag && baseTag.getAttribute("href")) return baseTag.getAttribute("href");

    const p = location.pathname || "/";
    const seg = p.split("/").filter(Boolean)[0]; // repo name
    if (location.host.endsWith("github.io") && seg) return `/${seg}/`;
    return "./";
  }
  const BASE = getBasePath();

  // ====== helpers ======
  function join(...parts) {
    return parts
      .join("/")
      .replace(/\/{2,}/g, "/")
      .replace(":/", "://");
  }

  // 客 U+5BA2 -> 23458.svg
  function strokeFileNameForChar(ch) {
    if (!ch) return "";
    const cp = ch.codePointAt(0);
    return cp ? `${cp}.svg` : "";
  }

  // ====== HSK data paths (你项目里 data/ 结构) ======
  // 你现在目录是：data/vocab/ 、data/lessons/ 、data/strokes/
  function vocabUrl(level) {
    // 你若文件名不是这样，告诉我你真实文件名，我再改
    // 常见：hsk1.json / level1.json / vocab_hsk1.json
    return join(BASE, "data/vocab", `hsk${level}.json`);
  }

  function lessonUrl(level) {
    // 同理：常见 lessons/hsk1.json
    return join(BASE, "data/lessons", `hsk${level}.json`);
  }

  // ====== stroke paths ======
  function strokeUrl(ch) {
    const fn = strokeFileNameForChar(ch);
    if (!fn) return "";
    return join(BASE, "data/strokes", fn);
  }

  // ====== debug ======
  function debugChar(ch) {
    return {
      ch,
      base: BASE,
      strokeFile: strokeFileNameForChar(ch),
      strokeUrl: strokeUrl(ch),
    };
  }

  function debugLevel(level) {
    return {
      level,
      base: BASE,
      vocabUrl: vocabUrl(level),
      lessonUrl: lessonUrl(level),
    };
  }

  window.DATA_PATHS = {
    BASE,
    // HSK
    vocabUrl,
    lessonUrl,
    // Stroke
    strokeUrl,
    strokeFileNameForChar,
    // Debug
    debugChar,
    debugLevel,
  };

  console.log("[DATA_PATHS] ready:", window.DATA_PATHS);
})();
