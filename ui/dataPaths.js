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

  /** 数据根路径：始终从站点根开始，禁止 /pages/data/ 等错误拼接
   * - 未设置 __APP_BASE__ 时：/data/...（本地/Vercel 根部署）
   * - 设置 __APP_BASE__ 时：/repo/data/...（GitHub Pages 子目录） */
  function getDataRoot() {
    const base = toStr(window.__APP_BASE__ || "").replace(/\/+$/, "");
    return base ? base + "/" : "/";
  }

  let VERSION = "";        // ✅ 可选 cache bust：?v=xxxx

  function withVersion(url) {
    if (!VERSION) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(VERSION)}`;
  }

  const DEBUG = !!(typeof location !== "undefined" && location.hostname && (location.hostname === "localhost" || location.hostname === "127.0.0.1"));

  // ===== URL builders（统一以 / 开头，从站点根）=====
  /** opts.version 优先，否则 localStorage；version 仅允许 hsk2.0 / hsk3.0
   * HSK 3.0 的 7~9 级共用 hsk7-9.json */
  function vocabUrl(level, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    const file = (ver === "hsk3.0" && ["7", "8", "9"].includes(lv)) ? "hsk7-9.json" : `hsk${lv}.json`;
    const url = withVersion(getDataRoot() + `data/vocab/${ver}/${file}`);
    if (DEBUG) console.log("[PATH] vocabUrl", url);
    return url;
  }

  function lessonsUrl(level, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    const url = withVersion(getDataRoot() + `data/lessons/${ver}/hsk${lv}_lessons.json`);
    if (DEBUG) console.log("[PATH] lessonsUrl", url);
    return url;
  }

  /** 课程序列索引文件 hsk{N}.json */
  function lessonsIndexUrl(level, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    const url = withVersion(getDataRoot() + `data/lessons/${ver}/hsk${lv}.json`);
    if (DEBUG) console.log("[PATH] lessonsIndexUrl", url);
    return url;
  }

  /** 单课详情 URL，opts.file 可选 */
  function lessonDetailUrl(level, lessonNo, opts) {
    const lv = normalizeLevel(level);
    const raw = (opts && opts.version != null ? opts.version : null) ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0";
    const ver = normalizeHskVersion(raw);
    const file = toStr(opts && opts.file);
    const path = file ? `data/lessons/${ver}/${file}` : `data/lessons/${ver}/hsk${lv}_lesson${(typeof lessonNo === "number" ? lessonNo : parseInt(lessonNo, 10)) || 1}.json`;
    const url = withVersion(getDataRoot() + path);
    if (DEBUG) console.log("[PATH] lessonDetailUrl", url);
    return url;
  }

  // make-me-a-hanzi：文件名 = Unicode 十进制 code point（好=22909）
  function strokeUrl(ch) {
    const cp = codePoint(ch);
    if (!cp) return null;
    const url = withVersion(getDataRoot() + `data/strokes/${cp}.svg`);
    if (DEBUG) console.log("[PATH] strokeUrl", url);
    return url;
  }

  function strokeFileNameForChar(ch) {
    const cp = codePoint(ch);
    if (!cp) return "";
    return `${cp}.svg`;
  }

  // ===== helpers =====
  function setBase(newBase) {
    window.__APP_BASE__ = toStr(newBase) ? toStr(newBase).replace(/\/+$/, "") : "";
  }

  function getBase() {
    return toStr(window.__APP_BASE__ || "").replace(/\/+$/, "");
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
      dataRoot: getDataRoot(),
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
