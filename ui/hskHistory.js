// ui/hskHistory.js
(function () {
  const KEY = "HSK_RECENT_V1";
  const LIMIT = 60;

  function now() {
    return Date.now();
  }

  function safeWordKey(item) {
    // 用 word 作为主键，避免重复
    return String(item?.word || "").trim();
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function save(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch {}
  }

  function add(item) {
    const key = safeWordKey(item);
    if (!key) return;

    const list = load();

    // 去重：同一个 word 保留最新一次
    const filtered = list.filter((x) => x?.word !== key);

    filtered.unshift({
      word: key,
      pinyin: item?.pinyin || "",
      meaning: item?.meaning || "",
      example: item?.example || "",
      ts: now(),
      // 可选：你以后想记录 level/lesson，也能在这里追加字段
      // level: item?.level,
      // lessonId: item?.lessonId,
    });

    save(filtered.slice(0, LIMIT));
  }

  function clear() {
    save([]);
  }

  function list() {
    return load();
  }

  window.HSK_HISTORY = { add, list, clear, KEY };
})();
