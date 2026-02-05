/* =========================================
   📦 HSK LOADER MODULE (Stable Final, Global)
   - Global script (NO export)
   - registers: window.HSK_LOADER.loadVocab / loadLessons
   - keeps: caching + normalization
========================================= */

(function () {
  // ===============================
  // Memory cache
  // ===============================
  const MEM_CACHE_TTL = 1000 * 60 * 30; // 30 min
  const MEM = new Map();
  const now = () => Date.now();

  function memGet(key) {
    const hit = MEM.get(key);
    if (!hit) return null;
    if (now() - hit.ts > MEM_CACHE_TTL) {
      MEM.delete(key);
      return null;
    }
    return hit.data;
  }

  function memSet(key, data) {
    MEM.set(key, { ts: now(), data });
  }

  const safeText = (x) => String(x ?? "").trim();
  const normalizeWord = (s) => safeText(s).replace(/\s+/g, " ").trim();

  // ===============================
  // Lang normalization
  // ===============================
  function normalizeLangValue(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    if (typeof v === "object") {
      const hasLangKeys =
        "ko" in v || "kr" in v || "en" in v || "zh" in v || "cn" in v;
      if (hasLangKeys) {
        const out = { ...v };
        if (out.kr && !out.ko) out.ko = out.kr;
        if (out.cn && !out.zh) out.zh = out.cn;
        return out;
      }
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }

    return String(v);
  }

  function pickFirstNonEmpty(...vals) {
    for (const v of vals) {
      const t = safeText(v);
      if (t) return t;
    }
    return "";
  }

  // ===============================
  // Item normalization
  // ===============================
  function normalizeItem(raw) {
    const word = pickFirstNonEmpty(
      raw?.word,
      raw?.hanzi,
      raw?.zi,
      raw?.hz,
      raw?.zh,
      raw?.cn,
      raw?.chinese,
      raw?.text,
      raw?.term,
      raw?.token
    );

    const pinyin = pickFirstNonEmpty(
      raw?.pinyin,
      raw?.py,
      raw?.pron,
      raw?.pronunciation
    );

    const meaning = normalizeLangValue(
      pickFirstNonEmpty(
        raw?.meaning,
        raw?.ko,
        raw?.kr,
        raw?.translation,
        raw?.trans,
        raw?.en,
        raw?.def
      )
    );

    const example = normalizeLangValue(
      pickFirstNonEmpty(raw?.example, raw?.sentence, raw?.eg, raw?.ex)
    );

    return {
      raw,
      word: normalizeWord(word),
      pinyin: safeText(pinyin),
      meaning,
      example,
    };
  }

  // ===============================
  // Fetch helpers
  // ===============================
  async function fetchJson(url, opt = { cache: "no-store" }) {
    const res = await fetch(url, opt);
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
    return res.json();
  }

  function extractArray(data) {
    if (Array.isArray(data)) return data;
    return (
      data?.items ||
      data?.data ||
      data?.vocab ||
      data?.words ||
      data?.list ||
      data?.results ||
      []
    );
  }

  function dedupeByWord(list) {
    const seen = new Set();
    return list.filter((item) => {
      const w = safeText(item?.word);
      if (!w || seen.has(w)) return false;
      seen.add(w);
      return true;
    });
  }

  // ===============================
  // ✅ Resolve data paths
  // - Uses window.DATA_PATHS.vocabUrl / lessonsUrl if exists
  // - Falls back to common conventions if not
  // ===============================
  function getVocabUrl(level) {
    const lv = safeText(level || "1");

    // Preferred
    if (window.DATA_PATHS?.vocabUrl) {
      const u = window.DATA_PATHS.vocabUrl(lv);
      if (u) return u;
    }

    // Fallbacks (adjust if your actual folder differs)
    // Try: /data/hsk/hsk{lv}.json
    // Try: /data/hsk{lv}.json
    // Try: /hsk/hsk{lv}.json
    return `/data/hsk/hsk${lv}.json`;
  }

  function getLessonsUrl(level) {
    const lv = safeText(level || "1");

    if (window.DATA_PATHS?.lessonsUrl) {
      const u = window.DATA_PATHS.lessonsUrl(lv);
      if (u) return u;
    }

    // Optional fallback
    return `/data/hsk/hsk${lv}.lessons.json`;
  }

  // ===============================
  // 🎯 Public API (expected by ui/modules/hsk/hskUI.js)
  // - loadVocab(level)
  // - loadLessons(level) [optional]
  // ===============================
  async function loadVocab(level) {
    const lv = safeText(level || "1");
    const url = getVocabUrl(lv);
    if (!url) throw new Error("vocabUrl 없음");

    const memKey = `vocab:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const data = await fetchJson(url);
    const arr = extractArray(data);

    const finalList = dedupeByWord(arr.map(normalizeItem)).filter((x) => x.word);

    memSet(memKey, finalList);
    return finalList;
  }

  async function loadLessons(level) {
    const lv = safeText(level || "1");
    const url = getLessonsUrl(lv);
    if (!url) return null;

    const memKey = `lessons:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    try {
      const data = await fetchJson(url);
      const lessons = Array.isArray(data) ? data : data?.lessons || data?.data || [];

      const normalized = lessons.map((l, i) => ({
        ...l,
        id: l?.id ?? i,
        title: l?.title ?? `Lesson ${i + 1}`,
        subtitle: l?.subtitle ?? "",
        words: Array.isArray(l?.words) ? l.words : [],
      }));

      memSet(memKey, normalized);
      return normalized;
    } catch {
      return null; // lessons missing is OK
    }
  }

  // ===============================
  // ✅ Compatibility aliases (if you used these names elsewhere)
  // ===============================
  async function loadHSKLevel(level) {
    return loadVocab(level);
  }
  async function loadHSKLessons(level) {
    return loadLessons(level);
  }

  // ===============================
  // ✅ Register to window
  // ===============================
  window.HSK_LOADER = {
    loadVocab,
    loadLessons,

    // aliases
    loadHSKLevel,
    loadHSKLessons,
  };

  // Optional debug
  // console.log("✅ HSK_LOADER ready", window.HSK_LOADER);
})();
