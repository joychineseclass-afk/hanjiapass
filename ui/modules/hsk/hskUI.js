// /ui/modules/hsk/hskUI.js
// ✅ HSK UI (ESM) — exports initHSKUI()
// Depends on globals: window.HSK_LOADER / window.HSK_RENDER / window.HSK_HISTORY / window.LEARN_PANEL

export function initHSKUI(opts = {}) {
  const $ = (id) => document.getElementById(id);

  const hskLevel = $("hskLevel");
  const hskSearch = $("hskSearch");
  const hskGrid = $("hskGrid");
  const hskError = $("hskError");
  const hskStatus = $("hskStatus");
  const hskVersion = $("hskVersion");

  // ✅ vocab version dropdown
  if (hskVersion) {
    const saved = localStorage.getItem("hsk_vocab_version") || "hsk2.0";
    hskVersion.value = saved;

    hskVersion.addEventListener("change", async () => {
      localStorage.setItem("hsk_vocab_version", hskVersion.value);
      // ✅ PATCH: 切换版本后清理当前 level 缓存，避免拿到旧版本缓存
      try {
        CACHE.clear();
      } catch {}
      // 重新加载当前等级数据
      hskLevel?.dispatchEvent(new Event("change"));
    });
  }

  const LANG = opts.lang || "kr";
  const AUTO_FOCUS_SEARCH = !!opts.autoFocusSearch;

  let ALL = [];
  let LESSONS = null;
  let currentLesson = null;
  let inRecentView = false;

  const CACHE = new Map();
  const CACHE_TTL = 1000 * 60 * 30;

  let LESSON_INDEX = null;
  let debounceTimer = null;

  // ===== helpers =====
  function showError(msg) {
    if (!hskError) return;
    hskError.classList.remove("hidden");
    hskError.textContent = msg;
  }
  function clearError() {
    if (!hskError) return;
    hskError.classList.add("hidden");
    hskError.textContent = "";
  }
  function setStatus(s) {
    if (hskStatus) hskStatus.textContent = s || "";
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
  function focusSearch() {
    if (!AUTO_FOCUS_SEARCH) return;
    try {
      hskSearch?.focus?.();
    } catch {}
  }

  function renderFallback(title, desc) {
    if (!hskGrid) return;
    hskGrid.innerHTML = "";
    const box = document.createElement("div");
    box.className = "bg-white rounded-2xl shadow p-4";
    box.innerHTML = `
      <div class="text-lg font-semibold">${title}</div>
      <div class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">${desc || ""}</div>
    `;
    hskGrid.appendChild(box);
  }

  function renderEmptyHint(container, title, desc) {
    if (!container) return;
    const card = document.createElement("div");
    card.className = "bg-white rounded-2xl shadow p-4 text-sm text-gray-600";
    card.innerHTML = `
      <div class="font-semibold text-gray-800">${title}</div>
      <div class="mt-1 whitespace-pre-wrap">${desc || ""}</div>
    `;
    container.appendChild(card);
  }

  function renderTopBar({ title, subtitle, leftBtn, rightBtns = [] }) {
    const top = document.createElement("div");
    top.className =
      "bg-white rounded-2xl shadow p-4 mb-3 flex items-center justify-between gap-2";

    const rightHtml = rightBtns
      .map(
        (b) =>
          `<button data-key="${b.key}" class="px-3 py-2 rounded-lg ${
            b.className || "bg-slate-100"
          } text-sm">${b.text}</button>`
      )
      .join("");

    top.innerHTML = `
      <div>
        <div class="text-lg font-semibold">${title || ""}</div>
        <div class="text-sm text-gray-600 mt-1">${subtitle || ""}</div>
      </div>
      <div class="flex gap-2 items-center">
        ${
          leftBtn
            ? `<button data-key="${leftBtn.key}" class="px-3 py-2 rounded-lg ${
                leftBtn.className || "bg-slate-100"
              } text-sm">${leftBtn.text}</button>`
            : ""
        }
        ${rightHtml}
      </div>
    `;
    return top;
  }

  // ===== ✅ PATCH:统一获取当前 version =====
  function getVersion() {
    return (
      safeText(hskVersion?.value) ||
      safeText(localStorage.getItem("hsk_vocab_version")) ||
      safeText(window.APP_VOCAB_VERSION) ||
      "hsk2.0"
    );
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
    const set = new Set(keys);

    const list = [];
    let missing = 0;
    for (const k of set) {
      const found = allMap.get(k);
      if (found) list.push(found);
      else missing++;
    }
    return { list, missing };
  }

  function filterWordList(list, q) {
    const qq = safeText(q).toLowerCase();
    if (!qq) return list;

    return list.filter((x) => {
      const blob = `${x.word ?? ""} ${x.pinyin ?? ""} ${JSON.stringify(
        x.meaning ?? ""
      )} ${JSON.stringify(x.example ?? "")}`.toLowerCase();
      return blob.includes(qq);
    });
  }

  function buildLessonIndex() {
    if (!Array.isArray(LESSONS) || LESSONS.length === 0) {
      LESSON_INDEX = null;
      return;
    }

    const allMap = buildAllMap();
    const lessons = LESSONS.map((lesson, idx) => {
      // title 可能是 {zh,kr}，这里保持原逻辑不删
      const title = safeText(lesson?.title) || `Lesson ${lesson?.id ?? idx + 1}`;
      const subtitle = safeText(lesson?.subtitle);

      const { list, missing } = buildLessonWordList(lesson, allMap);

      const wordsBlob = list
        .map(
          (w) =>
            `${w.word ?? ""} ${w.pinyin ?? ""} ${JSON.stringify(
              w.meaning ?? ""
            )} ${JSON.stringify(w.example ?? "")}`
        )
        .join(" | ");

      const blob = `${title} ${subtitle} ${wordsBlob}`.toLowerCase();

      return { idx, key: lesson?.id ?? idx, lesson, wordsResolved: list, missing, blob };
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
          const wb = `${w.word ?? ""} ${w.pinyin ?? ""} ${JSON.stringify(
            w.meaning ?? ""
          )} ${JSON.stringify(w.example ?? "")}`.toLowerCase();
          return acc + (wb.includes(q) ? 1 : 0);
        }, 0);
        return { ...it, matchCount, hitType: matchCount > 0 ? "words" : "title" };
      });
  }

  // ===== views =====
  function renderRecentView() {
    if (!hskGrid) return;

    if (!window.HSK_RENDER?.renderWordCards) {
      renderFallback("렌더러가 없어요", "HSK_RENDER.renderWordCards 가 없습니다.");
      setStatus("");
      return;
    }

    inRecentView = true;
    currentLesson = null;

    const q = safeText(hskSearch?.value);
    const recent = window.HSK_HISTORY?.list?.() || [];
    const filtered = filterWordList(recent, q);

    hskGrid.innerHTML = "";

    const top = renderTopBar({
      title: "최근 학습",
      subtitle: q ? `검색: "${q}"` : "최근에 학습한 단어를 다시 확인해요",
      leftBtn: { key: "backMain", text: "← 돌아가기" },
      rightBtns: [{ key: "clearRecent", text: "기록 지우기" }],
    });
    hskGrid.appendChild(top);

    top.querySelector(`[data-key="backMain"]`)?.addEventListener("click", () => {
      inRecentView = false;
      renderAuto();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="clearRecent"]`)?.addEventListener("click", () => {
      window.HSK_HISTORY?.clear?.();
      renderRecentView();
      scrollToTop();
      focusSearch();
    });

    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    hskGrid.appendChild(wrap);

    if (recent.length === 0) {
      renderEmptyHint(wrap, "최근 학습 기록이 없어요", "단어 카드를 눌러 학습하면 여기에 자동 저장됩니다.");
      setStatus("(0)");
      return;
    }

    if (filtered.length === 0) {
      renderEmptyHint(wrap, "검색 결과가 없어요", "검색어를 지우면 최근 학습 단어가 다시 표시됩니다.");
      setStatus(`(0/${recent.length})`);
      return;
    }

    window.HSK_RENDER.renderWordCards(
      wrap,
      filtered,
      (item) => window.LEARN_PANEL?.open?.(item),
      { lang: LANG, query: q, showTag: "학습", compact: false }
    );

    setStatus(`(${filtered.length}/${recent.length})`);
  }

  function renderLessonsView() {
    if (!hskGrid) return;

    if (!window.HSK_RENDER?.renderLessonList) {
      renderFallback("렌더러가 없어요", "HSK_RENDER.renderLessonList 가 없습니다.");
      setStatus("");
      return;
    }

    if (!Array.isArray(LESSONS) || LESSONS.length === 0) {
  renderFallback("수업 데이터가 없어요", "lessons 파일을 확인해 주세요.");
  return;
}

    inRecentView = false;

    const q = safeText(hskSearch?.value);
    const matches = getLessonMatches(q);

    hskGrid.innerHTML = "";

    const top = renderTopBar({
      title: "수업 목록",
      subtitle: `HSK ${hskLevel?.value || ""}` + (q ? ` · 검색: "${q}"` : ""),
      rightBtns: [
        { key: "recent", text: "최근 학습" },
        { key: "goAll", text: "전체 단어 보기" },
      ],
    });
    hskGrid.appendChild(top);

    top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
      renderRecentView();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="goAll"]`)?.addEventListener("click", () => {
      currentLesson = null;
      renderAllWordsView();
      scrollToTop();
      focusSearch();
    });

    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-1 gap-2";
    hskGrid.appendChild(wrap);

    if (matches.length === 0) {
      renderEmptyHint(wrap, "검색 결과가 없어요", "다른 키워드로 검색해 보세요.");
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

      meta.set(it.key, { rightText: badge, missing: it.missing || 0 });
    });

    const lessonObjs = matches.map((x) => x.lesson);

    window.HSK_RENDER.renderLessonList(
      wrap,
      lessonObjs,
      (lesson) => {
        currentLesson = lesson;
        renderLessonWordsView();
        scrollToTop();
        focusSearch();
      },
      { lang: LANG, query: q, meta, showBadge: true }
    );

    setStatus(`(${matches.length}/${LESSONS.length})`);
  }

  function renderLessonWordsView() {
    if (!hskGrid) return;

    if (!window.HSK_RENDER?.renderWordCards) {
      renderFallback("렌더러가 없어요", "HSK_RENDER.renderWordCards 가 없습니다.");
      setStatus("");
      return;
    }

    inRecentView = false;

    const q = safeText(hskSearch?.value);
    const allMap = buildAllMap();
    const { list: lessonWords, missing } = buildLessonWordList(currentLesson, allMap);
    const filtered = filterWordList(lessonWords, q);

    hskGrid.innerHTML = "";

    const top = renderTopBar({
      title: currentLesson?.title || "Lesson",
      subtitle:
        (currentLesson?.subtitle || "") +
        (missing ? ` · ⚠️ 누락 ${missing}개` : "") +
        (q ? ` · 검색: "${q}"` : ""),
      leftBtn: { key: "backLessons", text: "← 수업 목록" },
      rightBtns: [
        { key: "recent", text: "최근 학습" },
        { key: "goAll", text: "전체 단어 보기" },
      ],
    });
    hskGrid.appendChild(top);

    top.querySelector(`[data-key="backLessons"]`)?.addEventListener("click", () => {
      currentLesson = null;
      renderLessonsView();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
      renderRecentView();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="goAll"]`)?.addEventListener("click", () => {
      currentLesson = null;
      renderAllWordsView();
      scrollToTop();
      focusSearch();
    });

    const cardWrap = document.createElement("div");
    cardWrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    hskGrid.appendChild(cardWrap);

    if (filtered.length === 0) {
      renderEmptyHint(cardWrap, "이 수업에서 검색 결과가 없어요", "검색어를 바꾸거나 지워 보세요.");
      setStatus(`(0/${lessonWords.length})`);
      return;
    }

    window.HSK_RENDER.renderWordCards(
      cardWrap,
      filtered,
      (item) => window.LEARN_PANEL?.open?.(item),
      { lang: LANG, query: q, showTag: "학습", compact: false }
    );

    setStatus(`(${filtered.length}/${lessonWords.length})`);
  }

  function renderAllWordsView() {
    if (!hskGrid) return;

    if (!window.HSK_RENDER?.renderWordCards) {
      renderFallback("렌더러가 없어요", "HSK_RENDER.renderWordCards 가 없습니다.");
      setStatus("");
      return;
    }

    inRecentView = false;

    const q = safeText(hskSearch?.value);
    const filtered = filterWordList(ALL, q);
    const inLessonMode = Array.isArray(LESSONS) && LESSONS.length > 0;

    hskGrid.innerHTML = "";

    const top = renderTopBar({
      title: "전체 단어",
      subtitle: `HSK ${hskLevel?.value || ""}` + (q ? ` · 검색: "${q}"` : ""),
      leftBtn: inLessonMode ? { key: "backLessons", text: "← 수업 목록" } : null,
      rightBtns: [{ key: "recent", text: "최근 학습" }],
    });
    hskGrid.appendChild(top);

    top.querySelector(`[data-key="backLessons"]`)?.addEventListener("click", () => {
      currentLesson = null;
      renderLessonsView();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
      renderRecentView();
      scrollToTop();
      focusSearch();
    });

    const cardWrap = document.createElement("div");
    cardWrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    hskGrid.appendChild(cardWrap);

    if (filtered.length === 0) {
      renderEmptyHint(cardWrap, "검색 결과가 없어요", "다른 키워드로 검색해 보세요.");
      setStatus(`(0/${ALL.length})`);
      return;
    }

    window.HSK_RENDER.renderWordCards(
      cardWrap,
      filtered,
      (item) => window.LEARN_PANEL?.open?.(item),
      { lang: LANG, query: q, showTag: "학습", compact: false }
    );

    setStatus(`(${filtered.length}/${ALL.length})`);
  }

  function renderAuto() {
    if (inRecentView) return renderRecentView();
    if (Array.isArray(LESSONS) && LESSONS.length > 0) {
      if (currentLesson) return renderLessonWordsView();
      return renderLessonsView();
    }
    return renderAllWordsView();
  }

  // ===== cache =====
  function getCached(level, version) {
    const key = `${version}:${level}`; // ✅ PATCH
    const hit = CACHE.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL) {
      CACHE.delete(key);
      return null;
    }
    return hit;
  }
  function setCached(level, version, all, lessons, index) {
    const key = `${version}:${level}`; // ✅ PATCH
    CACHE.set(key, { all, lessons, index, ts: Date.now() });
  }

  // ===== loading =====
  function setLoadingUI() {
    renderFallback("불러오는 중...", "데이터를 가져오고 있어요.");
    setStatus("(loading...)");
  }

  async function loadLevel(level) {
    clearError();
    setLoadingUI();
    currentLesson = null;
    inRecentView = false;

    if (!window.HSK_LOADER?.loadVocab) {
      showError("HSK_LOADER.loadVocab 가 없어요. loader 스크립트 로드 상태를 확인해 주세요.");
      setStatus("");
      return;
    }

    try {
      const lv = safeText(level || "1");
      const version = getVersion(); // ✅ PATCH: 当前版本
      const cached = getCached(lv, version); // ✅ PATCH
      if (cached) {
        ALL = cached.all || [];
        LESSONS = cached.lessons || null;
        LESSON_INDEX = cached.index || null;
        renderAuto();
        scrollToTop();
        focusSearch();
        return;
      }

      // ✅ PATCH: 把 version 传进 loader，保证走 /data/vocab/<ver>/ & /data/lessons/<ver>/
      ALL = await window.HSK_LOADER.loadVocab(lv, { version });
      LESSONS = window.HSK_LOADER.loadLessons
        ? await window.HSK_LOADER.loadLessons(lv, { version })
        : null;

      buildLessonIndex();
      setCached(lv, version, ALL, LESSONS, LESSON_INDEX); // ✅ PATCH

      renderAuto();
      scrollToTop();
      focusSearch();
    } catch (e) {
      showError(`HSK ${level} 데이터를 불러오지 못했어요.\n에러: ${e?.message || e}`);
      setStatus("");
    }
  }

  function onSearchChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderAuto(), 80);
  }

  // ===== bind events =====
  const onLevelChange = () => loadLevel(hskLevel?.value);
  hskLevel?.addEventListener("change", onLevelChange);
  hskSearch?.addEventListener("input", onSearchChange);

  // init
  loadLevel(String(opts.defaultLevel || hskLevel?.value || "1"));

  return {
    destroy() {
      clearTimeout(debounceTimer);
      hskLevel?.removeEventListener("change", onLevelChange);
      hskSearch?.removeEventListener("input", onSearchChange);
    },
  };
}
