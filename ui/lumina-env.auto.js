/* 本地/未跑 build 时占位；Vercel 上由 `npm run build` 覆写。勿在此文件提交真实密钥。 */
(function () {
  if (typeof globalThis === "undefined") return;
  if (!globalThis.__LUMINA_ENV__) {
    globalThis.__LUMINA_ENV__ = {};
  }
})();
