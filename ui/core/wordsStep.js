// /ui/core/wordsStep.js
// ✅ Words Step (Stable)
// - Load words from:
//   1) loader.loadLesson(lessonId) if exists
//   2) DATA_PATHS.lessonsUrl(lessonId) -> (pack {lessons:[]}) -> fetch single lesson
//   3) fallback ./data/lessons/${lessonId}.json
// - Render:
//   A) if window.HSK_RENDER.renderWordCards exists -> render into modal container
//   B) fallback: simple list rendering
// - Click word: prefer WORD_PANEL/WORD_MODAL, else dispatch "word:open"
// - Debug: window.__words + console logs

function getLangFromState(state) {
  return (
    state?.lang ||
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr"
  );
}
window.__words = window.__words || [];

// ---------- helpers ----------
const safe = (v) => String(v ?? "");

// 支持 nested key: "term.zh" / "meaning.ko"
function pickDeep(obj, paths) {
  for (const path of paths) {
    const parts = String(path).split(".");
    let cur = obj;
    for (const k of parts) cur = cur?.[k];
    const s = (cur == null ? "" : String(cur)).trim();
    if (s) return s;
  }
  return "";
}

// 兼容：词条可能是 string
function normalizeWord(w) {
  if (typeof w === "string") return { hanzi: w };
  return w || {};
}

// ---------- 1) Load lesson words ----------
async function loadWordsForLesson(lessonId) {
  // 1) 优先 loader
  const loader =
    window.HSK_LOADER ||
    window.hskLoader ||
    window.JOY_LOADER ||
    null;

  if (loader?.loadLesson) {
    const data = await loader.loadLesson(lessonId);
    return (
      data?.words ||
      data?.vocab ||
      data?.wordList ||
      data?.newWords ||
      data?.vocabulary ||
      []
    );
  }

  // 2) DATA_PATHS.lessonsUrl
  const dp = window.DATA_PATHS || null;
  let url = null;

  if (typeof dp?.lessonsUrl === "function") {
    try {
      url = dp.lessonsUrl(lessonId);
    } catch (e) {
      url = null;
    }
  }

  // 3) fallback 单课路径
  if (!url) url = `./data/lessons/${lessonId}.json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch lesson data: ${url}`);
  const json = await res.json();

  // ✅ pack: { lessons:[{id,title,file,subtitle...}] }
  if (Array.isArray(json?.lessons)) {
    const wantedFile = `${lessonId}.json`;
    const idNum = String(lessonId).match(/\d+/g)?.pop() || ""; // hsk1_lesson1 -> "1"

    const found =
      json.lessons.find((x) => x?.file === wantedFile) ||
      (idNum ? json.lessons.find((x) => String(x?.id) === idNum) : null) ||
      null;

    if (!found?.file) {
      console.warn(
        "[wordsStep] lesson not found in pack:",
        lessonId,
        "packUrl=",
        url,
        "pack size=",
        json.lessons.length
      );
      return [];
    }

    // packUrl: ./data/lessons/hsk2.0/hsk1_lessons.json
    // single : ./data/lessons/hsk2.0/hsk1_lesson1.json
    const baseDir = url.slice(0, url.lastIndexOf("/") + 1);
    const singleUrl = baseDir + found.file;

    const res2 = await fetch(singleUrl, { cache: "no-store" });
    if (!res2.ok) throw new Error(`Failed to fetch single lesson: ${singleUrl}`);
    const one = await res2.json();

    return (
      one?.words ||
      one?.vocab ||
      one?.wordList ||
      one?.newWords ||
      one?.vocabulary ||
      one?.lesson?.words ||
      []
    );
  }

  // ✅ single lesson directly
  return (
    json?.words ||
    json?.vocab ||
    json?.wordList ||
    json?.newWords ||
    json?.vocabulary ||
    json?.lesson?.words ||
    []
  );
}

// ---------- 2) Modal open ----------
function openModal({ title, html }) {
  window.dispatchEvent(
    new CustomEvent("modal:open", {
      detail: { title, html },
    })
  );
}

// ---------- 3) Word detail open ----------
function openWordDetail(word, lang) {
  if (window.WORD_PANEL?.open) {
    window.WORD_PANEL.open({ word, lang });
    return;
  }
  if (window.WORD_MODAL?.open) {
    window.WORD_MODAL.open({ word, lang });
    return;
  }
  window.dispatchEvent(
    new CustomEvent("word:open", {
      detail: { word, lang },
    })
  );
}

// ---------- 4) Fallback renderer ----------
function renderWordsFallback(words, lang) {
  const title = `Words (${words.length})`;

  const rows = (words || [])
    .map((raw, i) => {
      const w = normalizeWord(raw);

      // ✅ 尽量多兼容字段（含 nested）
      const han = pickDeep(w, [
        "hanzi", "word", "zh", "cn", "ch", "text", "simplified",
        "term.hanzi", "term.word", "term.zh", "term.cn", "term.text"
      ]);

      const pinyin = pickDeep(w, ["pinyin", "py", "term.pinyin", "term.py"]);

      const kr = pickDeep(w, [
        "kr", "ko", "korean", "meaning_kr", "def_kr", "gloss",
        "meaning.kr", "meaning.ko"
      ]);

      const en = pickDeep(w, [
        "en", "eng", "english", "meaning_en", "def_en",
        "meaning.en"
      ]);

      const meaning = (lang === "kr" ? (kr || en) : (en || kr)) || "";

      const showHan = han || "(?)";

      return `
        <button class="joy-word-row" data-idx="${i}"
          style="
            width:100%;
            display:flex;
            gap:10px;
            align-items:center;
            padding:10px 12px;
            border:1px solid rgba(0,0,0,.08);
            border-radius:12px;
            background:#fff;
            margin:8px 0;
            cursor:pointer;
            text-align:left;
          ">
          <div style="min-width:72px;font-size:20px;font-weight:800;">${safe(showHan)}</div>
          <div style="flex:1;">
            <div style="font-size:13px;opacity:.75;">${safe(pinyin)}</div>
            <div style="font-size:14px;">${safe(meaning)}</div>
          </div>
          <div style="font-size:12px;opacity:.6;">#${i + 1}</div>
        </button>
      `;
    })
    .join("");

  const html = `
    <div style="padding:14px;">
      <div style="font-size:12px;opacity:.7;margin-bottom:10px;">
        点击单词（下一步我们接：详情卡 / 发音 / 笔顺）
      </div>
      <div id="joyWordsList">
        ${rows || '<div style="opacity:.7;">(暂无单词)</div>'}
      </div>
    </div>
  `;

  return { title, html };
}

function bindWordClicks(words, lang) {
  const root = document.getElementById("joyWordsList");
  if (!root) return;

  // 防重复绑定：给 root 打标记
  if (root.__bound) return;
  root.__bound = true;

  root.addEventListener("click", (e) => {
    const row = e.target?.closest?.(".joy-word-row");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const w = words?.[idx];
    if (!w) return;
    openWordDetail(w, lang);
  });
}

// ---------- 5) Public API ----------
// ✅ 等待元素出现（modal 渲染是异步的，必须等）
function waitForEl(id, tries = 20, interval = 50) {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      n += 1;
      if (n >= tries) return resolve(null);
      setTimeout(tick, interval);
    };
    tick();
  });
}

export async function openWordsStep({ lessonId, state }) {
  const lang = getLangFromState(state);

  let words = [];
  try {
    words = await loadWordsForLesson(lessonId);
  } catch (err) {
    console.warn("[wordsStep] loadWordsForLesson failed:", err);
    words = [];
  }

  // debug
  window.__words = words;
  console.log("[wordsStep] lessonId=", lessonId);
  console.log("[wordsStep] __words length =", words?.length || 0);
  console.log("[wordsStep] first word =", words?.[0]);

  const canUseRenderer = typeof window.HSK_RENDER?.renderWordCards === "function";

  // A) renderer 分支（更稳：等待容器出现）
  if (canUseRenderer && Array.isArray(words) && words.length) {
    const containerId = "joyWordsRendererRoot";

    openModal({
      title: `Words (${words.length})`,
      html: `
        <div style="padding:12px;">
          <div style="font-size:12px;opacity:.7;margin-bottom:10px;">
            点击单词（下一步我们接：详情卡 / 发音 / 笔顺）
          </div>
          <div id="${containerId}"></div>
        </div>
      `,
    });

    // ✅ 等容器真正出现在 DOM，再渲染
    const root = await waitForEl(containerId, 30, 50);
    if (!root) {
      console.warn("[wordsStep] renderer root not found, fallback list");
      const modal = renderWordsFallback(words || [], lang);
      openModal(modal);
      bindWordClicks(words || [], lang);
      return;
    }

    try {
      const onClickWord = (w) => openWordDetail(w, lang);
      window.HSK_RENDER.renderWordCards(root, words, onClickWord, { lang });
      return;
    } catch (e) {
      console.warn("[wordsStep] renderWordCards failed, fallback:", e);
      const modal = renderWordsFallback(words || [], lang);
      openModal(modal);
      bindWordClicks(words || [], lang);
      return;
    }
  }

  // B) fallback（永远可用）
  const modal = renderWordsFallback(words || [], lang);
  openModal(modal);
  bindWordClicks(words || [], lang);
}
