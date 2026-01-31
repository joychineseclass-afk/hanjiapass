/* =========================================
   📘 HSK UI CONTROLLER (Ultimate, ESM, Low Rework)
   负责：页面交互层（连接 Loader / Renderer / History / LearnPanel）
   - URL + localStorage 同步（lv / q / lesson）
   - 支持 lessons 模式（有 lessons.json）或纯 vocab 模式
   - KO-first + 对象字段容错（meaning/example 不再崩）
========================================= */

import { createHSKHistory } from "./hskHistory.js";

/** ===============================
 * State
================================== */
let dom = {};
let current = {
  lv: "1",
  q: "",
  lesson: "", // 可选：lesson id
};

let allWords = [];      // 当前 level 全部词
let lessons = null;     // 当前 level lessons（可能为 null）
let lessonWords = [];   // 当前 lesson 下 words（如启用 lessons）

// 统一 History（URL + localStorage）
const hist = createHSKHistory({
  baseKey: "hsk",
  defaults: { lv: "1", q: "", lesson: "" },
});

/** ===============================
 * Entry
 * 由 page.hsk.js 调用
================================== */
export function initHSKUI() {
  cacheDOM();

  // 1) 读取初始状态（URL > localStorage > defaults）
  current = hist.getInitialState();

  // 2) 先把 UI 控件恢复到初始状态
  applyStateToControls(current);

  // 3) 绑定事件（用户操作 -> 渲染 + history）
  bindEvents();

  // 4) 绑定 popstate（浏览器前进/后退）
  hist.bind({
    getState: () => ({
      lv: dom.levelSelect?.value || "1",
      q: dom.searchInput?.value || "",
      lesson: current.lesson || "",
    }),
    applyState: (s) => {
      current = { ...current, ...s };
      applyStateToControls(current);
      // 注意：这里必须重新加载 level（可能不同）
      loadLevel(current.lv, { keepQuery: true });
    },
  });

  // 5) 首次加载
  loadLevel(current.lv, { keepQuery: true });
}

/** ===============================
 * DOM cache
================================== */
function cacheDOM() {
  dom.levelSelect = document.getElementById("hskLevel");
  dom.searchInput = document.getElementById("hskSearch");
  dom.grid = document.getElementById("hskGrid");
  dom.status = document.getElementById("hskStatus");
  dom.error = document.getElementById("hskError");
}

/** ===============================
 * Apply state -> controls only
================================== */
function applyStateToControls(state) {
  if (dom.levelSelect) dom.levelSelect.value = String(state.lv || "1");
  if (dom.searchInput) dom.searchInput.value = state.q || "";
}

/** ===============================
 * Events
================================== */
function bindEvents() {
  // level change
  dom.levelSelect?.addEventListener("change", (e) => {
    const lv = String(e.target.value || "1");
    current = { ...current, lv, lesson: "" }; // 切换等级默认清空 lesson
    hist.commit(current, "push");
    loadLevel(lv, { keepQuery: true });
  });

  // search input (debounce)
  let t = null;
  dom.searchInput?.addEventListener("input", (e) => {
    const q = String(e.target.value || "").trim();
    current = { ...current, q };
    // replace：避免每个字母都 push history
    hist.commit(current, "replace");

    clearTimeout(t);
    t = setTimeout(() => {
      applyFilterAndRender();
    }, 120);
  });
}

/** ===============================
 * Load Level
================================== */
async function loadLevel(lv, opts = {}) {
  const level = String(lv || "1");
  setStatus(`HSK ${level} 로딩 중…`);
  hideError();

  // 防止旧内容残留（体验更稳）
  if (dom.grid) dom.grid.innerHTML = "";

  try {
    // ✅ 统一走 window.HSK_LOADER（你现在的结构）
    const loader = window.HSK_LOADER;
    if (!loader?.loadVocab) {
      throw new Error("HSK_LOADER.loadVocab 가 없습니다. (스크립트 로딩 순서 확인)");
    }

    // 1) vocab
    allWords = await loader.loadVocab(level, { fetch: { cache: "no-store" } });

    // 2) lessons (可选)
    lessons = await loader.loadLessons(level, { fetch: { cache: "no-store" } });
    // lessons 若不存在 => null（loader 里已经做了容错）

    // 3) 如果存在 lessons，并且 URL 里带了 lesson，则尝试恢复 lesson 模式
    if (lessons && lessons.length) {
      // lessonId 可能是 "2" / "A-1" / 数字
      const lessonId = safeText(current.lesson);
      const hit = lessonId ? findLessonById(lessons, lessonId) : null;

      if (hit) {
        lessonWords = pickWordsForLesson(hit, allWords);
      } else {
        // 没有指定 / 找不到：默认显示 lesson 列表（更像“课程”）
        lessonWords = [];
      }
    } else {
      lessonWords = [];
      current = { ...current, lesson: "" };
      hist.commit(current, "replace");
    }

    // 4) 首次渲染
    applyFilterAndRender(opts);

    setStatus(`HSK ${level} 준비 완료`);
  } catch (err) {
    showError("단어 데이터를 불러오지 못했습니다.");
    console.error(err);
  }
}

/** ===============================
 * Render (lessons or cards)
================================== */
function applyFilterAndRender(opts = {}) {
  const q = safeText(current.q);
  const list = getBaseListForRender();

  // 1) lesson list mode
  if (shouldShowLessonList()) {
    renderLessonList();
    return;
  }

  // 2) vocab/lesson words mode
  const filtered = q ? filterList(list, q) : list;
  renderWordCards(filtered);

  // 3) 如果是 keepQuery：不动输入框（已恢复）
  // opts.keepQuery 仅为语义保留
}

function shouldShowLessonList() {
  // lessons 存在 && 当前没有选中任何 lesson && 没有直接词表模式要求
  if (!lessons || !lessons.length) return false;
  const hasLesson = !!safeText(current.lesson);
  return !hasLesson && lessonWords.length === 0;
}

function renderLessonList() {
  const r = window.HSK_RENDER;
  if (!r?.renderLessonList) {
    // fallback：没有 lesson renderer，就直接显示全部词
    renderWordCards(allWords);
    return;
  }

  r.renderLessonList(dom.grid, lessons, (lesson) => {
    // 选择 lesson：写入 history（push）
    current = { ...current, lesson: String(lesson.id ?? "") };
    hist.commit(current, "push");

    // 取该 lesson 对应词
    lessonWords = pickWordsForLesson(lesson, allWords);

    // 渲染词卡
    applyFilterAndRender();
  });
}

function renderWordCards(list) {
  // 兼容你旧 renderer：renderHSKGrid(dom.grid, list, onClick)
  if (typeof window.renderHSKGrid === "function") {
    window.renderHSKGrid(dom.grid, list, handleWordClick);
    return;
  }

  // 新 renderer：HSK_RENDER.renderWordCards
  const r = window.HSK_RENDER;
  if (!r?.renderWordCards) {
    throw new Error("HSK_RENDER.renderWordCards 가 없습니다. (스크립트 로딩 순서 확인)");
  }

  r.renderWordCards(dom.grid, list, handleWordClick, {
    lang: window.APP_LANG || "ko",
    showLearnBadge: true,
  });
}

/** ===============================
 * Word click -> LearnPanel
================================== */
function handleWordClick(item) {
  // 统一走事件，不再依赖 saveHistory(word)
  // LearnPanel 监听 openLearnPanel 事件即可
  window.dispatchEvent(new CustomEvent("openLearnPanel", { detail: item }));
}

/** ===============================
 * Helpers: list source
================================== */
function getBaseListForRender() {
  // 优先：lessonWords（lesson 模式）
  if (lessons && lessons.length && safeText(current.lesson)) {
    return lessonWords.length ? lessonWords : allWords;
  }
  // 默认：allWords
  return allWords;
}

function findLessonById(lessonsArr, id) {
  const key = safeText(id);
  if (!key) return null;
  return (
    lessonsArr.find((l) => String(l?.id ?? "") === key) ||
    lessonsArr.find((l) => safeText(l?.title) === key) ||
    null
  );
}

/**
 * lesson.words 可能是：
 * - ["你好","谢谢"] 这种 word 列表
 * - 或 [{word:"你好"}, ...] 这种对象
 * - 或直接就是完整词条（那就直接用）
 */
function pickWordsForLesson(lesson, vocabList) {
  const w = lesson?.words;
  if (!Array.isArray(w) || !w.length) return [];

  // 如果 lesson.words 本身是完整词条（有 word 字段并且 meaning/pinyin…），直接返回
  if (typeof w[0] === "object" && safeText(w[0]?.word)) return w;

  // 否则：把 lesson.words 当作“word 字符串数组”去 vocabList 里匹配
  const set = new Set(
    w.map((x) => (typeof x === "string" ? x : x?.word)).map((x) => safeText(x)).filter(Boolean)
  );

  if (!set.size) return [];

  // 保持 vocabList 原顺序（教材顺序稳定）
  return (vocabList || []).filter((it) => set.has(safeText(it?.word)));
}

/** ===============================
 * Filter (robust)
 * - meaning/example 可能是 object/array
================================== */
function filterList(list, keyword) {
  const q = safeText(keyword);
  const lower = q.toLowerCase();

  return (list || []).filter((it) => {
    const word = textOf(it?.word);
    const pinyin = textOf(it?.pinyin);
    const meaning = textOf(it?.meaning);
    const example = textOf(it?.example);

    return (
      word.includes(q) ||
      word.toLowerCase().includes(lower) ||
      pinyin.toLowerCase().includes(lower) ||
      meaning.toLowerCase().includes(lower) ||
      example.toLowerCase().includes(lower)
    );
  });
}

function textOf(v) {
  // 永远返回字符串（避免 [object Object]）
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(" / ");
  if (typeof v === "object") {
    // KO-first
    return (
      textOf(v.ko) ||
      textOf(v.kr) ||
      textOf(v.zh) ||
      textOf(v.cn) ||
      textOf(v.en) ||
      // 兜底：找第一个可用值
      Object.keys(v)
        .map((k) => textOf(v[k]))
        .find((t) => safeText(t)) ||
      ""
    );
  }
  return "";
}

function safeText(v) {
  return String(v ?? "").trim();
}

/** ===============================
 * UI helpers
================================== */
function setStatus(msg) {
  if (dom.status) dom.status.textContent = msg;
}

function showError(msg) {
  if (!dom.error) return;
  dom.error.classList.remove("hidden");
  dom.error.textContent = msg;
}

function hideError() {
  if (!dom.error) return;
  dom.error.classList.add("hidden");
  dom.error.textContent = "";
}
