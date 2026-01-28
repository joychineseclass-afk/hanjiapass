// ui/dataPaths.js (ultimate, robust, low rework)
(function () {
  function safeText(x) {
    return String(x ?? "").trim();
  }

  // 兼容：level 可能传 1 / "1" / "hsk1" / "HSK 1"
  function normalizeLevel(level) {
    const s = safeText(level).toLowerCase();
    const m = s.match(/(\d+)/);
    return m ? m[1] : "1";
  }

  function codePoint(ch) {
    return String(ch ?? "").codePointAt(0);
  }

  function joinPath(base, path) {
    const b = safeText(base);
    const p = safeText(path);
    if (!b) return p || ".";
    if (!p) return b;

    const bb = b.endsWith("/") ? b.slice(0, -1) : b;
    const pp = p.startsWith("/") ? p.slice(1) : p;
    return `${bb}/${pp}`;
  }

  // 1) window.__APP_BASE__（你未来要手动指定时用）
  // 2) <base href="...">
  // 3) 当前页面路径推断（适配 GitHub Pages 子目录）
  function detectBase() {
    const forced = safeText(window.__APP_BASE__);
    if (forced) return forced;

    const baseEl = document.querySelector("base[href]");
    if (baseEl) {
      const href = safeText(baseEl.getAttribute("href"));
      // base href 可能是绝对 URL，也可能是 /repo/
      if (href) return href.replace(/\/+$/, "");
    }

    // 推断：用 pathname 的目录作为 base
    // 例：/myrepo/index.html -> /myrepo
    // 例：/myrepo/sub/index.html -> /myrepo/sub
    const path = safeText(location.pathname || "/");
    const isFile = /\.[a-z0-9]+$/i.test(path);
    const dir = isFile ? path.replace(/\/[^/]*$/, "") : path.replace(/\/+$/, "");
    // dir 可能是 ""（根目录），这里统一成 "."
    return dir ? dir : ".";
  }

  // ✅ 可选版本号（你现在不加也完全没影响）
  // 未来如果你想 cache-busting：DATA_PATHS.setVersion("20260128")
  let BASE = detectBase();
  let VERSION = ""; // "" 表示不追加

  function withVersion(url) {
    if (!VERSION) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(VERSION)}`;
  }

  function vocabUrl(level) {
    const lv = normalizeLevel(level);
    return withVersion(joinPath(BASE, `data/vocab/hsk${lv}_vocab.json`));
  }

  function lessonsUrl(level) {
    const lv = normalizeLevel(level);
    return withVersion(joinPath(BASE, `data/lessons/hsk${lv}_lessons.json`));
  }

  // makemeahanzi：文件名是 unicode 十进制
  function strokeUrl(ch) {
    const s = safeText(ch);
    // 只取第一个字符，避免传入字符串导致文件名错误
    const first = s ? [...s][0] : "";
    if (!first) return "";
    const cp = codePoint(first);
    if (!cp) return "";
    return withVersion(joinPath(BASE, `data/strokes/${cp}.svg`));
  }

  function strokeFileNameForChar(ch) {
    const s = safeText(ch);
    const first = s ? [...s][0] : "";
    if (!first) return "";
    const cp = codePoint(first);
    if (!cp) return "";
    return `${cp}.svg`;
  }

  // ✅ 对外暴露：以后你想把站点放到别的子目录、或加版本号，不用改其它文件
  function setBase(newBase) {
    BASE = safeText(newBase) || ".";
  }

  function getBase() {
    return BASE;
  }

  function setVersion(v) {
    VERSION = safeText(v);
  }

  function getVersion() {
    return VERSION;
  }

  window.DATA_PATHS = {
    vocabUrl,
    lessonsUrl,
    strokeUrl,
    strokeFileNameForChar,
    // 可选扩展（现在不用也不影响）
    setBase,
    getBase,
    setVersion,
    getVersion,
  };
})();
