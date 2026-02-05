// /ui/modules/hsk/hskLoader.js
// ✅ HSK LOADER (ESM + Global Bridge)
// - exports: loadVocab(), loadLessons()
// - also registers: window.HSK_LOADER = { loadVocab, loadLessons }
// - uses window.DATA_PATHS if available

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
    if (!item.word || seen.has(item.word)) return false;
    seen.add(item.word);
    return true;
  });
}

function defaultVocabUrl(level) {
  // ✅ 네 프로젝트에 맞게 필요하면 여기만 바꾸면 됨
  // 우선 DATA_PATHS 가 있으면 그것을 우선 사용
  if (window.DATA_PATHS?.vocabUrl) return window.DATA_PATHS.vocabUrl(level);
  return `/data/hsk${level}.json`;
}

function defaultLessonsUrl(level) {
  if (window.DATA_PATHS?.lessonsUrl) return window.DATA_PATHS.lessonsUrl(level);
  return `/data/hsk${level}.lessons.json`;
}

// ✅ 외부에서 쓰는 이름: loadVocab / loadLessons
export async function loadVocab(level) {
  const lv = safeText(level || "1");
  const url = defaultVocabUrl(lv);
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

export async function loadLessons(level) {
  const lv = safeText(level || "1");
  const url = defaultLessonsUrl(lv);
  if (!url) return null;

  const memKey = `lessons:${lv}:${url}`;
  const cached = memGet(memKey);
  if (cached) return cached;

  try {
    const data = await fetchJson(url);
    const lessons = Array.isArray(data) ? data : data?.lessons || data?.data || [];

    const normalized = lessons.map((l, i) => ({
      ...l,
      id: l.id ?? i,
      title: l.title ?? `Lesson ${i + 1}`,
      subtitle: l.subtitle ?? "",
      words: Array.isArray(l.words) ? l.words : [],
    }));

    memSet(memKey, normalized);
    return normalized;
  } catch {
    return null; // lessons 없으면 그냥 null
  }
}

// ✅ 전역 브릿지 (hskUI가 window.HSK_LOADER를 기대함)
window.HSK_LOADER = window.HSK_LOADER || {};
window.HSK_LOADER.loadVocab = loadVocab;
window.HSK_LOADER.loadLessons = loadLessons;
