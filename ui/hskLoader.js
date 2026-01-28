// ui/hskLoader.js (ultimate, KO-first, robust, low rework)
(function () {
  const isArray = Array.isArray;

  // ===== config =====
  const MEM_CACHE_TTL = 1000 * 60 * 30; // 30min
  const MEM = new Map(); // key -> { ts, data }

  function now() {
    return Date.now();
  }

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

  function safeText(x) {
    return String(x ?? "").trim();
  }

  function normalizeWord(s) {
    return safeText(s).replace(/\s+/g, " ").trim();
  }

  // ===== multi-lang helpers =====
  // 允许传入：string | {ko,en,zh,...} | 其它对象
  function normalizeLangValue(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    if (typeof v === "object") {
      // 常见：{ ko, en, zh }
      // 也可能是 { kr: "..."} 这种
      const hasLangKeys =
        "ko" in v || "kr" in v || "en" in v || "zh" in v || "cn" in v;
      if (hasLangKeys) {
        // 统一 kr -> ko（renderer 会优先 ko）
        const out = { ...v };
        if (out.kr && !out.ko) out.ko = out.kr;
        if (out.cn && !out.zh) out.zh = out.cn;
        return out;
      }

      // 不规则对象：尽量转成字符串，避免崩
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

  // ===== normalize item =====
  function normalizeItem(raw) {
    // word 字段容错（尽量覆盖你可能遇到的数据格式）
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

    const pinyin = pickFirstNonEmpty(raw?.pinyin, raw?.py, raw?.pron, raw?.pronunciation);

    // ✅ 韩语优先：meaning 优先 ko/kr，再 en/def，再 translation
    // 支持 meaning/translation 是对象或字符串
    const meaningCandidate = pickFirstNonEmpty(
      raw?.meaning,
      raw?.ko,
      raw?.kr,
      raw?.translation,
      raw?.trans,
      raw?.en,
      raw?.def,
      raw?.definition
    );
    const meaning = normalizeLangValue(meaningCandidate);

    // example 同样支持对象或字符串
    const exampleCandidate = pickFirstNonEmpty(
      raw?.example,
      raw?.sentence,
      raw?.eg,
      raw?.ex,
      raw?.sample
    );
    const example = normalizeLangValue(exampleCandidate);

    return {
      raw,
      word: normalizeWord(word),
      pinyin: safeText(pinyin),
      meaning,
      example,
    };
  }

  // ===== fetch json =====
  async function fetchJson(url, fetchOptions) {
    const opt = fetchOptions || { cache: "no-store" };
    let res;

    try {
      res = await fetch(url, opt);
    } catch (e) {
      throw new Error(`네트워크 오류: ${url}\n${e?.message || e}`);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} - ${url}`);
    }

    try {
      return await res.json();
    } catch (e) {
      throw new Error(`JSON 파싱 실패: ${url}\n${e?.message || e}`);
    }
  }

  function extractArray(data) {
    // data 可能是数组，也可能是 { items:[], data:[], vocab:[], words:[] }
    if (isArray(data)) return data;

    const candidates = [
      data?.items,
      data?.data,
      data?.vocab,
      data?.words,
      data?.list,
      data?.results,
    ];

    for (const c of candidates) {
      if (isArray(c)) return c;
    }

    return [];
  }

  function extractLessonsArray(data) {
    if (isArray(data)) return data;

    const candidates = [
      data?.lessons,
      data?.data,
      data?.items,
      data?.list,
      data?.results,
    ];

    for (const c of candidates) {
      if (isArray(c)) return c;
    }

    return [];
  }

  // 去重：同一个 word 只保留第一次，保持原顺序（教材顺序稳定）
  function dedupeByWord(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const key = item?.word;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  // ===== public api =====
  async function loadVocab(level, options) {
    const lv = safeText(level || "1");
    const url = window.DATA_PATHS?.vocabUrl?.(lv);
    if (!url) throw new Error("DATA_PATHS.vocabUrl 이(가) 없습니다.");

    const memKey = `vocab:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    const data = await fetchJson(url, options?.fetch || { cache: "no-store" });
    const arr = extractArray(data);

    const normalized = dedupeByWord(arr.map(normalizeItem)).filter((x) => x.word);

    // 可选：排序（默认不排序，保持教材顺序）
    let finalList = normalized;
    if (options?.sort === "word") {
      finalList = [...normalized].sort((a, b) => (a.word > b.word ? 1 : -1));
    }

    memSet(memKey, finalList);
    return finalList;
  }

  // lessons.json 可能不存在：不存在就返回 null（让页面回到“全部单词卡模式”）
  async function loadLessons(level, options) {
    const lv = safeText(level || "1");
    const url = window.DATA_PATHS?.lessonsUrl?.(lv);
    if (!url) return null;

    const memKey = `lessons:${lv}:${url}`;
    const cached = memGet(memKey);
    if (cached) return cached;

    try {
      const data = await fetchJson(url, options?.fetch || { cache: "no-store" });
      const lessons = extractLessonsArray(data);

      // 轻度规范化（不强制改结构，避免返工）
      // - 保证 words 是数组（否则给 []）
      // - title/subtitle 允许多语言对象（renderer 会处理；UI 也能高亮）
      const normalized = lessons.map((l, idx) => {
        const obj = l || {};
        return {
          ...obj,
          id: obj.id ?? idx,
          title: obj.title ?? `Lesson ${idx + 1}`,
          subtitle: obj.subtitle ?? "",
          words: isArray(obj.words) ? obj.words : [],
        };
      });

      memSet(memKey, normalized);
      return normalized;
    } catch (e) {
      // 404 / 路径错：不让整个页面崩
      return null;
    }
  }

  window.HSK_LOADER = { loadVocab, loadLessons };
})();
