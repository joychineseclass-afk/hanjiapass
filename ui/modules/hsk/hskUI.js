// /ui/modules/hsk/hskUI.js  (ultimate++ upgraded, module version)
// - Views: Lessons list / Lesson words / All words / Recent history
// - Search debounce, per-level cache, KO-first text handling
// - Decoupled learn panel: dispatch CustomEvent("learn:set", {detail:item})
// - Uses ESM imports (no window.HSK_LOADER/HSK_RENDER required)

import { loadHSKLevel, loadHSKLessons } from "./hskLoader.js";
import { renderLessonList, renderWordCards } from "./hskRenderer.js";
import { HSK_HISTORY } from "./hskHistory.js";

const $ = (id) => document.getElementById(id);

const CACHE_TTL = 1000 * 60 * 30; // 30min
const SEARCH_DEBOUNCE_MS = 80;

let dom = null;

// ===== state =====
let ALL = [];
let LESSONS = null;
let currentLesson = null;
let inRecentView = false;

let LESSON_INDEX = null;

// cache: level -> { ts, all, lessons, index }
const CACHE = new Map();

// ===== init =====
export function initHSKUI(opts = {}) {
  cacheDOM();

  // options
  const defaultLevel = Number(opts.defaultLevel || dom.level?.value || 1);
  const autoFocusSearch = opts.autoFocusSearch !== false;

  bindEvents({ autoFocusSearch });

  // ensure select value
  if (dom.level) dom.level.value = String(defaultLevel);

  loadLevel(String(defaultLevel), { autoFocusSearch });
}

// ===== dom =====
function cacheDOM() {
  dom = {
    level: $("hskLevel"),
    search: $("hskSearch"),
    grid: $("hskGrid"),
    error: $("hskError"),
    status: $("hskStatus"),
  };
}

// ===== UI helpers =====
function showError(msg) {
  if (!dom.error) return;
  dom.error.classList.remove("hidden");
  dom.error.textContent = msg || "";
}
function clearError() {
  if (!dom.error) return;
  dom.error.classList.add("hidden");
  dom.error.textContent = "";
}
function setStatus(s) {
  if (dom.status) dom.status.textContent = s || "";
}

function safeText(x) {
  return String(x ?? "").trim();
}
function normalizeWord(s) {
  return safeText(s).replace(/\s+/g, " ").trim();
}

function scrollToTop() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
}

function focusSearch(autoFocus) {
  if (!autoFocus) return;
  try {
    dom.search?.focus?.();
  } catch {}
}

function renderFallback(title, desc) {
  if (!dom.grid) return;
  dom.grid.innerHTML = "";
  const box = document.createElement("div");
  box.className = "hsk-card";
  box.innerHTML = `
    <div class="hsk-card-title">${escapeHtml(title)}</div>
    <div class="hsk-card-desc">${escapeHtml(desc || "")}</div>
  `;
  dom.grid.appendChild(box);
}

function renderEmptyHint(container, title, desc) {
  if (!container) return;
  const card = document.createElement("div");
  card.className = "hsk-card hsk-empty";
  card.innerHTML = `
    <div class="hsk-card-title">${escapeHtml(title)}</div>
    <div class="hsk-card-desc">${escapeHtml(desc || "")}</div>
  `;
  container.appendChild(card);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderTopBar({ title, subtitle, leftBtn, rightBtns = [] }) {
  const top = document.createElement("div");
  top.className = "hsk-topbar";

  const rightHtml = rightBtns
    .map(
      (b) =>
        `<button data-key="${b.key}" class="hsk-topbtn ${b.className || ""}">${escapeHtml(
          b.text
        )}</button>`
    )
    .join("");

  top.innerHTML = `
    <div class="hsk-topbar-left">
      <div class="hsk-topbar-title">${escapeHtml(title || "")}</div>
      <div class="hsk-topbar-sub">${escapeHtml(subtitle || "")}</div>
    </div>
    <div class="hsk-topbar-right">
      ${
        leftBtn
          ? `<button data-key="${leftBtn.key}" class="hsk-topbtn ${
              leftBtn.className || ""
            }">${escapeHtml(leftBtn.text)}</button>`
          : ""
      }
      ${rightHtml}
    </div>
  `;
  return top;
}

// ===== data helpers =====
function buildAllMap() {
  const map = new Map();
  for (const w of ALL) {
    const key = normalizeWord(w?.word);
    if (key && !map.has(key)) map.set(key, w);
  }
  return map;
}

function buildLessonWordList(lesson, allMap) {
  const raw = Array.isArray(lesson?.words) ? lesson.words : [];
  const keys = raw.map(normalizeWord).filter(Boolean);

  // ⚠️ 你原来用 Set 去重，会打乱“教材重复出现”的情况；这里保留顺序 + 去重
  const seen = new Set();
  const orderedUnique = [];
  for (const k of keys) {
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    orderedUnique.push(k);
  }

  const list = [];
  let missing = 0;

  for (const k of orderedUnique) {
    const found = allMap.get(k);
    if (found) list.push(found);
    else missing++;
  }
  return { list, missing };
}

function pickText(v) {
  // ✅ 永远不返回 [object Object]
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) return v.map(pickText).filter(Boolean).join(" / ");

  if (typeof v === "object") {
    return (
      pickText(v.ko) ||
      pickText(v.kr) ||
      pickText(v.zh) ||
      pickText(v.cn) ||
      pickText(v.en) ||
      ""
    );
  }
  return "";
}

function filterWordList(list, q) {
  const qq = safeText(q).toLowerCase();
  if (!qq) return list;

  return (list || []).filter((x) => {
    const blob = `${safeText(x.word)} ${safeText(x.pinyin)} ${pickText(
      x.meaning
    )} ${pickText(x.example)}`.toLowerCase();
    return blob.includes(qq);
  });
}

// ===== lesson index (for searching lessons by title/words) =====
function buildLessonIndex() {
  if (!Array.isArray(LESSONS) || LESSONS.length === 0) {
    LESSON_INDEX = null;
    return;
  }

  const allMap = buildAllMap();

  const lessons = LESSONS.map((lesson, idx) => {
    const title = safeText(lesson?.title) || `Lesson ${lesson?.id ?? idx + 1}`;
    const subtitle = safeText(lesson?.subtitle);

    const { list, missing } = buildLessonWordList(lesson, allMap);

    const wordsBlob = list
      .map((w) => `${safeText(w.word)} ${safeText(w.pinyin)} ${pickText(w.meaning)} ${pickText(w.example)}`)
      .join(" | ");

    const blob = `${title} ${subtitle} ${wordsBlob}`.toLowerCase();

    return {
      idx,
      key: lesson?.id ?? idx,
      lesson,
      wordsResolved: list,
      missing,
      blob,
    };
  });

  LESSON_INDEX = { lessons };
}

function getLessonMatches(query) {
  if (!LESSON_INDEX?.lessons) return [];
  const q = safeText(query).toLowerCase();

  if (!q) {
    return LESSON_INDEX.lessons.map((it) => ({
      ...it,
      matchCount: it.wordsResolved.length,
      hitType: "all",
    }));
  }

  return LESSON_INDEX.lessons
    .filter((it) => it.blob.includes(q))
    .map((it) => {
      const matchCount = it.wordsResolved.reduce((acc, w) => {
        const wb = `${safeText(w.word)} ${safeText(w.pinyin)} ${pickText(w.meaning)} ${pickText(w.example)}`.toLowerCase();
        return acc + (wb.includes(q) ? 1 : 0);
      }, 0);
      return { ...it, matchCount, hitType: matchCount > 0 ? "words" : "title" };
    });
}

// ===== view: recent =====
function renderRecentView() {
  if (!dom.grid) return;

  inRecentView = true;
  currentLesson = null;

  const q = safeText(dom.search?.value);
  const recent = HSK_HISTORY.list(); // newest -> older
  const filtered = filterWordList(recent, q);

  dom.grid.innerHTML = "";

  const top = renderTopBar({
    title: "최근 학습",
    subtitle: q ? `검색: "${q}"` : "최근에 학습한 단어를 다시 확인해요",
    leftBtn: { key: "backMain", text: "← 돌아가기" },
    rightBtns: [{ key: "clearRecent", text: "기록 지우기" }],
  });
  dom.grid.appendChild(top);

  top.querySelector(`[data-key="backMain"]`)?.addEventListener("click", () => {
    inRecentView = false;
    renderAuto();
    scrollToTop();
    focusSearch(true);
  });

  top.querySelector(`[data-key="clearRecent"]`)?.addEventListener("click", () => {
    HSK_HISTORY.clear();
    renderRecentView();
    scrollToTop();
    focusSearch(true);
  });

  const wrap = document.createElement("div");
  wrap.className = "hsk-grid";
  dom.grid.appendChild(wrap);

  if (recent.length === 0) {
    renderEmptyHint(
      wrap,
      "최근 학습 기록이 없어요",
      "단어 카드를 눌러 학습하면 여기에 자동으로 저장됩니다."
    );
    setStatus("(0)");
    return;
  }

  if (filtered.length === 0) {
    renderEmptyHint(
      wrap,
      "검색 결과가 없어요",
      "검색어를 지우면 최근 학습 단어가 다시 표시됩니다."
    );
    setStatus(`(0/${recent.length})`);
    return;
  }

  renderWordCards(wrap, filtered, onWordClick, {
    lang: "ko",
    query: q,
    showTag: "학습",
    compact: false,
  });

  setStatus(`(${filtered.length}/${recent.length})`);
}

// ===== view: lessons list =====
function renderLessonsView() {
  if (!dom.grid) return;

  if (!Array.isArray(LESSONS) || LESSONS.length === 0) {
    renderAllWordsView();
    return;
  }

  inRecentView = false;

  const q = safeText(dom.search?.value);
  const matches = getLessonMatches(q);

  dom.grid.innerHTML = "";

  const top = renderTopBar({
    title: "수업 목록",
    subtitle: `HSK ${dom.level?.value || ""}` + (q ? ` · 검색: "${q}"` : ""),
    rightBtns: [
      { key: "recent", text: "최근 학습" },
      { key: "goAll", text: "전체 단어 보기" },
    ],
  });
  dom.grid.appendChild(top);

  top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
    renderRecentView();
    scrollToTop();
    focusSearch(true);
  });

  top.querySelector(`[data-key="goAll"]`)?.addEventListener("click", () => {
    currentLesson = null;
    renderAllWordsView();
    scrollToTop();
    focusSearch(true);
  });

  const wrap = document.createElement("div");
  wrap.className = "hsk-list";
  dom.grid.appendChild(wrap);

  if (matches.length === 0) {
    renderEmptyHint(
      wrap,
      "검색 결과가 없어요",
      "다른 키워드로 검색해 보세요.\n예) 중국어 / 병음 / 뜻 / 예문 일부"
    );
    setStatus(`(0/${LESSONS.length})`);
    return;
  }

  const meta = new Map();
  matches.forEach((it) => {
    const badge =
      q && it.hitType === "words"
        ? `매칭 ${it.matchCount}개`
        : q && it.hitType === "title"
        ? `제목/설명 매칭`
        : `단어 ${it.wordsResolved.length}개`;

    meta.set(it.key, {
      rightText: badge,
      missing: it.missing || 0,
    });
  });

  const lessonObjs = matches.map((x) => x.lesson);

  renderLessonList(wrap, lessonObjs, (lesson) => {
    currentLesson = lesson;
    renderLessonWordsView();
    scrollToTop();
    focusSearch(true);
  }, { meta, query: q, lang: "ko", showBadge: true });

  setStatus(`(${matches.length}/${LESSONS.length})`);
}

// ===== view: lesson words =====
function renderLessonWordsView() {
  if (!dom.grid) return;

  inRecentView = false;

  const q = safeText(dom.search?.value);
  const allMap = buildAllMap();
  const { list: lessonWords, missing } = buildLessonWordList(currentLesson, allMap);
  const filtered = filterWordList(lessonWords, q);

  dom.grid.innerHTML = "";

  const top = renderTopBar({
    title: safeText(currentLesson?.title) || "Lesson",
    subtitle:
      safeText(currentLesson?.subtitle || "") +
      (missing ? ` · ⚠️ 누락 ${missing}개` : "") +
      (q ? ` · 검색: "${q}"` : ""),
    leftBtn: { key: "backLessons", text: "← 수업 목록" },
    rightBtns: [
      { key: "recent", text: "최근 학습" },
      { key: "goAll", text: "전체 단어 보기" },
    ],
  });
  dom.grid.appendChild(top);

  top.querySelector(`[data-key="backLessons"]`)?.addEventListener("click", () => {
    currentLesson = null;
    renderLessonsView();
    scrollToTop();
    focusSearch(true);
  });

  top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
    renderRecentView();
    scrollToTop();
    focusSearch(true);
  });

  top.querySelector(`[data-key="goAll"]`)?.addEventListener("click", () => {
    currentLesson = null;
    renderAllWordsView();
    scrollToTop();
    focusSearch(true);
  });

  const wrap = document.createElement("div");
  wrap.className = "hsk-grid";
  dom.grid.appendChild(wrap);

  if (filtered.length === 0) {
    renderEmptyHint(
      wrap,
      "이 수업에서 검색 결과가 없어요",
      "검색어를 바꾸거나, 검색어를 지워서 전체 단어를 확인해 보세요."
    );
    setStatus(`(0/${lessonWords.length})`);
    return;
  }

  renderWordCards(wrap, filtered, onWordClick, {
    lang: "ko",
    query: q,
    showTag: "학습",
    compact: false,
  });

  setStatus(`(${filtered.length}/${lessonWords.length})`);
}

// ===== view: all words =====
function renderAllWordsView() {
  if (!dom.grid) return;

  inRecentView = false;

  const q = safeText(dom.search?.value);
  const filtered = filterWordList(ALL, q);
  const inLessonMode = Array.isArray(LESSONS) && LESSONS.length > 0;

  dom.grid.innerHTML = "";

  const top = renderTopBar({
    title: "전체 단어",
    subtitle: `HSK ${dom.level?.value || ""}` + (q ? ` · 검색: "${q}"` : ""),
    leftBtn: inLessonMode ? { key: "backLessons", text: "← 수업 목록" } : null,
    rightBtns: [{ key: "recent", text: "최근 학습" }],
  });
  dom.grid.appendChild(top);

  top.querySelector(`[data-key="backLessons"]`)?.addEventListener("click", () => {
    currentLesson = null;
    renderLessonsView();
    scrollToTop();
    focusSearch(true);
  });

  top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
    renderRecentView();
    scrollToTop();
    focusSearch(true);
  });

  const wrap = document.createElement("div");
  wrap.className = "hsk-grid";
  dom.grid.appendChild(wrap);

  if (filtered.length === 0) {
    renderEmptyHint(
      wrap,
      "검색 결과가 없어요",
      "다른 키워드로 검색해 보세요.\n예) 중국어 / 병음 / 뜻 / 예문 일부"
    );
    setStatus(`(0/${ALL.length})`);
    return;
  }

  renderWordCards(wrap, filtered, onWordClick, {
    lang: "ko",
    query: q,
    showTag: "학습",
    compact: false,
  });

  setStatus(`(${filtered.length}/${ALL.length})`);
}

// ===== auto route =====
function renderAuto() {
  if (inRecentView) return renderRecentView();

  if (Array.isArray(LESSONS) && LESSONS.length > 0) {
    if (currentLesson) return renderLessonWordsView();
    return renderLessonsView();
  }
  return renderAllWordsView();
}

// ===== cache =====
function getCached(level) {
  const hit = CACHE.get(level);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) {
    CACHE.delete(level);
    return null;
  }
  return hit;
}

function setCached(level, all, lessons, index) {
  CACHE.set(String(level), { all, lessons, index, ts: Date.now() });
}

// ===== loading =====
function setLoadingUI() {
  renderFallback("불러오는 중...", "데이터를 가져오고 있어요.");
  setStatus("(loading...)");
}

async function loadLevel(level, { autoFocusSearch = true } = {}) {
  clearError();
  setLoadingUI();

  currentLesson = null;
  inRecentView = false;

  try {
    const cached = getCached(level);
    if (cached) {
      ALL = cached.all || [];
      LESSONS = cached.lessons || null;
      LESSON_INDEX = cached.index || null;
      renderAuto();
      scrollToTop();
      focusSearch(autoFocusSearch);
      return;
    }

    // vocab + lessons
    ALL = await loadHSKLevel(level, { koFirst: true });

    // lessons.json may not exist => null
    LESSONS = await loadHSKLessons(level, { allowMissing: true });

    buildLessonIndex();
    setCached(level, ALL, LESSONS, LESSON_INDEX);

    renderAuto();
    scrollToTop();
    focusSearch(autoFocusSearch);
  } catch (e) {
    showError(`HSK ${level} 데이터를 불러오지 못했어요.\n에러: ${e?.message || e}`);
    setStatus("");
  }
}

// ===== click word =====
function onWordClick(item) {
  // 1) history
  try { HSK_HISTORY.add(item); } catch {}

  // 2) open learn panel (decoupled)
  window.dispatchEvent(new CustomEvent("learn:set", { detail: item }));
}

// ===== search debounce =====
let debounceTimer = null;
function onSearchChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    renderAuto();
  }, SEARCH_DEBOUNCE_MS);
}

// ===== events =====
let bound = false;
function bindEvents({ autoFocusSearch }) {
  if (bound) return;
  bound = true;

  dom.level?.addEventListener("change", () => {
    loadLevel(dom.level.value, { autoFocusSearch });
  });

  dom.search?.addEventListener("input", onSearchChange);
}
