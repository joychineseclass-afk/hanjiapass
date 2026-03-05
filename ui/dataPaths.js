// ui/dataPaths.js (robust + stroke-ready)
(function () {
  "use strict";

  const toStr = (x) => String(x ?? "").trim();

  /** 内部 version 仅允许 hsk2.0 / hsk3.0，禁止 hsk2/hsk3 短写 */
  function normalizeHskVersion(v) {
    const s = toStr(v).toLowerCase();
    if (!s) return "hsk2.0";
    if (s === "hsk2.0" || s === "hsk3.0") return s;
    if (s === "2.0" || s === "hsk2") return "hsk2.0";
    if (s === "3.0" || s === "hsk3") return "hsk3.0";
    const m = s.match(/(2\.0|3\.0)/);
    if (m) return `hsk${m[1]}`;
    return "hsk2.0";
  }

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
  /** opts.version 优先，否则 localStorage；version 仅允许 hsk2.0 / hsk3.0 */
  function vocabUrl(level, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    return withVersion(joinPath(BASE, `data/vocab/${ver}/hsk${lv}.json`));
  }

  function lessonsUrl(level, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    return withVersion(joinPath(BASE, `data/lessons/${ver}/hsk${lv}_lessons.json`));
  }

  /** 课程序列索引文件 hsk{N}.json（与 BASE 一致，子目录部署可用） */
  function lessonsIndexUrl(level, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    return withVersion(joinPath(BASE, `data/lessons/${ver}/hsk${lv}.json`));
  }

  /** 单课详情 URL，opts.file 可选；与 BASE 一致 */
  function lessonDetailUrl(level, lessonNo, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    const file = toStr(opts && opts.file);
    if (file) return withVersion(joinPath(BASE, `data/lessons/${ver}/${file}`));
    const no = (typeof lessonNo === "number" ? lessonNo : parseInt(lessonNo, 10)) || 1;
    return withVersion(joinPath(BASE, `data/lessons/${ver}/hsk${lv}_lesson${no}.json`));
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
    lessonsIndexUrl,
    lessonDetailUrl,
    strokeUrl,
    strokeFileNameForChar,
    setBase,
    getBase,
    setVersion,
    getVersion,
    normalizeHskVersion,
    debugChar,
  };
})();
