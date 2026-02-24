// /ui/modules/hsk/hskLoader.js
// ✅ Classic Script (NO export) — registers window.HSK_LOADER
// Provides: loadVocab(level, opts), loadLessons(level, opts)
//
// ✅ Versioned paths (repo):
//   vocab:   /data/vocab/<ver>/hsk<lv>.json
//   lessons: /data/lessons/<ver>/hsk<lv>_lessons.json
//
// ✅ Version priority:
//   opts.version -> localStorage(hsk_vocab_version) -> window.APP_VOCAB_VERSION -> default "hsk2.0"
//
// ✅ Robust:
// - normalizes version aliases (2.0/3.0/hsk2/hsk3)
// - 404 fallback: if hsk3.0 missing -> try hsk2.0
// - cache keys include version+url
// - exposes window.HSK_LOADER.getVersion() / clearCache()

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
  function memClear(prefix) {
    if (!prefix) return MEM.clear();
    for (const k of MEM.keys()) if (String(k).startsWith(prefix)) MEM.delete(k);
  }

  // -----------------------------
  // Value normalizers
  // -----------------------------
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

    return {
      raw,
      word: normalizeWord(word),
      pinyin: safeText(pinyin),
      meaning,
      example,
    };
  }

  // -----------------------------
  // Version & Level
  // -----------------------------
  function normalizeLevel(level) {
    const s = safeText(level || "1").toLowerCase();
    const m = s.match(/(\d+)/);
    return m ? String(Number(m[1])) : "1";
  }

  function normalizeVersion(v) {
    const s = safeText(v).toLowerCase();
    if (!s) return "hsk2.0";
    if (s === "2.0") return "hsk2.0";
    if (s === "3.0") return "hsk3.0";
    if (s === "hsk2") return "hsk2.0";
    if (s === "hsk3") return "hsk3.0";
    if (s === "hsk2.0" || s === "hsk3.0") return s;

    // allow "HSK 2.0" / "hsk_3.0" etc
    const m = s.match(/(2\.0|3\.0)/);
    if (m) return `hsk${m[1]}`;

    return "hsk2.0";
  }

  function getVocabVersion(opts) {
    const fromOpts = opts && safeText(opts.version);
    const fromLS =
      typeof localStorage !== "undefined"
        ? safeText(localStorage.getItem("hsk_vocab_version"))
        : "";
    const fromGlobal = safeText(window.APP_VOCAB_VERSION);

    return normalizeVersion(fromOpts || fromLS || fromGlobal || "hsk2.0");
  }

  // -----------------------------
  // URL builders
  // -----------------------------
  function vocabUrl(lv, version) {
    return `/data/vocab/${version}/hsk${lv}.json`;
  }
  function lessonsUrl(lv, version) {
    return `/data/lessons/${version}/hsk${lv}_lessons.json`;
  }

  // -----------------------------
  // Fetch with robust fallback
  // -----------------------------
  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return res.json();

    // ✅ 404 fallback: if requesting hsk3.0 but repo doesn't have it yet, fallback to hsk2.0
    if (res.status === 404 && opts.fallbackTo2 && url.includes("/hsk3.0/")) {
      const url2 = url.replace("/hsk3.0/", "/hsk2.0/");
      console.warn("[HSK_LOADER] 404 fallback =>", url2);
      const res2 = await fetch(url2, { cache: "no-store" });
      if (!res2.ok) throw new Error(`HTTP ${res2.status} - ${url2}`);
      return res2.json();
    }

    throw new Error(`HTTP ${res.status} - ${url}`);
  }

  function extractArray(data) {
    if (Array.isArray(data)) return data;
    return (
      (data &&
        (data.items ||
          data.data ||
          data.vocab ||
          data.words ||
          data.list ||
          data.results)) ||
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

  // -----------------------------
  // Public APIs
  // -----------------------------
  async function loadVocab(level, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);

    const url =
      (window.DATA_PATHS &&
        window.DATA_PATHS.vocabUrl &&
        window.DATA_PATHS.vocabUrl(lv, { version })) ||
      vocabUrl(lv, version);

    const memKey = `vocab:${version}:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const data = await fetchJson(url, { fallbackTo2: true });
    const arr = extractArray(data);
    const finalList = dedupeByWord(arr.map(normalizeItem)).filter((x) => x.word);

    memSet(memKey, finalList);
    return finalList;
  }

  async function loadLessons(level, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);

    const url =
      (window.DATA_PATHS &&
        window.DATA_PATHS.lessonsUrl &&
        window.DATA_PATHS.lessonsUrl(lv, { version })) ||
      lessonsUrl(lv, version);

    const memKey = `lessons:${version}:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const data = await fetchJson(url, { fallbackTo2: true });
    const lessons = Array.isArray(data)
      ? data
      : (data && (data.lessons || data.data)) || [];

    const normalized = lessons.map((l, i) => ({
      ...l,
      // ✅ stable defaults
      id: l.id != null ? l.id : i + 1,
      lesson: l.lesson != null ? l.lesson : i + 1,
      title: l.title || `Lesson ${i + 1}`,
      subtitle: l.subtitle || "",
      words: Array.isArray(l.words) ? l.words : [],
      // ✅ keep the file reference for opening the lesson file
      file: l.file || l.path || l.filename || "",
      // ✅ stamp version/lv into meta (handy for deriveLessonId & openLesson)
      lv,
      version,
    }));

    memSet(memKey, normalized);
    return normalized;
  }

  // ✅ Helper: force set version (UI can call this)
  function setVersion(v) {
    const ver = normalizeVersion(v);
    try {
      localStorage.setItem("hsk_vocab_version", ver);
    } catch {}
    // clear mem cache for lessons/vocab so switching is immediate
    memClear("vocab:");
    memClear("lessons:");
    // optional: clear last lesson selection to avoid cross-version mismatch
    try {
      localStorage.removeItem("joy_current_lesson");
      localStorage.removeItem("hsk_last_lesson");
    } catch {}
    // also clear globals (best effort)
    window.__HSK_CURRENT_LESSON_ID = "";
    window.__HSK_CURRENT_LESSON = null;

    console.log("[HSK_LOADER] setVersion =>", ver);
    return ver;
  }

  window.HSK_LOADER = {
    loadVocab,
    loadLessons,
    // extras (safe)
    getVersion: (opts) => getVocabVersion(opts || {}),
    setVersion,
    clearCache: () => memClear(),
  };
})();
