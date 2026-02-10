// ui/dataPaths.js (robust + stroke-ready)
(function () {
  "use strict";

  const toStr = (x) => String(x ?? "").trim();

  // 兼容：1 / "1" / "hsk1" / "HSK 1"
  function normalizeLevel(level) {
    const s = toStr(level).toLowerCase();
    const m = s.match(/(\d+)/);
    return m ? m[1] : "1";
  }

  // 取第一个字符（防止传入 "客人" 这种字符串）
  function firstChar(s) {
    const t = toStr(s);
    return t ? [...t][0] : "";
  }

  function codePoint(ch) {
    const c = firstChar(ch);
    return c ? c.codePointAt(0) : 0;
  }

  function joinPath(base, path) {
    const b = toStr(base);
    const p = toStr(path);
    if (!b) return p || ".";
    if (!p) return b;

    const bb = b.endsWith("/") ? b.slice(0, -1) : b;
    const pp = p.startsWith("/") ? p.slice(1) : p;
    return `${bb}/${pp}`;
  }

  // 1) window.__APP_BASE__（你未来手动指定时用）
  // 2) <base href="...">
  // 3) 用 location.pathname 推断（最适配 GitHub Pages 子目录）
  function detectBase() {
    const forced = toStr(window.__APP_BASE__);
    if (forced) return forced.replace(/\/+$/, "");

    const baseEl = document.querySelector("base[href]");
    if (baseEl) {
      const href = toStr(baseEl.getAttribute("href"));
      if (href) return href.replace(/\/+$/, "");
    }

    const path = toStr(location.pathname || "/");
    const isFile = /\.[a-z0-9]+$/i.test(path); // /xxx/index.html
    const dir = isFile ? path.replace(/\/[^/]*$/, "") : path.replace(/\/+$/, "");

    // 可能是 ""（根目录），统一成 "."
    return dir ? dir : ".";
  }

  let BASE = detectBase(); // ✅ 运行时可被 setBase 覆盖
  let VERSION = "";        // ✅ 可选 cache bust：?v=xxxx

  function withVersion(url) {
    if (!VERSION) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(VERSION)}`;
  }

  // ===== URL builders =====
  function vocabUrl(level) {
  const lv = normalizeLevel(level);
  const ver = localStorage.getItem("hsk_vocab_version") || "hsk2.0";
  return withVersion(joinPath(BASE, `data/vocab/${ver}/hsk${lv}.json`));
}

  function lessonsUrl(level) {
  const lv = normalizeLevel(level);
  const ver = localStorage.getItem("hsk_vocab_version") || "hsk2.0";
  return withVersion(joinPath(BASE, `data/lessons/${ver}/hsk${lv}_lessons.json`));
}

  // make-me-a-hanzi：文件名 = Unicode 十进制 code point（比如 客=23458）
  function strokeUrl(ch) {
    const cp = codePoint(ch);
    if (!cp) return "";
    return withVersion(joinPath(BASE, `data/strokes/${cp}.svg`));
  }

  function strokeFileNameForChar(ch) {
    const cp = codePoint(ch);
    if (!cp) return "";
    return `${cp}.svg`;
  }

  // ===== helpers =====
  function setBase(newBase) {
    BASE = toStr(newBase) || ".";
  }

  function getBase() {
    return BASE;
  }

  function setVersion(v) {
    VERSION = toStr(v);
  }

  function getVersion() {
    return VERSION;
  }

  // ===== debug helper（你可以在 Console 里用）=====
  function debugChar(ch) {
    const c = firstChar(ch);
    const cp = codePoint(c);
    return {
      base: BASE,
      version: VERSION,
      char: c,
      codePoint: cp,
      strokeFile: strokeFileNameForChar(c),
      strokeUrl: strokeUrl(c),
    };
  }

  // ✅ export
  window.DATA_PATHS = {
    vocabUrl,
    lessonsUrl,
    strokeUrl,
    strokeFileNameForChar,
    setBase,
    getBase,
    setVersion,
    getVersion,
    debugChar,
  };
})();
