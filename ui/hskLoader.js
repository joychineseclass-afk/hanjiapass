// ui/hskLoader.js
(function () {
  const isArray = Array.isArray;

  function normalizeItem(raw) {
    const word =
      raw.word || raw.hanzi || raw.zh || raw.chinese || raw.text || raw.term || "";
    const pinyin = raw.pinyin || raw.py || raw.pron || "";
    // ✅ 韩语优先：meaning -> ko/kr -> en/def
    const meaning =
      raw.meaning || raw.ko || raw.kr || raw.translation || raw.en || raw.def || "";
    const example = raw.example || raw.sentence || raw.eg || "";

    return { raw, word, pinyin, meaning, example };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
    return await res.json();
  }

  async function loadVocab(level) {
    const url = window.DATA_PATHS?.vocabUrl(level);
    if (!url) throw new Error("DATA_PATHS.vocabUrl 이(가) 없습니다.");

    const data = await fetchJson(url);
    const arr = isArray(data) ? data : (data.items || data.data || []);
    return arr.map(normalizeItem).filter((x) => x.word);
  }

  // lessons.json 可能不存在：不存在就返回 null（让页面回到“全部单词卡模式”）
  async function loadLessons(level) {
    const url = window.DATA_PATHS?.lessonsUrl(level);
    if (!url) return null;

    try {
      const data = await fetchJson(url);
      const lessons = isArray(data) ? data : (data.lessons || data.data || []);
      return lessons;
    } catch (e) {
      // 404/路径错：不让整个页面崩
      return null;
    }
  }

  window.HSK_LOADER = { loadVocab, loadLessons };
})();
