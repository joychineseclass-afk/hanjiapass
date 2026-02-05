// /ui/modules/hsk/hskLoader.js
// ✅ Classic Script (NO export) — registers window.HSK_LOADER
// Provides: loadVocab(level), loadLessons(level)

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
      const hasLangKeys = "ko" in v || "kr" in v || "en" in v || "zh" in v || "cn" in v;
      if (hasLangKeys) {
        const out = { ...v };
        if (out.kr && !out.ko) out.ko = out.kr;
        if (out.cn && !out.zh) out.zh = out.cn;
        return out;
      }
      try { return JSON.stringify(v); } catch { return String(v); }
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
      raw && raw.word, raw && raw.hanzi, raw && raw.zi, raw && raw.hz, raw && raw.zh,
      raw && raw.cn, raw && raw.chinese, raw && raw.text, raw && raw.term, raw && raw.token
    );

    const pinyin = pickFirstNonEmpty(raw && raw.pinyin, raw && raw.py, raw && raw.pron, raw && raw.pronunciation);

    const meaning = normalizeLangValue(
      pickFirstNonEmpty(raw && raw.meaning, raw && raw.ko, raw && raw.kr, raw && raw.translation, raw && raw.trans, raw && raw.en, raw && raw.def)
    );

    const example = normalizeLangValue(
      pickFirstNonEmpty(raw && raw.example, raw && raw.sentence, raw && raw.eg, raw && raw.ex)
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
    return (data && (data.items || data.data || data.vocab || data.words || data.list || data.results)) || [];
  }

  function dedupeByWord(list) {
    const seen = new Set();
    return list.filter((item) => {
      if (!item.word || seen.has(item.word)) return false;
      seen.add(item.word);
      return true;
    });
  }

  // ✅ default path builder (if DATA_PATHS not present)
  function vocabUrlFallback(lv) {
    // 너의 프로젝트에 맞게 필요하면 여기만 바꾸면 됨
    // 예: /data/hsk/1/vocab.json ...
    return `/data/hsk${lv}.json`;
  }
  function lessonsUrlFallback(lv) {
    return `/data/hsk${lv}.lessons.json`;
  }

  async function loadVocab(level) {
    const lv = safeText(level || "1");
    const url = (window.DATA_PATHS && window.DATA_PATHS.vocabUrl && window.DATA_PATHS.vocabUrl(lv)) || vocabUrlFallback(lv);
    if (!url) throw new Error("DATA_PATHS.vocabUrl 없음");

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
    const url =
      (window.DATA_PATHS && window.DATA_PATHS.lessonsUrl && window.DATA_PATHS.lessonsUrl(lv)) ||
      lessonsUrlFallback(lv);

    if (!url) return null;

    const memKey = `lessons:${lv}:${url}`;
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
      return null; // lessons 없어도 페이지는 정상 동작
    }
  }

  // ✅ register global
  window.HSK_LOADER = { loadVocab, loadLessons };
})();

// ===== Global bridge (for legacy code) =====
try {
  // 你文件里如果是 export function renderWordCards(...) / renderLessonList(...)
  // 就把它们组成一个对象挂到 window
  window.HSK_RENDER = window.HSK_RENDER || {};
  window.HSK_RENDER.renderWordCards = window.HSK_RENDER.renderWordCards || renderWordCards;
  if (typeof renderLessonList === "function") {
    window.HSK_RENDER.renderLessonList = window.HSK_RENDER.renderLessonList || renderLessonList;
  }
} catch {}
