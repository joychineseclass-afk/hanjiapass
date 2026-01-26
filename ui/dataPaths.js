/* ui/dataPaths.js */

// API endpoint
window.APP_CONFIG = {
  API_URL: "https://hanjiapass.vercel.app/api/gemini",

  // data base (absolute URL)
  DATA_BASE: (() => {
    try {
      const u = new URL("./data/", window.location.href);
      return u.href.replace(/\/$/, "");
    } catch {
      return "./data";
    }
  })(),

  // ✅ HSK vocab url mapping
  HSK_VOCAB_URL: (lv) => {
    const level = String(lv);
    return `${window.APP_CONFIG.DATA_BASE}/vocab/hsk${level}_vocab.json`;
  }
};
