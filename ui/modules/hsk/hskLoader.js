// /ui/modules/hsk/hskLoader.js
// ✅ Classic Script (NO export) — registers window.HSK_LOADER
// Provides: loadVocab(level, opts), loadLessons(level, opts), loadLessonDetail(level, lessonNo, opts)
//
// =============================================================================
// Lumina HSK — 权威数据源（请勿在其它文件「再立一套」主词表）
// -----------------------------------------------------------------------------
// 普通课（1~20）
//   • 正式单词集合与顺序：唯一权威 = data/courses/<ver>/hsk<lv>/vocab-distribution.json
//     → distribution.lessonN 的汉字列表；释义/拼音 = data/vocab/<ver>/hsk<lv>.json
//   • lessonN.json 的 vocab/words：仅作 enrich（例句、senseNote、词性等），绝不是正式词表 fallback
//   • dialogue / grammar / extension / practice：唯一权威 = 对应 lessonN.json
// lessons.json
//   • 课程目录与元数据（lessonNo、file、title、vocabTargets…）；不是普通课主词表
// 复习课（21/22）
//   • 词/会话/语法/扩展：运行时按 review range 聚合「范围内普通课」经本 loader 收口后的 loadLessonDetail
//   • practice：运行时 generateReviewPractice（非 lesson21/22.json 静态字段）；opts.practiceLang 影响题干语言
//   • HSK1 固定：lesson21 → 聚合第1–10课；lesson22 → 聚合第11–20课（代码强制 canonical，与 vocab-distribution.reviewRanges 对齐）
// =============================================================================
//
// ✅ Versioned paths (repo):
//   vocab:        /data/vocab/<ver>/hsk<lv>.json
//   lessons: /data/courses/<ver>/hsk<lv>/lessons.json
//   lesson:  /data/courses/<ver>/hsk<lv>/lesson<no>.json
//
// ✅ Version priority:
//   opts.version -> localStorage(hsk_vocab_version) -> window.APP_VOCAB_VERSION -> default "hsk2.0"
//
// ✅ 分课词表：data/courses/<ver>/hsk<lv>/vocab-distribution.json（见上方权威说明）
//   - 词条详情（pinyin/meaning）仍从 data/vocab/<ver>/hsk<lv>.json 解析
//
// ✅ Robust:
// - version 仅允许 hsk2.0 / hsk3.0（禁止 hsk2/hsk3 短写，normalizeVersion 会转成完整形式）
// - 404 fallback: if hsk3.0 missing -> try hsk2.0
// - cache key: vocab:${version}:hsk${lv}
// - exposes window.HSK_LOADER.getVersion() / setVersion() / clearCache()
// - NEW: lessonDetailUrl() + loadLessonDetail()

(function () {
  const isNoCache = typeof window !== "undefined" && window.isNoCacheEnv && window.isNoCacheEnv();
  const MEM_CACHE_TTL = isNoCache ? 0 : 1000 * 60 * 30; // preview/开发 0，正式 30min
  const MEM = new Map();
  const lessonDetailInflight = new Map();
  const now = () => Date.now();

  let _fetchJsonCachedModPromise = null;
  async function getFetchJsonCached() {
    if (!_fetchJsonCachedModPromise) {
      _fetchJsonCachedModPromise = import("/ui/core/fetchJsonCached.js");
    }
    const m = await _fetchJsonCachedModPromise;
    return m.fetchJsonCached;
  }

  function clearFetchJsonLayer() {
    lessonDetailInflight.clear();
    import("/ui/core/fetchJsonCached.js")
      .then((m) => m.clearFetchJsonCache())
      .catch(() => {});
  }

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

    const rawPos = raw && raw.pos;
    let pos;
    if (rawPos != null) {
      const p = normalizeLangValue(rawPos);
      if (typeof p === "string") {
        const zhPos = safeText(p);
        if (zhPos) pos = { zh: zhPos, cn: zhPos };
      } else if (p && typeof p === "object") {
        const kr = safeText(p.kr || p.ko);
        const ko = safeText(p.ko || p.kr);
        const zh = safeText(p.zh || p.cn);
        const cn = safeText(p.cn || p.zh);
        const en = safeText(p.en || p.english);
        const jp = safeText(p.jp || p.ja);
        const ja = safeText(p.ja || p.jp);
        const out = {};
        if (kr) out.kr = kr;
        if (ko) out.ko = ko;
        if (zh) out.zh = zh;
        if (cn) out.cn = cn;
        if (en) out.en = en;
        if (jp) out.jp = jp;
        if (ja) out.ja = ja;
        if (Object.keys(out).length) pos = out;
      }
    }

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
      pos,
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

  /** 单词分课表：data/courses/<ver>/hsk<lv>/vocab-distribution.json */
  function vocabDistributionUrl(lv, version) {
    return withBase(`data/courses/${version}/hsk${lv}/vocab-distribution.json`);
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
    const fetchJsonCached = await getFetchJsonCached();
    const init = { cache: "no-store" };
    try {
      return await fetchJsonCached(url, init);
    } catch (e) {
      // ✅ 404 fallback: if requesting hsk3.0 but repo doesn't have it yet, fallback to hsk2.0
      const st = e && (e.status ?? e.cause?.status);
      if (st === 404 && opts.fallbackTo2 && String(url).includes("/hsk3.0/")) {
        const url2 = String(url).replace("/hsk3.0/", "/hsk2.0/");
        console.warn("[HSK_LOADER] 404 fallback =>", url2);
        return fetchJsonCached(url2, init);
      }
      throw e;
    }
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

  /**
   * 复习题生成器释义语言（与 generatorUtils.pickLang 一致）：kr | en | cn | jp
   * 优先 opts.practiceLang / opts.lang，否则 joy_lang / site_lang，默认 kr。
   */
  /**
   * HSK1 复习课 canonical 范围（与 data/.../vocab-distribution.json reviewRanges 一致）。
   * lesson21 → 1–10；lesson22 → 11–20。其它层级/课号仍读 review.lessonRange。
   */
  function resolveCanonicalHSK1ReviewRange(lv, lessonNo, rawReview) {
    const lvn = String(normalizeLevel(lv));
    const no = Number(lessonNo) || 0;
    if (lvn === "1" && no === 21) return { from: 1, to: 10 };
    if (lvn === "1" && no === 22) return { from: 11, to: 20 };
    const range = rawReview?.lessonRange || rawReview?.range || [];
    const fromRaw = Number(range[0]);
    const toRaw = Number(range[1]);
    const from = Number.isFinite(fromRaw) && fromRaw > 0 ? fromRaw : 1;
    const to = Number.isFinite(toRaw) && toRaw > 0 ? toRaw : from;
    return { from, to: Math.max(from, to) };
  }

  function resolvePracticeLangForGenerators(opts) {
    const explicit = safeText(opts && (opts.practiceLang || opts.lang));
    if (explicit) {
      const m = explicit.toLowerCase();
      if (m === "ko" || m === "kr") return "kr";
      if (m === "en") return "en";
      if (m === "zh" || m === "cn") return "cn";
      if (m === "jp" || m === "ja") return "jp";
    }
    try {
      if (typeof localStorage !== "undefined") {
        const ls = safeText(localStorage.getItem("joy_lang") || localStorage.getItem("site_lang"));
        if (ls) return resolvePracticeLangForGenerators({ practiceLang: ls });
      }
    } catch {}
    return "kr";
  }

  /** 从 distribution 取某课汉字列表（含复习课 reviewRanges 合并） */
  function getHanziListForLesson(distributionData, lessonNo) {
    if (!distributionData || typeof distributionData !== "object") return null;
    const dist = distributionData.distribution;
    const ranges = distributionData.reviewRanges;
    if (!dist || typeof dist !== "object") return null;

    const no = Number(lessonNo) || 1;
    const key = "lesson" + no;

    if (ranges && ranges[key] && Array.isArray(ranges[key])) {
      const [from, to] = ranges[key];
      const fromL = Math.max(1, Number(from) || 1);
      const toL = Math.min(999, Number(to) || fromL);
      const hanziSet = new Set();
      for (let i = fromL; i <= toL; i++) {
        const arr = dist["lesson" + i];
        if (Array.isArray(arr)) arr.forEach((h) => hanziSet.add(String(h).trim()));
      }
      return Array.from(hanziSet);
    }

    const arr = dist[key];
    return Array.isArray(arr) ? arr : null;
  }

  /**
   * Enrich-only：将 lesson JSON 中的 vocab 按汉字对齐到「已由 distribution 决定的」词条上。
   * distribution 决定：有哪些词、顺序、基础拼音/释义（来自全库 vocab）。
   * 课 JSON 仅补充：senseNote、examples、多语 pos 等；不参与「正式词表集合」决策。
   */
  function normalizeVocabHanziKey(h) {
    const s = String(h ?? "").trim();
    if (!s) return "";
    return s.replace(/[\s\u3002\uFF01\uFF0C\uFF1F\uFF1A\uFF1B!?,。；：]+$/u, "");
  }

  /** @param {Array} distributionList 已由 distribution 决定的正式词表 */
  function mergeVocabFromLessonFile(distributionList, lessonVocabList) {
    if (!Array.isArray(distributionList)) return distributionList;
    if (!Array.isArray(lessonVocabList) || lessonVocabList.length === 0) return distributionList;

    const byNorm = new Map();
    for (const w of lessonVocabList) {
      const rawKey = (w && (w.hanzi || w.word)) ? String(w.hanzi || w.word).trim() : "";
      const k = normalizeVocabHanziKey(rawKey);
      if (k && !byNorm.has(k)) byNorm.set(k, w);
    }

    return distributionList.map((item) => {
      const k = normalizeVocabHanziKey(item && (item.hanzi || item.word));
      const src = k ? byNorm.get(k) : null;
      if (!src) return item;

      const out = { ...item };
      if (Array.isArray(src.examples)) out.examples = src.examples;
      if (Array.isArray(src.exampleSentences)) out.exampleSentences = src.exampleSentences;
      if (Array.isArray(src.sampleExamples)) out.sampleExamples = src.sampleExamples;
      if (src.senseNote != null) out.senseNote = src.senseNote;
      if (src.explanation != null) out.explanation = src.explanation;
      if (src.description != null) out.description = src.description;
      if (src.note != null) out.note = src.note;
      if (src.explain != null) out.explain = src.explain;

      if (src.pos != null && typeof src.pos === "object") {
        out.pos = { ...(typeof item.pos === "object" && item.pos ? item.pos : {}), ...src.pos };
      }

      if (src.meaning != null && typeof src.meaning === "object" && out.meaning && typeof out.meaning === "object") {
        out.meaning = { ...out.meaning, ...src.meaning };
      }
      return out;
    });
  }

  /** 用全量词库按汉字解析出完整词条列表（保持 distribution 顺序）；匹配不到的保留占位词条。绝不回退为「课 JSON vocab 整表」。 */
  function resolveHanziToVocab(hanziList, fullVocabList) {
    if (!Array.isArray(hanziList)) return [];
    const byHanzi = new Map();
    (Array.isArray(fullVocabList) ? fullVocabList : []).forEach((w) => {
      const h = (w.hanzi || w.word || "").trim();
      if (h && !byHanzi.has(h)) byHanzi.set(h, w);
    });
    return hanziList.map((h) => {
      const key = String(h).trim();
      if (!key) return null;
      const found = byHanzi.get(key);
      if (found) return found;
      return {
        hanzi: key,
        word: key,
        pinyin: "",
        meaning: { ko: "", en: "", zh: key },
        ko: "", kr: "", en: "", zh: key, cn: key,
      };
    }).filter(Boolean);
  }

  /** 加载 vocab-distribution.json，不存在或失败返回 null */
  async function loadVocabDistribution(level, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);
    const url =
      (window.DATA_PATHS?.vocabDistributionUrl?.(lv, { version })) ||
      vocabDistributionUrl(lv, version);
    const memKey = `vocabDistribution:${version}:hsk${lv}`;
    const cached = memGet(memKey);
    if (cached) return cached;
    try {
      const fetchJsonCached = await getFetchJsonCached();
      const data = await fetchJsonCached(url, { cache: "no-store" });
      if (data && (data.distribution || data.reviewRanges)) {
        memSet(memKey, data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 按 vocab-distribution 生成某课正式单词列表。
   * 返回 null 表示无法从 distribution 构建；普通课调用方将使用空词表并 console.warn，不回退到课内 vocab。
   * 依赖 loadVocab（data/vocab/<ver>/hsk<lv>.json）解析 pinyin/meaning。
   */
  async function buildLessonVocabFromDistribution(level, lessonNo, opts = {}) {
    const dist = await loadVocabDistribution(level, opts);
    if (!dist) return null;
    const hanziList = getHanziListForLesson(dist, lessonNo);
    if (hanziList === null) return null;
    const fullList = await loadVocab(level, opts);
    return resolveHanziToVocab(hanziList, fullList);
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

  // loadLesson：普通课词表 = distribution + enrich；复习课 = range 聚合 + 运行时 practice（见文件头权威说明）
  async function loadLessonDetail(level, lessonNo, opts = {}) {
    const lv = normalizeLevel(level);
    const version = getVocabVersion(opts);
    const no = Number(lessonNo || 1) || 1;
    const filePart = safeText(opts.file || "");
    const isReviewLessonSlot = no === 21 || no === 22;
    const practiceLangCacheKey = isReviewLessonSlot ? resolvePracticeLangForGenerators(opts) : "";
    const memKey = `lessonDetail:${version}:${lv}:${no}:${filePart}:${practiceLangCacheKey}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const inflightP = lessonDetailInflight.get(memKey);
    if (inflightP) return inflightP;

    const loadPromise = (async () => {
      try {
    const { COURSES } = await import("/ui/platform/index.js");
    const course = await COURSES.loadCourse(
      { type: "hsk", level: lv, lessonNo: no },
      { track: version, file: opts.file }
    );

    const source = course.raw || {};
    const doc = course.doc || {};
    const c = doc.content;

    let vocabArr, lessonVocabEnrichOnly, dialogueArr, grammarArr, extensionArr, practiceArr;

    if (source.type === "review") {
      const declaredRange = source.review?.lessonRange || source.review?.range || [];
      const canon = resolveCanonicalHSK1ReviewRange(lv, no, source.review);
      const from = canon.from;
      const to = canon.to;
      if (String(normalizeLevel(lv)) === "1" && (no === 21 || no === 22)) {
        if (Number(declaredRange[0]) !== from || Number(declaredRange[1]) !== to) {
          try {
            console.warn(
              "[HSK_LOADER] HSK1 lesson",
              no,
              "声明的 review.lessonRange",
              declaredRange,
              "与 canonical",
              [from, to],
              "不符，已按 canonical 聚合。"
            );
          } catch {}
        }
      }

      const merged = await loadAndMergeReviewRange(lv, version, from, to, opts);
      vocabArr = merged.vocab;
      dialogueArr = merged.dialogue;
      grammarArr = merged.grammar;
      extensionArr = merged.extension;
      practiceArr = merged.practice;
    } else {
      lessonVocabEnrichOnly = Array.isArray(source.vocab) ? source.vocab
        : (Array.isArray(source.words) ? source.words : (Array.isArray(c?.vocab) ? c.vocab : (Array.isArray(c?.words) ? c.words : [])));
      // 普通课：正式词表仅来自 distribution；此处课内数组仅作 enrich，不作 fallback。
      vocabArr = [];
      // 会话优先级：1) 非空 dialogueCards 2) 非空 dialogue 3) 非空 doc.content.dialogue 4) 空数组
      if (Array.isArray(source.dialogueCards) && source.dialogueCards.length > 0) {
        dialogueArr = source.dialogueCards;
      } else if (Array.isArray(source.dialogue) && source.dialogue.length > 0) {
        dialogueArr = source.dialogue;
      } else if (Array.isArray(c?.dialogue) && c.dialogue.length > 0) {
        dialogueArr = c.dialogue;
      } else {
        dialogueArr = [];
      }
      grammarArr = Array.isArray(source.grammar) ? source.grammar : (Array.isArray(c?.grammar) ? c.grammar : []);
      extensionArr = Array.isArray(source.extension) ? source.extension : (Array.isArray(c?.extension) ? c.extension : []);
      // 普通课练习唯一真源：lesson JSON 的 practice（不经本 loader 改写内容）
      practiceArr = Array.isArray(source.practice) ? source.practice : (Array.isArray(c?.practice) ? c.practice : []);
    }

    const { normalizeSteps, stepKeys } = await import("/ui/core/lessonSteps.js");
    const stepsRaw = Array.isArray(source.steps) ? source.steps : (Array.isArray(doc.steps) ? doc.steps : undefined);
    const steps = normalizeSteps(stepsRaw, source.type === "review");
    let lesson = {
      ...source,
      vocab: vocabArr,
      words: vocabArr,
      dialogue: dialogueArr,
      dialogueCards: dialogueArr,
      grammar: grammarArr,
      extension: extensionArr,
      practice: practiceArr,
      review: source.review || doc.content?.review || {},
      steps,
      stepKeys: stepKeys(steps),
    };

    // 复习课：词/会话/语法/扩展 = range 内聚合结果；非 lesson 文件内冗长静态词表
    if (source.type === "review") {
      try {
        const { filterMergedVocabForReviewLesson } = await import("/ui/modules/hsk/hskRenderer.js");
        const tmpLesson = { dialogue: dialogueArr, dialogueCards: dialogueArr };
        const filtered = filterMergedVocabForReviewLesson(vocabArr, tmpLesson);
        lesson = { ...lesson, vocab: filtered, words: filtered };
      } catch (e) {
        console.warn("[HSK_LOADER] filterMergedVocabForReviewLesson failed:", e && e.message ? e.message : e);
      }
    } else {
      const distributionVocab = await buildLessonVocabFromDistribution(lv, no, { version });
      const mergedVocab = Array.isArray(distributionVocab)
        ? mergeVocabFromLessonFile(distributionVocab, lessonVocabEnrichOnly)
        : [];
      if (!Array.isArray(distributionVocab) || distributionVocab.length === 0) {
        try {
          console.warn(
            "[HSK_LOADER] 普通课词表为空：无法从 vocab-distribution 构建 lesson",
            no,
            "。课 JSON 的 vocab 不会作为正式词表兜底。请检查 vocab-distribution.json / 网络。"
          );
        } catch {}
      }
      lesson = { ...lesson, vocab: mergedVocab, words: mergedVocab };
    }

    if (source.type === "review" && String(normalizeLevel(lv)) === "1" && (no === 21 || no === 22)) {
      const c = resolveCanonicalHSK1ReviewRange(lv, no, source.review);
      lesson = {
        ...lesson,
        review: {
          ...(lesson.review || {}),
          lessonRange: [c.from, c.to],
          range: [c.from, c.to],
        },
      };
    }

    memSet(memKey, lesson);
    return lesson;
      } finally {
        lessonDetailInflight.delete(memKey);
      }
    })();

    lessonDetailInflight.set(memKey, loadPromise);
    return loadPromise;
  }

  /**
   * 复习聚合规则（稳定、可复现）：
   * - 遍历 n = from … to（含端点），严格只加载 lesson{n}.json 经 loadLessonDetail 的结果。
   * - 单词：按课序；汉字键首次出现保留（早课优先），与 distribution 在单课内的顺序一致。
   * - 会话行：按课序追加，不做跨课合并去重（保留重复行若各课自有重复）。
   * - 语法 / 扩展：按课序；grammarDedupKey / extensionDedupKey 首次出现保留（早课优先）。
   */
  async function loadAndMergeReviewRange(lv, version, from, to, opts) {
    const vocabSeen = new Map();
    const grammarSeen = new Set();
    const extensionSeen = new Set();
    const dialogueList = [];
    const grammarList = [];
    const extensionList = [];

    function grammarDedupKey(g) {
      if (!g || typeof g !== "object") return "__g_empty__";
      const p = safeText(g.pattern);
      if (p) return "pat:" + p;
      const t = g.title;
      if (typeof t === "string" && safeText(t)) return "tit:" + safeText(t);
      if (t && typeof t === "object") return "tit:" + safeText(t.zh || t.cn || t.kr || t.en || t.ko);
      try {
        return "gjson:" + JSON.stringify(g).slice(0, 200);
      } catch {
        return "__g_fallback__";
      }
    }
    function extensionDedupKey(x) {
      if (!x || typeof x !== "object") return "__ex_empty__";
      const k = safeText(x.phrase || x.zh || x.cn || x.hanzi || x.line || x.text);
      if (k) return "ex:" + k;
      try {
        return "exjson:" + JSON.stringify(x).slice(0, 200);
      } catch {
        return "__ex_fallback__";
      }
    }

    for (let n = from; n <= to; n++) {
      // 复习课合并来源必须与普通课页面一致：使用 loader 收口后的词表（distribution -> loader）
      const normalLesson = await loadLessonDetail(lv, n, {
        version,
        file: `lesson${n}.json`,
        practiceLang: opts.practiceLang,
        lang: opts.lang,
      });
      const v = Array.isArray(normalLesson?.vocab)
        ? normalLesson.vocab
        : (Array.isArray(normalLesson?.words) ? normalLesson.words : []);
      const d =
        Array.isArray(normalLesson?.dialogueCards) && normalLesson.dialogueCards.length > 0
          ? normalLesson.dialogueCards
          : (Array.isArray(normalLesson?.dialogue) ? normalLesson.dialogue : []);
      const gArr = Array.isArray(normalLesson?.grammar) ? normalLesson.grammar : [];
      const eArr = Array.isArray(normalLesson?.extension) ? normalLesson.extension : [];

      for (const w of v) {
        const key = (w?.hanzi || w?.word || "").trim();
        if (key && !vocabSeen.has(key)) vocabSeen.set(key, w);
      }
      dialogueList.push(...(Array.isArray(d) ? d : []));
      for (const gItem of gArr) {
        const gk = grammarDedupKey(gItem);
        if (grammarSeen.has(gk)) continue;
        grammarSeen.add(gk);
        grammarList.push(gItem);
      }
      for (const extItem of eArr) {
        const ek = extensionDedupKey(extItem);
        if (extensionSeen.has(ek)) continue;
        extensionSeen.add(ek);
        extensionList.push(extItem);
      }
    }

    const mergedLesson = {
      vocab: Array.from(vocabSeen.values()),
      words: Array.from(vocabSeen.values()),
      dialogueCards: dialogueList,
      dialogue: dialogueList,
      grammar: grammarList,
      extension: extensionList,
      level: "HSK" + lv,
      courseId: `hsk2.0_hsk${lv}`,
    };

    const practice = await generateReviewPractice(mergedLesson, 10, 10, opts);
    return {
      vocab: mergedLesson.vocab,
      dialogue: mergedLesson.dialogueCards,
      grammar: mergedLesson.grammar,
      extension: mergedLesson.extension,
      practice,
    };
  }

  /**
   * 复习课练习：唯一来源为本函数运行时生成（输入 = 聚合后的 mergedLesson）。
   * 语言：opts.practiceLang / opts.lang → resolvePracticeLangForGenerators（勿硬编码单一语种）。
   */
  async function generateReviewPractice(lesson, minCount, maxCount, opts = {}) {
    try {
      const { shuffle } = await import("/ui/platform/practice-generator/generatorUtils.js");
      const { normalizeQuestion } = await import("/ui/platform/practice-generator/questionNormalizer.js");

      const lang = resolvePracticeLangForGenerators(opts);
      const totalCount = Math.min(maxCount, Math.max(minCount, 10));
      const levelNum = 1;
      const lessonId = lesson?.id ?? lesson?.courseId ?? "";

      const {
        generateVocabMeaningChoice,
        generateMeaningToVocabChoice,
        generatePinyinToVocabChoice,
      } = await import("/ui/platform/practice-generator/vocabQuestionGenerator.js");
      const {
        generateDialogueResponseChoice,
        generateDialogueMeaningChoice,
      } = await import("/ui/platform/practice-generator/dialogueQuestionGenerator.js");
      const {
        generateGrammarFillChoice,
        generateGrammarPatternChoice,
        generateGrammarExampleMeaning,
      } = await import("/ui/platform/practice-generator/grammarQuestionGenerator.js");
      const {
        generateSentenceOrderChoice,
        generateSentenceCompletionChoice,
      } = await import("/ui/platform/practice-generator/extensionQuestionGenerator.js");
      const { generateExtensionMeaningChoice } = await import("/ui/platform/practice-generator/extensionQuestionGenerator.js");

      const pickUnique = (arr, n, usedIds) => {
        const out = [];
        for (const q of arr) {
          if (out.length >= n) break;
          const norm = normalizeQuestion(q, lessonId, out.length);
          if (!norm || usedIds.has(norm.id)) continue;
          usedIds.add(norm.id);
          out.push(norm);
        }
        return out;
      };

      const usedIds = new Set();
      const result = [];

      // Part 1: Vocabulary 4 题（汉字→释义、释义→汉字、拼音→汉字，随机分布）
      const v1 = shuffle(generateVocabMeaningChoice(lesson, 2, lang, levelNum));
      const v2 = shuffle(generateMeaningToVocabChoice(lesson, 2, lang));
      const v3 = shuffle(generatePinyinToVocabChoice(lesson, 2, lang));
      const vocabPool = shuffle([...v1, ...v2, ...v3]);
      const vocabQuestions = pickUnique(vocabPool, 4, usedIds);
      for (const q of vocabQuestions) {
        result.push(toPracticeSchema(q, "vocabulary"));
      }

      // Part 2: Grammar 3 题（grammar_fill_choice x2，grammar_pattern/example x1，均为 choice）
      const g1 = shuffle(generateGrammarFillChoice(lesson, 3, lang));
      const g2 = shuffle(generateGrammarPatternChoice(lesson, 2, lang));
      const g3 = shuffle(generateGrammarExampleMeaning(lesson, 2, lang));
      const grammarPool = shuffle([...g1, ...g2, ...g3]);
      const grammarQuestions = pickUnique(grammarPool, 3, usedIds);
      for (const q of grammarQuestions) {
        result.push(toPracticeSchema(q, "grammar"));
      }

      // Part 3: Sentences 3 题（句子排序、对话补全、简单翻译）
      const s1 = shuffle(generateSentenceOrderChoice(lesson, 2, lang));
      const s2 = shuffle(generateSentenceCompletionChoice(lesson, 2, lang));
      const s3 = shuffle(generateDialogueResponseChoice(lesson, 2, lang));
      const s4 = shuffle(generateDialogueMeaningChoice(lesson, 2, lang));
      const s5 = shuffle(generateExtensionMeaningChoice(lesson, 2, lang, levelNum));
      const sentencePool = shuffle([...s1, ...s2, ...s3, ...s4, ...s5]);
      const sentenceQuestions = pickUnique(sentencePool, 3, usedIds);
      for (const q of sentenceQuestions) {
        result.push(toPracticeSchema(q, "sentences"));
      }

      return result.slice(0, totalCount);
    } catch (e) {
      console.warn("[HSK_LOADER] generateReviewPractice failed:", e?.message);
      return [];
    }
  }

  /** 将 generator 输出转为 modules/practice 兼容的 schema（保留 options 的 key 格式供 practiceChoice 判题） */
  function toPracticeSchema(q, section) {
    if (!q) return null;
    const prompt = q.question || q.prompt || {};
    const promptObj = typeof prompt === "object"
      ? { cn: prompt.zh ?? prompt.cn ?? "", kr: prompt.kr ?? prompt.ko ?? "", en: prompt.en ?? "", jp: prompt.jp ?? "" }
      : { cn: String(prompt), kr: "", en: "", jp: "" };
    const base = {
      id: q.id,
      type: q.type || "choice",
      subtype: q.subtype,
      prompt: promptObj,
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.answer ?? q.correct ?? q.key,
      explanation: q.explanation,
      score: q.score ?? 1,
    };
    if (section) base.section = section;
    return base;
  }

  // ✅ Helper: force set version (UI can call this)
  function setVersion(v) {
    const ver = normalizeVersion(v);
    try {
      localStorage.setItem("hsk_vocab_version", ver);
    } catch {}
    memClear("vocab:");
    memClear("vocabDistribution:");
    memClear("lessons:");
    memClear("lessonDetail:");
    lessonDetailInflight.clear();
    clearFetchJsonLayer();
    import("/ui/modules/hsk/lessonSession.js")
      .then((m) => m.clearLessonLoadDedupe?.())
      .catch(() => {});
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

    // ✅ 单词来源：vocab-distribution.json → 按 distribution.lessonX 生成每课单词
    loadVocabDistribution,
    buildLessonVocabFromDistribution,
    mergeVocabFromLessonFile,
    vocabDistributionUrl: (lv, opts = {}) => vocabDistributionUrl(normalizeLevel(lv), getVocabVersion(opts)),

    /**
     * loadLessonDetail(level, lessonNo, opts?)
     * opts: { version, file?, practiceLang? } — practiceLang 用于复习课 21/22 的练习语言与缓存分键（kr|en|cn|jp）
     */
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
    clearCache: () => {
      memClear();
      lessonDetailInflight.clear();
      clearFetchJsonLayer();
    },
  };
})();
