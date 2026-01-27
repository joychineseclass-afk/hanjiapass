// ui/hskUI.js
(function () {
  const $ = (id) => document.getElementById(id);

  const hskLevel = $("hskLevel");
  const hskSearch = $("hskSearch");
  const hskGrid = $("hskGrid");
  const hskError = $("hskError");
  const hskStatus = $("hskStatus");

  const learnPanel = $("learn-panel");
  const learnBody = $("learnBody");
  const learnClose = $("learnClose");

  let VOCAB_ALL = [];
  let LESSONS_ALL = [];
  let CURRENT_VIEW = "lessons"; // "lessons" | "lesson"
  let CURRENT_LESSON_ID = null;

  // ---------- UI helpers ----------
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
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
  function isHan(ch) {
    return /[\u3400-\u9FFF]/.test(ch);
  }

  // 兼容不同词库字段（你以后换 JSON 结构也不怕）
  function normalizeVocabItem(raw) {
    const word =
      raw.word || raw.hanzi || raw.zh || raw.chinese || raw.text || raw.term || "";
    const pinyin = raw.pinyin || raw.py || raw.pron || "";
    // ✅ 韩语优先：ko/kr
    const ko =
      raw.ko || raw.kr || raw.korean || raw.meaning_ko || raw.translation_ko || "";
    // 兼容旧字段 meaning（但不优先）
    const meaning =
      ko || raw.meaning || raw.translation || raw.en || raw.def || "";

    const example_zh = raw.example_zh || raw.example || raw.sentence || raw.eg || "";
    const example_pinyin = raw.example_pinyin || "";
    const example_ko = raw.example_ko || "";

    return { raw, word, pinyin, ko, meaning, example_zh, example_pinyin, example_ko };
  }

  function normalizeLessonFile(data) {
    // lessons 文件结构：{ lessons:[...] } 或直接数组
    const lessons = Array.isArray(data) ? data : (data.lessons || []);
    return lessons
      .map((l) => ({
        id: l.id ?? l.lesson ?? l.no,
        title_ko: l.title_ko || l.titleKr || l.title || "",
        title_zh: l.title_zh || l.titleZh || "",
        vocab: Array.isArray(l.vocab) ? l.vocab : [],
        dialogue: Array.isArray(l.dialogue) ? l.dialogue : [],
        practice: Array.isArray(l.practice) ? l.practice : [],
      }))
      .filter((l) => l.id != null);
  }

  // ---------- Render: Lessons list ----------
  function renderLessonList(lessons) {
    CURRENT_VIEW = "lessons";
    CURRENT_LESSON_ID = null;

    hskGrid.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    hskGrid.appendChild(wrap);

    lessons.forEach((l) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">Lesson ${escapeHtml(l.id)}</div>
          <div class="text-xs text-gray-400">Open</div>
        </div>
        <div class="mt-2 text-base text-gray-800 font-medium">${escapeHtml(l.title_ko || "")}</div>
        <div class="text-sm text-gray-500">${escapeHtml(l.title_zh || "")}</div>
        <div class="mt-2 text-xs text-gray-400">단어 ${l.vocab?.length || 0} · 대화 ${l.dialogue?.length || 0} · 연습 ${l.practice?.length || 0}</div>
      `;

      card.addEventListener("click", () => openLesson(l.id));
      wrap.appendChild(card);
    });

    hskStatus.textContent = lessons.length ? `(Lessons: ${lessons.length})` : "";
  }

  // ---------- Render: One lesson ----------
  function openLesson(lessonId) {
    const lesson = LESSONS_ALL.find((x) => String(x.id) === String(lessonId));
    if (!lesson) return;

    CURRENT_VIEW = "lesson";
    CURRENT_LESSON_ID = lessonId;

    hskGrid.innerHTML = "";

    // 顶部：返回 + 标题
    const top = document.createElement("div");
    top.className = "bg-white rounded-2xl shadow p-4 mb-3";
    top.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="space-y-1">
          <div class="text-lg font-semibold">Lesson ${escapeHtml(lesson.id)} · ${escapeHtml(lesson.title_ko)}</div>
          <div class="text-sm text-gray-500">${escapeHtml(lesson.title_zh || "")}</div>
        </div>
        <button id="backToLessons" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">목록</button>
      </div>
      <div class="mt-2 text-xs text-gray-500">💡 단어 카드 클릭 → 배우기(필순/예문/AI질문)</div>
    `;
    hskGrid.appendChild(top);

    top.querySelector("#backToLessons")?.addEventListener("click", () => {
      renderLessonList(LESSONS_ALL);
    });

    // 1) 新词
    const sec1 = document.createElement("div");
    sec1.className = "bg-white rounded-2xl shadow p-4 mb-3";
    sec1.innerHTML = `<div class="text-base font-semibold mb-3">새 단어</div>`;
    const vocabWrap = document.createElement("div");
    vocabWrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    sec1.appendChild(vocabWrap);
    hskGrid.appendChild(sec1);

    const vocabItems = (lesson.vocab || []).map((v) => normalizeVocabItem(v)).filter(x => x.word);
    vocabItems.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "text-left border rounded-xl p-4 hover:shadow-sm transition";
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(item.word)}</div>
          <div class="text-xs text-gray-400">Learn</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${escapeHtml([item.pinyin, (item.ko || item.meaning)].filter(Boolean).join(" · "))}</div>
      `;
      card.addEventListener("click", () => openLearn(item));
      vocabWrap.appendChild(card);
    });

    // 2) 课文对话 A/B
    const sec2 = document.createElement("div");
    sec2.className = "bg-white rounded-2xl shadow p-4 mb-3";
    sec2.innerHTML = `<div class="text-base font-semibold mb-3">대화</div>`;
    hskGrid.appendChild(sec2);

    const dia = Array.isArray(lesson.dialogue) ? lesson.dialogue : [];
    if (!dia.length) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-500";
      p.textContent = "대화가 아직 없어요.";
      sec2.appendChild(p);
    } else {
      dia.forEach((d, idx) => {
        const box = document.createElement("div");
        box.className = "border rounded-xl p-3 mb-3";
        box.innerHTML = `
          <div class="text-xs text-gray-400 mb-2">Dialog ${idx + 1}</div>

          <div class="mb-2">
            <div class="font-semibold">A</div>
            <div>${escapeHtml(d.A_zh || "")}</div>
            <div class="text-xs text-gray-500">${escapeHtml(d.A_pinyin || "")}</div>
            <div class="text-sm text-gray-700">${escapeHtml(d.A_ko || "")}</div>
          </div>

          <div>
            <div class="font-semibold">B</div>
            <div>${escapeHtml(d.B_zh || "")}</div>
            <div class="text-xs text-gray-500">${escapeHtml(d.B_pinyin || "")}</div>
            <div class="text-sm text-gray-700">${escapeHtml(d.B_ko || "")}</div>
          </div>

          <div class="mt-3 flex gap-2 flex-wrap">
            <button class="px-3 py-2 rounded-lg bg-slate-100 text-sm" data-act="playA">A 읽기</button>
            <button class="px-3 py-2 rounded-lg bg-slate-100 text-sm" data-act="playB">B 읽기</button>
          </div>
        `;
        box.querySelector('[data-act="playA"]')?.addEventListener("click", () => {
          if (d.A_zh) window.AIUI?.speak?.(d.A_zh, "zh-CN");
        });
        box.querySelector('[data-act="playB"]')?.addEventListener("click", () => {
          if (d.B_zh) window.AIUI?.speak?.(d.B_zh, "zh-CN");
        });
        sec2.appendChild(box);
      });
    }

    // 3) 课后练习
    const sec3 = document.createElement("div");
    sec3.className = "bg-white rounded-2xl shadow p-4";
    sec3.innerHTML = `<div class="text-base font-semibold mb-3">연습</div>`;
    hskGrid.appendChild(sec3);

    const pr = Array.isArray(lesson.practice) ? lesson.practice : [];
    if (!pr.length) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-500";
      p.textContent = "연습문제가 아직 없어요.";
      sec3.appendChild(p);
    } else {
      pr.forEach((q, idx) => {
        const box = document.createElement("div");
        box.className = "border rounded-xl p-3 mb-3";
        box.innerHTML = `
          <div class="text-xs text-gray-400 mb-2">Q${idx + 1}</div>
          <div class="text-sm text-gray-700">${escapeHtml(q.q_ko || "")}</div>
          <div class="mt-1">${escapeHtml(q.q_zh || "")}</div>
          <div class="text-xs text-gray-500">${escapeHtml(q.q_pinyin || "")}</div>

          <div class="mt-3 flex gap-2 flex-wrap">
            <button class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm" data-act="show">정답 보기</button>
            <div class="text-sm text-gray-600 hidden" data-answer>정답: ${escapeHtml(q.answer || "")}</div>
          </div>
        `;
        box.querySelector('[data-act="show"]')?.addEventListener("click", () => {
          box.querySelector("[data-answer]")?.classList.remove("hidden");
        });
        sec3.appendChild(box);
      });
    }

    hskStatus.textContent = "";
  }

  // ---------- Search ----------
  function filterAndRenderLessons() {
    // 搜索：在课列表中按韩/中标题过滤
    const q = (hskSearch.value || "").trim().toLowerCase();
    if (!q) return renderLessonList(LESSONS_ALL);

    const filtered = LESSONS_ALL.filter((l) => {
      const blob = `${l.title_ko} ${l.title_zh} lesson ${l.id}`.toLowerCase();
      return blob.includes(q);
    });
    renderLessonList(filtered);
  }

  // ---------- Load ----------
  async function loadLevel(level) {
    clearError();
    hskStatus.textContent = "(loading...)";
    hskGrid.innerHTML = "";

    // 先加载 lessons（按课显示）
    const lessonsUrl = window.DATA_PATHS?.lessonsUrl(level);
    if (!lessonsUrl) {
      showError("DATA_PATHS.lessonsUrl 이(가) 없습니다. ui/dataPaths.js 를 확인하세요.");
      return;
    }

    try {
      const resL = await fetch(lessonsUrl, { cache: "no-store" });
      if (!resL.ok) throw new Error(`Lessons HTTP ${resL.status} - ${lessonsUrl}`);
      const lessonsData = await resL.json();
      LESSONS_ALL = normalizeLessonFile(lessonsData);

      // 词库也加载一份备用（以后可用于全局搜索/补全）
      const vocabUrl = window.DATA_PATHS?.vocabUrl(level);
      if (vocabUrl) {
        try {
          const resV = await fetch(vocabUrl, { cache: "no-store" });
          if (resV.ok) {
            const vocabData = await resV.json();
            const arr = Array.isArray(vocabData) ? vocabData : (vocabData.items || vocabData.data || []);
            VOCAB_ALL = arr.map(normalizeVocabItem).filter(x => x.word);
          }
        } catch (e) {}
      }

      renderLessonList(LESSONS_ALL);
    } catch (e) {
      showError(
        `HSK ${level} 수업 파일을 불러오지 못했어요.\n` +
          `경로: ${lessonsUrl}\n` +
          `에러: ${e.message}`
      );
      hskStatus.textContent = "";
    }
  }

  // ---------- Learn panel ----------
  async function openLearn(item) {
    if (!learnPanel || !learnBody) return;

    learnPanel.classList.remove("hidden");
    learnBody.innerHTML = "";

    // ✅ 固定头部：关闭按钮永远可见
    learnBody.classList.add("max-h-[75vh]", "overflow-y-auto");

    const header = document.createElement("div");
    header.className =
      "sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center justify-between";
    header.innerHTML = `
      <div class="font-semibold">배우기</div>
      <button id="learnCloseX" class="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200">
        닫기 ✕
      </button>
    `;
    learnBody.appendChild(header);
    header.querySelector("#learnCloseX")?.addEventListener("click", closeLearn);

    const meaningKo = item.ko || item.meaning || "";
    const py = item.pinyin || "";

    const head = document.createElement("div");
    head.className = "px-4 pt-4 space-y-1";
    head.innerHTML = `
      <div class="text-2xl font-bold">${escapeHtml(item.word)}</div>
      <div class="text-sm text-gray-600">${escapeHtml([py, meaningKo].filter(Boolean).join(" · "))}</div>

      ${
        item.example_zh
          ? `
        <div class="mt-2 text-sm text-gray-700">
          <div class="font-medium">예문</div>
          <div>${escapeHtml(item.example_zh)}</div>
          <div class="text-xs text-gray-500">${escapeHtml(item.example_pinyin || "")}</div>
          <div class="text-sm text-gray-600">${escapeHtml(item.example_ko || "")}</div>
        </div>
      `
          : ""
      }

      <div class="pt-3 flex gap-2 flex-wrap">
        <button id="learnSpeakWord" class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">단어 읽기</button>
        <button id="learnAskAI" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">AI 선생님에게 질문</button>
      </div>
    `;
    learnBody.appendChild(head);

    head.querySelector("#learnSpeakWord")?.addEventListener("click", () => {
      window.AIUI?.speak?.(item.word, "zh-CN");
    });

    head.querySelector("#learnAskAI")?.addEventListener("click", () => {
      window.AIUI?.open?.();
      window.AIUI?.addBubble?.(
        `"${item.word}"를 한국어로 설명해 주세요. 뜻/발음(병음)/예문(중문+병음+한국어)도 같이요.`,
        "user"
      );
      window.AIUI?.send?.();
    });

    // 笔顺（逐字，成语 3/4 字也不会乱）
    const hanChars = Array.from(item.word).filter(isHan);

    const strokesWrap = document.createElement("div");
    strokesWrap.className = "px-4 pb-4 mt-4";
    learnBody.appendChild(strokesWrap);

    if (hanChars.length === 0) {
      strokesWrap.innerHTML = `<div class="text-sm text-gray-500">이 단어에는 한자가 없어서 필순을 표시하지 않아요.</div>`;
      return;
    }

    strokesWrap.innerHTML = `
      <div class="font-semibold mb-2">필순(筆順)</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="strokeGrid"></div>
      <div class="text-xs text-gray-500 mt-2">💡 파일이 없으면 “없음”으로 표시돼요. (data/strokes 폴더 확인)</div>
    `;
    const grid = strokesWrap.querySelector("#strokeGrid");

    for (const ch of hanChars) {
      const box = document.createElement("div");
      box.className = "border rounded-xl p-3 bg-white";
      box.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="text-lg font-semibold">${escapeHtml(ch)}</div>
          <div class="flex gap-2">
            <button class="px-2 py-1 rounded bg-slate-100 text-xs" data-act="read">읽기</button>
            <button class="px-2 py-1 rounded bg-slate-100 text-xs" data-act="replay">다시</button>
          </div>
        </div>
        <div class="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden" data-canvas>
          <div class="text-xs text-gray-400">loading...</div>
        </div>
      `;
      grid.appendChild(box);

      box.querySelector('[data-act="read"]')?.addEventListener("click", () => {
        window.AIUI?.speak?.(ch, "zh-CN");
      });

      const canvas = box.querySelector("[data-canvas]");

      try {
        const url = window.DATA_PATHS.strokeUrl(ch);
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) throw new Error("missing");

        const svgText = await res.text();
        canvas.innerHTML = svgText;

        const svg = canvas.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          svg.style.display = "block";
        }

        // ✅ 重播：重新插入 SVG（最稳）
        box.querySelector('[data-act="replay"]')?.addEventListener("click", async () => {
          try {
            const r2 = await fetch(url, { cache: "no-store" });
            const t2 = await r2.text();
            canvas.innerHTML = t2;
            const s2 = canvas.querySelector("svg");
            if (s2) {
              s2.setAttribute("width", "100%");
              s2.setAttribute("height", "100%");
              s2.style.display = "block";
            }
          } catch (e) {}
        });
      } catch (e) {
        canvas.innerHTML = `
          <div class="text-xs text-gray-400 text-center p-2">
            필순 파일 없음<br/>
            <span class="text-[10px]">${escapeHtml(window.DATA_PATHS.strokeFileNameForChar(ch))}</span>
          </div>
        `;
      }
    }
  }

  function closeLearn() {
    learnPanel?.classList.add("hidden");
  }

  // ---------- Events ----------
  hskLevel?.addEventListener("change", () => loadLevel(hskLevel.value));
  hskSearch?.addEventListener("input", () => {
    if (CURRENT_VIEW === "lessons") filterAndRenderLessons();
    // 在 lesson 视图里先不做搜索（避免你上课时卡顿）；后面要我再加“本课内搜索”也行
  });
  learnClose?.addEventListener("click", closeLearn);

  // 初始加载
  loadLevel(hskLevel?.value || "1");
})();
