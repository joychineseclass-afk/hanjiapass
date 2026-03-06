// /ui/modules/hsk/hskLoader.js
// ✅ Classic Script (NO export) — registers window.HSK_LOADER
// Provides: loadVocab(level, opts), loadLessons(level, opts), loadLessonDetail(level, lessonNo, opts)
//
// ✅ Versioned paths (repo):
//   vocab:        /data/vocab/<ver>/hsk<lv>.json
//   lessons: /data/courses/<ver>/hsk<lv>/lessons.json
//   lesson:  /data/courses/<ver>/hsk<lv>/lesson<no>.json
//
// ✅ Version priority:
//   opts.version -> localStorage(hsk_vocab_version) -> window.APP_VOCAB_VERSION -> default "hsk2.0"
//
// ✅ Robust:
// - version 仅允许 hsk2.0 / hsk3.0（禁止 hsk2/hsk3 短写，normalizeVersion 会转成完整形式）
// - 404 fallback: if hsk3.0 missing -> try hsk2.0
// - cache key: vocab:${version}:hsk${lv}
// - exposes window.HSK_LOADER.getVersion() / setVersion() / clearCache()
// - NEW: lessonDetailUrl() + loadLessonDetail()

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

  /** 当 DATA_PATHS 存在时使用 BASE，子目录部署时 fallback URL 也正确 */
  function withBase(relativePath) {
    const p = String(relativePath).replace(/^\/+/, "");
    try {
      const base = window.DATA_PATHS && window.DATA_PATHS.getBase && window.DATA_PATHS.getBase();
      if (base && String(base).trim()) return (String(base).replace(/\/+$/, "") + "/" + p);
    } catch {}
    return "/" + p;
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

  /** Normalized vocab schema: { hanzi, pinyin, meaning:{ko,en,zh}, example?, tags? } */
  function normalizeVocabItem(raw, version) {
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
    const hanzi = normalizeWord(word);

    const pinyin = pickFirstNonEmpty(
      raw && raw.pinyin,
      raw && raw.py,
      raw && raw.pron,
      raw && raw.pronunciation
    );

    const rawMeaning = raw && (raw.meaning || raw.ko || raw.kr || raw.translation || raw.trans || raw.en || raw.def);
    const m = typeof rawMeaning === "object" ? rawMeaning : { ko: rawMeaning || "", en: "", zh: "" };
    const meaning = {
      ko: safeText(m.ko || m.kr),
      en: safeText(m.en),
      zh: safeText(m.zh || m.cn) || hanzi,
    };

    const rawEx = raw && (raw.example || raw.sentence || raw.eg || raw.ex);
    const ex = typeof rawEx === "object" ? rawEx : { zh: rawEx || "" };
    const example = (ex && (ex.zh || ex.ko || ex.en)) ? {
      zh: safeText(ex.zh || ex.cn),
      ko: safeText(ex.ko || ex.kr),
      en: safeText(ex.en),
    } : undefined;

    const tags = {};
    if (raw && (raw.lesson != null || raw.lesson_title)) {
      if (raw.lesson != null) tags.lesson = Number(raw.lesson);
      if (raw.lesson_title) tags.lesson_title = String(raw.lesson_title);
    }
    if (raw && raw.tags && raw.tags.generated) tags.generated = true;

    return {
      hanzi,
      pinyin: safeText(pinyin),
      meaning,
      example: example && (example.zh || example.ko || example.en) ? example : undefined,
      tags: Object.keys(tags).length ? tags : undefined,
      word: hanzi,
      ko: meaning.ko,
      kr: meaning.ko,
      en: meaning.en,
      zh: meaning.zh,
      cn: meaning.zh,
    };
  }

  function normalizeItem(raw) {
    return normalizeVocabItem(raw, "hsk2.0");
  }

  // -----------------------------
  // Version & Level
  // -----------------------------
  function normalizeLevel(level) {
    const s = safeText(level || "1").toLowerCase();
    const m = s.match(/(\d+)/);
    return m ? String(Number(m[1])) : "1";
  }

  /** 内部 version 仅允许 hsk2.0 / hsk3.0，禁止 hsk2/hsk3 短写（读入时自动归一化） */
  function normalizeVersion(v) {
    const s = safeText(v).toLowerCase();
    if (!s) return "hsk2.0";
    if (s === "hsk2.0" || s === "hsk3.0") return s;
    if (s === "2.0" || s === "hsk2") return "hsk2.0";
    if (s === "3.0" || s === "hsk3") return "hsk3.0";
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
  // URL builders (HSK 3.0 的 7~9 级共用 hsk7-9.json)
  // -----------------------------
  function vocabUrl(lv, version) {
    const file = (version === "hsk3.0" && ["7", "8", "9"].includes(String(lv))) ? "hsk7-9.json" : `hsk${lv}.json`;
    return withBase(`data/vocab/${version}/${file}`);
  }
  function lessonsUrl(lv, version) {
    return withBase(`data/courses/${version}/hsk${lv}/lessons.json`);
  }

  // ✅ NEW: lesson detail url (新结构 hsk{N}/lesson{M}.json)
  function lessonDetailUrl(lv, lessonNo, version, file) {
    const n = Number(lessonNo || 1);
    const no = Number.isFinite(n) && n > 0 ? n : 1;
    const f = safeText(file);
    if (f && /^hsk\d+_lesson\d+\.json$/i.test(f)) {
      const m = f.match(/^hsk(\d+)_lesson(\d+)\.json$/i);
      if (m) return withBase(`data/courses/${version}/hsk${m[1]}/lesson${m[2]}.json`);
    }
    return withBase(`data/courses/${version}/hsk${lv}/lesson${no}.json`);
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
      const key = (item.hanzi || item.word || "").trim();
      if (!key) return false;
      if (seen.has(key)) {
        console.warn("[HSK_LOADER] duplicate vocab key:", key);
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function normalizeLessonNo(lesson, i) {
    const n =
      Number(lesson?.lesson) ||
      Number(lesson?.id) ||
      Number(lesson?.no) ||
      Number(i + 1);
    return Number.isFinite(n) && n > 0 ? n : i + 1;
  }

  // -----------------------------
  // Public APIs
  // -----------------------------
  async function loadVocab(level, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);

    // URL 永远为 data/vocab/${version}/hsk${lv}.json
    const url =
      (window.DATA_PATHS?.vocabUrl?.(lv, { version })) ||
      vocabUrl(lv, version);

    const memKey = `vocab:${version}:hsk${lv}`;
    console.log("[HSK_LOADER] loadVocab url=%s cacheKey=%s version=%s lv=%s", url, memKey, version, lv);

    const cached = memGet(memKey);
    if (cached) return cached;

    let data;
    try {
      data = await fetchJson(url, { fallbackTo2: false });
    } catch (e) {
      console.warn("[HSK_LOADER] vocab fetch failed:", url, e);
      throw e;
    }

    const arr = extractArray(data);
    const normalized = arr.map((r) => normalizeVocabItem(r, version));

    for (const x of normalized) {
      if (!(x.hanzi || x.word)) console.warn("[HSK_LOADER] vocab entry missing hanzi:", x);
      if (!x.pinyin) console.warn("[HSK_LOADER] vocab entry missing pinyin:", x.hanzi || x.word, x);
    }

    const finalList = dedupeByWord(normalized).filter((x) => x.hanzi || x.word);

    memSet(memKey, finalList);
    return finalList;
  }

  async function loadLessons(level, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);

    // ✅ 新结构: data/courses/{ver}/hsk{lv}/lessons.json（不再请求 hsk{lv}.json）
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

    const normalized = lessons.map((l, i) => {
      const lessonNo = normalizeLessonNo(l, i);
      const file = l.file || l.path || l.filename || `lesson${lessonNo}.json`;

      return {
        ...l,
        // ✅ stable defaults
        id: l.id != null ? l.id : lessonNo,
        lesson: l.lesson != null ? l.lesson : lessonNo,
        lessonNo,
        // ✅ stable lessonId (does NOT break old fields)
        lessonId: l.lessonId || l.id || l.lesson || `hsk${lv}_lesson${lessonNo}`,
        title: l.title || `Lesson ${lessonNo}`,
        subtitle: l.subtitle || "",
        words: Array.isArray(l.words) ? l.words : [],
        file,
        // ✅ stamp version/lv
        lv,
        version,
      };
    });

    memSet(memKey, normalized);
    return normalized;
  }

  // ✅ load lesson via platform course engine
  async function loadLessonDetail(level, lessonNo, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);
    const no = Number(lessonNo || 1) || 1;

    const memKey = `lessonDetail:${version}:${lv}:${no}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const { COURSES } = await import("/ui/platform/index.js");
    const course = await COURSES.loadCourse(
      { type: "hsk", level: lv, lessonNo: no },
      { track: version, file: opts.file }
    );

    const source = course.raw || {};
    const doc = course.doc || {};
    const c = doc.content;
    // vocab 为主，words 兼容
    const vocabArr = Array.isArray(source.vocab) ? source.vocab
      : (Array.isArray(source.words) ? source.words : (Array.isArray(c?.vocab) ? c.vocab : (Array.isArray(c?.words) ? c.words : [])));
    const { normalizeSteps, stepKeys } = await import("/ui/core/lessonSteps.js");
    const stepsRaw = Array.isArray(source.steps) ? source.steps : (Array.isArray(doc.steps) ? doc.steps : undefined);
    const steps = normalizeSteps(stepsRaw, source.type === "review");
    const lesson = {
      ...source,
      vocab: vocabArr,
      words: vocabArr, // compat
      dialogue: Array.isArray(source.dialogue) ? source.dialogue : (Array.isArray(c?.dialogue) ? c.dialogue : []),
      grammar: Array.isArray(source.grammar) ? source.grammar : (Array.isArray(c?.grammar) ? c.grammar : []),
      practice: Array.isArray(source.practice) ? source.practice : (Array.isArray(c?.practice) ? c.practice : []),
      review: source.review || doc.content?.review || {},
      steps,
      stepKeys: stepKeys(steps),
    };

    memSet(memKey, lesson);
    return lesson;
  }

  // ✅ Helper: force set version (UI can call this)
  function setVersion(v) {
    const ver = normalizeVersion(v);
    try {
      localStorage.setItem("hsk_vocab_version", ver);
    } catch {}
    memClear("vocab:");
    memClear("lessons:");
    memClear("lessonDetail:");
    try {
      localStorage.removeItem("joy_current_lesson");
      localStorage.removeItem("hsk_last_lesson");
    } catch {}
    window.__HSK_CURRENT_LESSON_ID = "";
    window.__HSK_CURRENT_LESSON = null;

    console.log("[HSK_LOADER] setVersion =>", ver);
    return ver;
  }

  window.HSK_LOADER = {
    loadVocab,
    loadLessons,

    // ✅ NEW
    loadLessonDetail,
    lessonDetailUrl: (lv, lessonNo, opts = {}) => {
      const version = getVocabVersion(opts || {});
      const file = safeText(opts?.file || "");
      return lessonDetailUrl(normalizeLevel(lv), Number(lessonNo || 1), version, file);
    },

    // extras (safe)
    getVersion: (opts) => getVocabVersion(opts || {}),
    normalizeVersion,
    setVersion,
    clearCache: () => memClear(),
  };
})();
