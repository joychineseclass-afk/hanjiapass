// /ui/core/wordsStep.js
// ✅ Words Step: open real words list inside modal
// - Load words from: loader.loadLesson OR DATA_PATHS.lessonsUrl(pack) -> single lesson
// - Render:
//   A) if HSK_RENDER.renderWordCards exists -> render into modal container
//   B) fallback: simple list
// - Click word: prefer WORD_PANEL/WORD_MODAL, else dispatch "word:open"

function getLangFromState(state) {
  return (
    state?.lang ||
    localStorage.getItem("joy_lang") ||
    localStorage.getItem("site_lang") ||
    "kr"
  );
}

// --- helpers ---
const safe = (s) => String(s ?? "");
const pick = (w, keys) => {
  for (const k of keys) {
    const v = w?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
};

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
    return data?.words || data?.vocab || data?.wordList || data?.newWords || data?.vocabulary || [];
  }

  // 2) 优先：用项目内置 DATA_PATHS
  const dp = window.DATA_PATHS || null;

  let url = null;

  // 你项目里真实的是 lessonsUrl（你 console 已验证存在）
  if (typeof dp?.lessonsUrl === "function") {
    url = dp.lessonsUrl(lessonId);
  }

  // fallback（备用路径）
  if (!url) {
    url = `./data/lessons/${lessonId}.json`;
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch lesson data: ${url}`);
  const json = await res.json();

  // ✅ lesson pack: { lessons: [...] }
  if (Array.isArray(json?.lessons)) {
    const wantedFile = `${lessonId}.json`;

    const found =
      json.lessons.find((x) => x?.file === wantedFile) ||
      // 兼容：lessonId=hsk1_lesson1 -> id=1
      json.lessons.find((x) => String(x?.id) === String(lessonId).replace(/\D/g, "")) ||
      null;

    if (!found) {
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

    // 第二跳：拉真正的单课文件
    const packUrl = url; // 例如：./data/lessons/hsk2.0/hsk1_lessons.json
    const baseDir = packUrl.slice(0, packUrl.lastIndexOf("/") + 1);
    const singleUrl = baseDir + found.file; // 例如：./data/lessons/hsk2.0/hsk1_lesson1.json

    const res2 = await fetch(singleUrl, { cache: "no-store" });
    if (!res2.ok) throw new Error(`Failed to fetch single lesson: ${singleUrl}`);
    const one = await res2.json();

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

// --- 2) Modal open ---
function openModal({ title, html }) {
  window.dispatchEvent(
    new CustomEvent("modal:open", {
      detail: { title, html }
    })
  );
}

// --- 3) Word detail open ---
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
      detail: { word, lang }
    })
  );
}

// --- 4) fallback renderer ---
function renderWordsFallback(words, lang) {
  const title = `Words (${words.length})`;

  const rows = (words || []).map((w, i) => {
    const han = pick(w, ["hanzi","word","zh","cn","ch","text","simplified"]);
    const pinyin = pick(w, ["pinyin","py"]);
    const kr = pick(w, ["kr","ko","korean","meaning_kr","def_kr","gloss"]);
    const en = pick(w, ["en","eng","english","meaning_en","def_en"]);
    const meaning = (lang === "kr" ? (kr || en) : (en || kr)) || "";

    // ✅ 如果 w 本身是字符串（有些数据会这样），也能显示
    const fallbackHan = !han && typeof w === "string" ? w : "";
    const showHan = han || fallbackHan || "(?)";

    return `
      <div class="joy-word-row" data-idx="${i}"
        style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08);cursor:pointer;">
        <div style="min-width:64px;font-size:20px;font-weight:800;">${safe(showHan)}</div>
        <div style="flex:1;">
          <div style="font-size:13px;opacity:.75;">${safe(pinyin)}</div>
          <div style="font-size:14px;">${safe(meaning)}</div>
        </div>
        <div style="font-size:12px;opacity:.6;">#${i + 1}</div>
      </div>
    `;
  }).join("");

  const html = `
    <div style="padding:14px;">
      <div style="font-size:12px;opacity:.7;margin-bottom:10px;">点击单词（下一步我们接：详情卡 / 发音 / 笔顺）</div>
      <div id="joyWordsList">${rows || '<div style="opacity:.7;">(没有可显示字段)</div>'}</div>
    </div>
  `;

  return { title, html };
}

function bindWordClicks(words, lang) {
  const root = document.getElementById("joyWordsList");
  if (!root) return;

  root.addEventListener("click", (e) => {
    const row = e.target?.closest?.(".joy-word-row");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const w = words?.[idx];
    if (!w) return;
    openWordDetail(w, lang);
  });
}

// --- 5) Public API ---
export async function openWordsStep({ lessonId, state }) {
  const lang = getLangFromState(state);

  let words = [];
  try {
    words = await loadWordsForLesson(lessonId);
  } catch (err) {
    console.warn("[wordsStep] loadWordsForLesson failed:", err);
    words = [];
  }

  // ✅ 永远暴露出来，便于 console 调试
  window.__words = words;
  console.log("[wordsStep] __words length =", words?.length);
  console.log("[wordsStep] first word =", words?.[0]);

  const canUseRenderer = typeof window.HSK_RENDER?.renderWordCards === "function";

  // A) 用你已有 renderer：渲染到 modal 的容器里
  if (canUseRenderer && Array.isArray(words) && words.length) {
    const containerId = "joyWordsRendererRoot";

    openModal({
      title: `Words (${words.length})`,
      html: `<div id="${containerId}" style="padding:12px;"></div>`
    });

    // 等 modal DOM 出现再渲染（避免 root=null）
    requestAnimationFrame(() => {
      const root = document.getElementById(containerId);
      if (!root) return;
      const onClickWord = (w) => openWordDetail(w, lang);
      window.HSK_RENDER.renderWordCards(root, words, onClickWord, { lang });
    });

    return;
  }

  // B) fallback 简单列表
  const modal = renderWordsFallback(words || [], lang);
  openModal(modal);
  bindWordClicks(words || [], lang);
}
