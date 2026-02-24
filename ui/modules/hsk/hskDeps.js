// /ui/modules/hsk/hskDeps.js
let depsPromise = null;

export async function ensureHSKDeps() {
  if (window.HSK_LOADER?.loadVocab && window.HSK_HISTORY) return;
  if (depsPromise) return depsPromise;

  depsPromise = (async () => {
    const loadScriptOnce = (src) =>
      new Promise((resolve, reject) => {
        const already = [...document.scripts].some((s) =>
          (s.src || "").endsWith(src)
        );
        if (already) return resolve();

        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(s);
      });

    // ✅ Loader：classic script（无 export）
    await loadScriptOnce("/ui/modules/hsk/hskLoader.js");

    // ✅ History：你现在用的是 ESM import（保留）
    await import("./hskHistory.js");
  })();

  return depsPromise;
}
