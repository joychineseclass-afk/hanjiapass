// /ui/modules/hsk/hskLoader.js
// ✅ Classic Script (NO export) — registers window.HSK_LOADER
// Provides: loadVocab(level, opts), loadLessons(level, opts)
//
// ✅ NEW (Formal): supports versioned vocab folders
//   /data/vocab/hsk2.0/hsk1.json
//   /data/vocab/hsk3.0/hsk1.json
// - version priority: opts.version -> localStorage -> window.APP_VOCAB_VERSION -> default "hsk2.0"

(function () {
  const MEM_CACHE_TTL = 1000 * 60 * 30; // 30min
  const MEM = new Map();

  const now = () => Date.now();
  const safeText = (x) => String(x ?? "").trim();
  const normalizeWord = (s) => safeText(s).replace(/\s+/g, " ").trim();

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
      // object but no lang keys → don't show [object Object]
      try {
        return JSON.stringify(v);
      } catch {
        return "";
      }
    }
    return String(v);
  }

  function pickFirstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const t = safeText(arguments[i]);
      if (t) return t;
    }
    return "";
  }

  function normalizeItem(raw) {
    const word = pickFirstNonEmpty(
      raw && raw.word,
      raw && raw.hanzi,
      raw && raw.zi,
      raw && raw.hz,
      raw && raw.zh,
      raw && raw.cn,
      raw && raw.chinese,
      raw && raw.text,
      raw && raw.term,
      raw && raw.token
    );

    const pinyin = pickFirstNonEmpty(
      raw && raw.pinyin,
      raw && raw.py,
      raw && raw.pron,
      raw && raw.pronunciation
    );

    const meaning = normalizeLangValue(
      pickFirstNonEmpty(
        raw && raw.meaning,
        raw && raw.ko,
        raw && raw.kr,
        raw && raw.translation,
        raw && raw.trans,
        raw && raw.en,
        raw && raw.def
      )
    );

    const example = normalizeLangValue(
      pickFirstNonEmpty(
        raw && raw.example,
        raw && raw.sentence,
        raw && raw.eg,
        raw && raw.ex
      )
    );

    return { raw, word: normalizeWord(word), pinyin: safeText(pinyin), meaning, example };
  }

  async function fetchJson(url, opt) {
    const res = await fetch(url, opt || { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
    return res.json();
  }

  function extractArray(data) {
    if (Array.isArray(data)) return data;
    return (
      (data && (data.items || data.data || data.vocab || data.words || data.list || data.results)) ||
      []
    );
  }

  function dedupeByWord(list) {
    const seen = new Set();
    return list.filter((item) => {
      if (!item.word || seen.has(item.word)) return false;
      seen.add(item.word);
      return true;
    });
  }

  // =========================
  // ✅ NEW: Level normalize
  // =========================
  function normalizeLevel(level) {
    // supports: "HSK 1급" / "HSK1" / 1 / "1" / "hsk1"
    const s = safeText(level || "1").toLowerCase();
    const m = s.match(/(\d+)/);
    return m ? String(Number(m[1])) : "1";
  }

  // =========================
  // ✅ NEW: Version resolver
  // =========================
  function getVocabVersion(opts) {
    const fromOpts = opts && safeText(opts.version);
    const fromLS = safeText(localStorage.getItem("hsk_vocab_version"));
    const fromGlobal = safeText(window.APP_VOCAB_VERSION);
    return fromOpts || fromLS || fromGlobal || "hsk2.0";
  }

  // =========================
  // ✅ NEW: Versioned URL builder (Formal)
  // =========================
  function vocabUrlVersioned(lv, version) {
    return `/data/vocab/${version}/hsk${lv}.json`;
  }

  // ✅ lessons 可选：如果你以后也要版本化
  function lessonsUrlVersioned(lv, version) {
    // 你如果没做 lessons 文件，就返回 null
    // return `/data/vocab/${version}/hsk${lv}.lessons.json`;
    return null;
  }

  // ✅ fallback (if you ever need)
  function vocabUrlFallback(lv) {
    return `/data/hsk${lv}.json`;
  }
  function lessonsUrlFallback(lv) {
    return `/data/hsk${lv}.lessons.json`;
  }

  // =========================
  // ✅ API: loadVocab(level, opts)
  // =========================
  async function loadVocab(level, opts) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);

    // ✅ priority: DATA_PATHS override > versioned rule > fallback
    const url =
      (window.DATA_PATHS &&
        window.DATA_PATHS.vocabUrl &&
        window.DATA_PATHS.vocabUrl(lv, { version })) ||
      vocabUrlVersioned(lv, version) ||
      vocabUrlFallback(lv);

    if (!url) throw new Error("vocab url builder missing");

    const memKey = `vocab:${version}:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const data = await fetchJson(url);
    const arr = extractArray(data);

    const finalList = dedupeByWord(arr.map(normalizeItem)).filter((x) => x.word);

    memSet(memKey, finalList);
    return finalList;
  }

  // =========================
  // ✅ API: loadLessons(level, opts)
  // =========================
  async function loadLessons(level, opts) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);

    const url =
      (window.DATA_PATHS &&
        window.DATA_PATHS.lessonsUrl &&
        window.DATA_PATHS.lessonsUrl(lv, { version })) ||
      lessonsUrlVersioned(lv, version) ||
      lessonsUrlFallback(lv);

    if (!url) return null;

    const memKey = `lessons:${version}:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    try {
      const data = await fetchJson(url);
      const lessons = Array.isArray(data) ? data : (data && (data.lessons || data.data)) || [];

      const normalized = lessons.map((l, i) => ({
        ...l,
        id: l.id != null ? l.id : i,
        title: l.title || `Lesson ${i + 1}`,
        subtitle: l.subtitle || "",
        words: Array.isArray(l.words) ? l.words : [],
      }));

      memSet(memKey, normalized);
      return normalized;
    } catch {
      return null;
    }
  }

  // ✅ register global (keeps legacy page code working)
  window.HSK_LOADER = { loadVocab, loadLessons };
})();

// ===== (Optional) Global bridge for legacy renderer (keep if your page still uses window.HSK_RENDER) =====
try {
  window.HSK_RENDER = window.HSK_RENDER || {};
  // 这里不要再强行绑定未定义的 renderWordCards
  // 如果你现在已经改成 ESM import renderWordCards，那这里可以删掉整段
} catch {}
