// /ui/core/wordsStep.js
// ✅ Words Step: open real words list inside modal
// - Tries to use existing loaders/renderers if present
// - Fallback: simple list rendering
// - Click word: prefer existing word panel, else dispatch "word:open"

function getLangFromState(state) {
  return (
    state?.lang ||
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr"
  );
}

// --- 1) Load lesson words (best-effort adapter) ---
async function loadWordsForLesson(lessonId) {
  // 1) 优先：你若已有 loader
  const loader =
    window.HSK_LOADER ||
    window.hskLoader ||
    window.JOY_LOADER ||
    null;

  if (loader?.loadLesson) {
    const data = await loader.loadLesson(lessonId);
    return data?.words || data?.vocab || data?.wordList || [];
  }

 // 2) 优先：用项目内置 DATA_PATHS
const dp = window.DATA_PATHS;

let url = null;

if (dp?.lessonsUrl) {
  url = dp.lessonsUrl(lessonId);
}

// fallback（备用路径）
if (!url) {
  url = `./data/lessons/${lessonId}.json`;
}

  // 3) 如果仍然没有：尝试从你已有的 HSK 数据根路径拼接
  // （下面这两条你可以根据项目结构保留一种）
  if (!url) url = `./data/lessons/${lessonId}.json`;  // 相对路径（比 /data 更稳）
  // if (!url) url = `./data/hsk/lessons/${lessonId}.json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch lesson data: ${url}`);
  const json = await res.json();

// ✅ lesson pack: { lessons: [...] }
if (Array.isArray(json?.lessons)) {
  const wantedFile = `${lessonId}.json`;

  const found =
    json.lessons.find((x) => x?.file === wantedFile) ||
    json.lessons.find((x) => String(x?.id) === String(lessonId).replace(/\D/g, "")) ||
    null;

  if (!found) {
    console.warn("[wordsStep] lesson not found in pack:", lessonId, "pack size=", json.lessons.length);
    return [];
  }

  // ✅ 第二跳：拉真正的单课文件
  // packUrl 例如：./data/lessons/hsk2.0/hsk1_lessons.json
  // singleUrl 例如：./data/lessons/hsk2.0/hsk1_lesson1.json
  const packUrl = url; // 注意：这里 url 就是你 fetch 的 lessonsUrl(lessonId) 结果
  const baseDir = packUrl.slice(0, packUrl.lastIndexOf("/") + 1);
  const singleUrl = baseDir + found.file;

  const res2 = await fetch(singleUrl, { cache: "no-store" });
  if (!res2.ok) throw new Error(`Failed to fetch single lesson: ${singleUrl}`);
  const one = await res2.json();

  // ✅ 从单课里取 words
  return (
    one.words ||
    one.vocab ||
    one.wordList ||
    one.newWords ||
    one.vocabulary ||
    one.lesson?.words ||
    []
  );
}

// fallback：直接单课结构
return (
  json?.words ||
  json?.vocab ||
  json?.wordList ||
  json?.newWords ||
  json?.vocabulary ||
  []
);
}

// --- 2) Render words list into modal ---
function renderWordsFallback(words, lang) {
  const safe = (s) => String(s ?? "");

  // 尽量兼容你词条结构：{ zh, pinyin, kr } / { hanzi, pinyin, meaning } 等
  const pick = (w, keys) => {
    for (const k of keys) {
      if (w && w[k] != null && w[k] !== "") return w[k];
    }
    return "";
  };

  const title = `Words (${words.length})`;

  const itemsHtml = words
    .map((w, idx) => {
      const zh = pick(w, ["zh", "cn", "hanzi", "word", "text"]);
      const py = pick(w, ["pinyin", "py"]);
      const kr = pick(w, ["kr", "ko", "meaning", "gloss"]);
      const sub =
        lang === "kr"
          ? safe(kr || py)
          : safe(py || kr);

      return `
        <button
          class="joy-word-row"
          data-idx="${idx}"
          style="
            width:100%;
            text-align:left;
            padding:10px 12px;
            border:1px solid rgba(0,0,0,.08);
            border-radius:12px;
            background:#fff;
            margin:8px 0;
            cursor:pointer;
          "
        >
          <div style="font-size:16px; font-weight:700;">${safe(zh)}</div>
          <div style="font-size:13px; opacity:.75; margin-top:2px;">${safe(sub)}</div>
        </button>
      `;
    })
    .join("");

  const html = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="font-weight:800;">${title}</div>
        <div style="font-size:12px; opacity:.65;">Click a word to open detail</div>
      </div>
      <div id="joyWordsList">${itemsHtml}</div>
    </div>
  `;

  return { title, html };
}

function openModal({ title, html }) {
  window.dispatchEvent(
    new CustomEvent("modal:open", {
      detail: { title, html }
    })
  );
}

function openWordDetail(word, lang) {
  // A) prefer your existing word detail modal/panel if exists
  // e.g. window.WORD_PANEL.open({ word, lang })
  if (window.WORD_PANEL?.open) {
    window.WORD_PANEL.open({ word, lang });
    return;
  }
  if (window.WORD_MODAL?.open) {
    window.WORD_MODAL.open({ word, lang });
    return;
  }

  // B) otherwise dispatch event, you can connect it to your existing word-card modal
  window.dispatchEvent(
    new CustomEvent("word:open", {
      detail: { word, lang }
    })
  );
}

function bindWordClicks(words, lang) {
  const root = document.getElementById("joyWordsList");
  if (!root) return;

  root.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".joy-word-row");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const w = words[idx];
    if (!w) return;
    openWordDetail(w, lang);
  });
}

// --- 3) Public API: called by lessonStepRunner when step === "words" ---
export async function openWordsStep({ lessonId, state }) {
  const lang = getLangFromState(state);

  let words = [];
  try {
    words = await loadWordsForLesson(lessonId);
  } catch (err) {
    console.warn("[wordsStep] loadWordsForLesson failed:", err);
  }

  // 如果你已有 HSK_RENDER.renderWordCards，就用它（更漂亮）
  const canUseRenderer = window.HSK_RENDER?.renderWordCards;

  if (canUseRenderer && Array.isArray(words) && words.length) {
    // 用一个容器让 renderer 渲染，然后塞进 modal
    const containerId = "joyWordsRendererRoot";
    const title = `Words (${words.length})`;
    const html = `<div id="${containerId}"></div>`;

    openModal({ title, html });

    const root = document.getElementById(containerId);
    if (root) {
      // 点击单词：走你已有的 onClickWord 逻辑（如果你有全局处理）
      const onClickWord = (w) => openWordDetail(w, lang);
      window.HSK_RENDER.renderWordCards(root, words, onClickWord, { lang });
    }
    return;
  }

  // Fallback 渲染
  const modal = renderWordsFallback(words || [], lang);
  openModal(modal);

  // 绑定点击打开详情
  bindWordClicks(words || [], lang);
}
