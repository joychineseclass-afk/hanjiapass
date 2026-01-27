// ui/hskUI.js
(function () {
  const $ = (id) => document.getElementById(id);

  const hskLevel = $("hskLevel");
  const hskSearch = $("hskSearch");
  const hskGrid = $("hskGrid");
  const hskError = $("hskError");
  const hskStatus = $("hskStatus");

  let ALL = []; // 全部单词（当前 level）
  let LESSONS = null; // 课程结构（10课制）
  let currentLesson = null; // 当前课对象

  function showError(msg) {
    hskError?.classList.remove("hidden");
    if (hskError) hskError.textContent = msg;
  }
  function clearError() {
    hskError?.classList.add("hidden");
    if (hskError) hskError.textContent = "";
  }

  function setStatus(s) {
    if (hskStatus) hskStatus.textContent = s || "";
  }

  // 根据 lesson.words（字符串数组）在 ALL 里找对应单词对象
  function buildLessonWordList(lesson) {
    const set = new Set((lesson?.words || []).map((x) => String(x).trim()).filter(Boolean));
    if (set.size === 0) return [];
    return ALL.filter((w) => set.has(w.word));
  }

  function filterList(list) {
    const q = (hskSearch?.value || "").trim().toLowerCase();
    if (!q) return list;

    return list.filter((x) => {
      const blob = `${x.word} ${x.pinyin} ${x.meaning} ${x.example}`.toLowerCase();
      return blob.includes(q);
    });
  }

  function renderLessonsView() {
    hskGrid.innerHTML = "";
    setStatus("수업 목록");

    window.HSK_RENDER?.renderLessonList(hskGrid, LESSONS, (lesson) => {
      currentLesson = lesson;
      renderLessonWordsView();
    });
  }

  function renderLessonWordsView() {
    const lessonWords = buildLessonWordList(currentLesson);
    const filtered = filterList(lessonWords);

    hskGrid.innerHTML = "";

    // 顶部返回按钮 + 标题
    const top = document.createElement("div");
    top.className = "bg-white rounded-2xl shadow p-4 mb-3 flex items-center justify-between gap-2";

    top.innerHTML = `
      <div>
        <div class="text-lg font-semibold">${currentLesson?.title || "Lesson"}</div>
        <div class="text-sm text-gray-600 mt-1">${currentLesson?.subtitle || ""}</div>
      </div>
      <div class="flex gap-2">
        <button id="btnBackLessons" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">← 수업 목록</button>
      </div>
    `;
    hskGrid.appendChild(top);

    top.querySelector("#btnBackLessons")?.addEventListener("click", () => {
      currentLesson = null;
      renderLessonsView();
    });

    // 单词卡
    const cardWrap = document.createElement("div");
    cardWrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    hskGrid.appendChild(cardWrap);

    window.HSK_RENDER?.renderWordCards(cardWrap, filtered, (item) => {
      window.LEARN_PANEL?.open?.(item);
    });

    setStatus(`(${filtered.length}/${lessonWords.length})`);
  }

  function renderAllWordsView() {
    // 没有 lessons.json 的情况：直接显示全部单词卡（保留你原本体验）
    const filtered = filterList(ALL);
    setStatus(`(${filtered.length}/${ALL.length})`);
    window.HSK_RENDER?.renderWordCards(hskGrid, filtered, (item) => {
      window.LEARN_PANEL?.open?.(item);
    });
  }

  async function loadLevel(level) {
    clearError();
    setStatus("(loading...)");
    hskGrid.innerHTML = "";

    try {
      ALL = await window.HSK_LOADER.loadVocab(level);
      LESSONS = await window.HSK_LOADER.loadLessons(level);

      // ✅ 有课程：先显示“课程列表”
      if (Array.isArray(LESSONS) && LESSONS.length > 0) {
        currentLesson = null;
        renderLessonsView();
      } else {
        // ✅ 没课程：退回“全部单词卡模式”
        renderAllWordsView();
      }
    } catch (e) {
      showError(
        `HSK ${level} 데이터를 불러오지 못했어요.\n` +
          `에러: ${e.message}`
      );
      setStatus("");
    }
  }

  function onSearchChange() {
    // 课程模式：在本课里筛选
    if (Array.isArray(LESSONS) && LESSONS.length > 0) {
      if (currentLesson) renderLessonWordsView();
      else renderLessonsView(); // 课程列表不用筛（你要筛的话我下次加）
    } else {
      renderAllWordsView();
    }
  }

  // events
  hskLevel?.addEventListener("change", () => loadLevel(hskLevel.value));
  hskSearch?.addEventListener("input", onSearchChange);

  // init
  loadLevel(hskLevel?.value || "1");
})();
