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

  // ====== 状态 ======
  let ALL = [];
  let BY_LESSON = new Map(); // lessonNo -> items[]
  let currentLesson = null;  // null = 显示课程列表

  // ====== 语言：现在韩语优先，未来可切换 ======
  // 现在先固定 ko，等你做“多国语”时再接 explainLang 下拉即可
  const UI_LANG = "ko"; // ko / en / zh / ja ...

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

  // 未来多语言：如果 raw.meaning 是对象 {ko,en,...} 就按语言取；否则当纯字符串用
  function pickMeaning(raw) {
    const m =
      raw.meaning_ko ?? raw.ko ?? raw.kr ?? raw.korean ??
      raw.meaning ?? raw.translation ?? raw.def ?? raw.en ?? "";
    if (m && typeof m === "object") {
      return m[UI_LANG] || m.ko || m.en || m.zh || "";
    }
    return m || "";
  }

  function normalizeItem(raw) {
    const word =
      raw.word || raw.hanzi || raw.zh || raw.chinese || raw.text || raw.term || "";
    const pinyin = raw.pinyin || raw.py || raw.pron || "";
    const meaning = pickMeaning(raw);
    const example = raw.example || raw.sentence || raw.eg || "";

    const lesson = Number(raw.lesson || raw.unit || raw.chapter || 0) || 0;
    const lessonTitle =
      raw.lessonTitle || raw.unitTitle || raw.chapterTitle || "";

    return { raw, word, pinyin, meaning, example, lesson, lessonTitle };
  }

  function isHan(ch) {
    return /[\u3400-\u9FFF]/.test(ch);
  }

  // ====== 课程标题（你可以按你的教材改）======
  function getLessonName(level, lessonNo) {
    // 先给 HSK1 一个常用分法，你想怎么命名都行
    const L1 = {
      1: "제1과 인사(打招呼)",
      2: "제2과 소개(자기소개)",
      3: "제3과 숫자(数字)",
      4: "제4과 시간(时间)",
      5: "제5과 가족/사람(家人)",
      6: "제6과 학교/교실(学校)",
      7: "제7과 장소/이동(장소)",
      8: "제8과 음식/주문(음식)",
      9: "제9과 생활(일상)",
      10:"제10과 종합(복습)"
    };
    if (String(level) === "1") return L1[lessonNo] || `제${lessonNo}과`;
    return `제${lessonNo}과`;
  }

  // ====== 渲染：课程列表 ======
  function renderLessonList() {
    currentLesson = null;
    hskGrid.innerHTML = "";

    const lessons = Array.from(BY_LESSON.keys()).sort((a, b) => a - b);
    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";

    lessons.forEach((lessonNo) => {
      const items = BY_LESSON.get(lessonNo) || [];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      btn.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(getLessonName(hskLevel.value, lessonNo))}</div>
          <div class="text-xs text-gray-400">${items.length}개</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">눌러서 단어 보기 →</div>
      `;

      btn.addEventListener("click", () => {
        renderLessonCards(lessonNo);
      });

      wrap.appendChild(btn);
    });

    hskGrid.appendChild(wrap);
    hskStatus.textContent = lessons.length ? `(레슨 ${lessons.length}개)` : "";
  }

  // ====== 渲染：某一课的词卡 ======
  function renderLessonCards(lessonNo) {
    currentLesson = lessonNo;
    const items = BY_LESSON.get(lessonNo) || [];

    hskGrid.innerHTML = "";

    // 顶部返回条
    const bar = document.createElement("div");
    bar.className = "bg-white rounded-2xl shadow p-3 mb-3 flex items-center justify-between gap-2";
    bar.innerHTML = `
      <div class="font-semibold">${escapeHtml(getLessonName(hskLevel.value, lessonNo))}</div>
      <button id="backToLessons" class="px-3 py-1 rounded-lg bg-slate-100 text-sm">← 레슨 목록</button>
    `;
    hskGrid.appendChild(bar);

    bar.querySelector("#backToLessons")?.addEventListener("click", () => {
      renderLessonList();
    });

    // 卡片区
    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";

    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(item.word || "(빈 항목)")}</div>
          <div class="text-xs text-gray-400">Learn</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${escapeHtml([item.pinyin, item.meaning].filter(Boolean).join(" · "))}</div>
        <div class="mt-2 text-xs text-gray-500">${item.example ? `예문: ${escapeHtml(item.example)}` : ""}</div>
      `;

      card.addEventListener("click", () => openLearn(item));
      wrap.appendChild(card);
    });

    hskGrid.appendChild(wrap);
    hskStatus.textContent = `(${items.length}개)`;
  }

  // ====== 搜索：有关键字时跨课过滤（不按课）======
  function renderSearchResult(list) {
    hskGrid.innerHTML = "";

    const bar = document.createElement("div");
    bar.className = "bg-white rounded-2xl shadow p-3 mb-3 flex items-center justify-between gap-2";
    bar.innerHTML = `
      <div class="font-semibold">검색 결과</div>
      <button id="clearSearch" class="px-3 py-1 rounded-lg bg-slate-100 text-sm">검색 지우기</button>
    `;
    hskGrid.appendChild(bar);

    bar.querySelector("#clearSearch")?.addEventListener("click", () => {
      hskSearch.value = "";
      renderLessonList();
    });

    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";

    list.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-lg font-semibold">${escapeHtml(item.word || "(빈 항목)")}</div>
          <div class="text-xs text-gray-400">${escapeHtml(getLessonName(hskLevel.value, item.lesson || 0))}</div>
        </div>
        <div class="mt-1 text-sm text-gray-600">${escapeHtml([item.pinyin, item.meaning].filter(Boolean).join(" · "))}</div>
        <div class="mt-2 text-xs text-gray-500">${item.example ? `예문: ${escapeHtml(item.example)}` : ""}</div>
      `;

      card.addEventListener("click", () => openLearn(item));
      wrap.appendChild(card);
    });

    hskGrid.appendChild(wrap);
    hskStatus.textContent = `(${list.length}/${ALL.length})`;
  }

  function filterAndRender() {
    const q = (hskSearch.value || "").trim().toLowerCase();
    if (!q) {
      // 没搜索：显示课程列表或当前课
      if (currentLesson == null) renderLessonList();
      else renderLessonCards(currentLesson);
      return;
    }

    const list = ALL.filter((x) => {
      const blob = `${x.word} ${x.pinyin} ${x.meaning} ${x.example}`.toLowerCase();
      return blob.includes(q);
    });
    renderSearchResult(list);
  }

  // ====== 加载词库 ======
  async function loadLevel(level) {
    clearError();
    hskStatus.textContent = "(loading...)";
    hskGrid.innerHTML = "";

    const url = window.DATA_PATHS?.vocabUrl(level);
    if (!url) {
      showError("DATA_PATHS.vocabUrl 이(가) 없습니다. ui/dataPaths.js 를 확인하세요.");
      return;
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);

      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || data.data || []);

      ALL = arr.map(normalizeItem).filter((x) => x.word);

      // 组装按课
      BY_LESSON = new Map();
      ALL.forEach((it) => {
        const k = it.lesson || 0;
        if (!BY_LESSON.has(k)) BY_LESSON.set(k, []);
        BY_LESSON.get(k).push(it);
      });

      currentLesson = null;
      renderLessonList();
    } catch (e) {
      showError(
        `HSK ${level} 단어 파일을 불러오지 못했어요.\n` +
        `경로를 확인하세요: ${url}\n` +
        `에러: ${e.message}`
      );
      hskStatus.textContent = "";
    }
  }

  // ===== Learn panel (word + strokes) =====
  async function openLearn(item) {
    if (!learnPanel || !learnBody) return;

    learnBody.innerHTML = "";
    learnPanel.classList.remove("hidden");

    // 상단 정보
    const head = document.createElement("div");
    head.className = "space-y-1";
    head.innerHTML = `
      <div class="text-2xl font-bold">${escapeHtml(item.word)}</div>
      <div class="text-sm text-gray-600">${escapeHtml([item.pinyin, item.meaning].filter(Boolean).join(" · "))}</div>
      ${item.example ? `<div class="text-sm text-gray-500">예문: ${escapeHtml(item.example)}</div>` : ""}
      <div class="pt-2 flex gap-2 flex-wrap">
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
        `"${item.word}"(을)를 한국어로 설명해줘. 뜻/발음/예문도 같이.`,
        "user"
      );
      window.AIUI?.send?.();
    });

    // ===== 笔顺区：关键修复点 —— 用 <object> 隔离 SVG（2字/4字都不乱）=====
    const hanChars = Array.from(item.word).filter(isHan);
    if (hanChars.length === 0) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-500";
      p.textContent = "이 단어에는 한자가 없어서 필순을 표시하지 않아요.";
      learnBody.appendChild(p);
      return;
    }

    const strokesWrap = document.createElement("div");
    strokesWrap.className = "mt-2";
    strokesWrap.innerHTML = `
      <div class="font-semibold mb-2">필순(筆順)</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="strokeGrid"></div>
      <div class="text-xs text-gray-500 mt-2">💡 파일이 없으면 “없음”으로 표시돼요. (data/strokes 폴더 확인)</div>
    `;
    learnBody.appendChild(strokesWrap);

    const grid = strokesWrap.querySelector("#strokeGrid");

    for (const ch of hanChars) {
      const box = document.createElement("div");
      box.className = "border rounded-xl p-3 bg-white";

      box.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="text-lg font-semibold">${escapeHtml(ch)}</div>
          <div class="flex items-center gap-2">
            <button data-act="speak" class="px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
            <button data-act="play"  class="px-2 py-1 rounded bg-slate-100 text-xs">재생</button>
            <button data-act="pause" class="px-2 py-1 rounded bg-slate-100 text-xs">일시정지</button>
            <button data-act="replay"class="px-2 py-1 rounded bg-slate-100 text-xs">다시</button>
          </div>
        </div>
        <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
          <div class="text-xs text-gray-400">loading...</div>
        </div>
      `;
      grid.appendChild(box);

      const canvas = box.querySelector(".aspect-square");

      const url = window.DATA_PATHS.strokeUrl(ch);

      // 用 object 加载 svg（隔离 keyframes）
      const obj = document.createElement("object");
      obj.type = "image/svg+xml";
      obj.data = url;
      obj.style.width = "100%";
      obj.style.height = "100%";
      obj.style.display = "block";

      // 失败显示
      obj.addEventListener("error", () => {
        canvas.innerHTML = `<div class="text-xs text-gray-400 text-center p-3">
          필순 파일 없음<br/>
          <span class="text-[10px]">${escapeHtml(window.DATA_PATHS.strokeFileNameForChar(ch))}</span>
        </div>`;
      });

      // 成功后：提供 play/pause 控制（尽量兼容）
      obj.addEventListener("load", () => {
        // 默认自动播放即可
      });

      canvas.innerHTML = "";
      canvas.appendChild(obj);

      // 按钮
      box.querySelector('[data-act="speak"]')?.addEventListener("click", () => {
        window.AIUI?.speak?.(ch, "zh-CN");
      });

      // 通过给 svg 根节点加 CSS 控制 animation-play-state（部分 svg 有效，至少 replay 一定有效）
      function setPlayState(state) {
        try {
          const doc = obj.contentDocument;
          if (!doc) return;
          const svg = doc.querySelector("svg");
          if (!svg) return;
          svg.style.animationPlayState = state;
          // 尽量覆盖内部元素
          const all = doc.querySelectorAll("*");
          all.forEach((el) => {
            el.style.animationPlayState = state;
          });
        } catch (_) {}
      }

      box.querySelector('[data-act="play"]')?.addEventListener("click", () => setPlayState("running"));
      box.querySelector('[data-act="pause"]')?.addEventListener("click", () => setPlayState("paused"));

      // replay：重新加载 object（100% 有效）
      box.querySelector('[data-act="replay"]')?.addEventListener("click", () => {
        const old = obj.data;
        obj.data = "";
        setTimeout(() => (obj.data = old), 0);
      });
    }
  }

  function closeLearn() {
    learnPanel?.classList.add("hidden");
  }

  // events
  hskLevel?.addEventListener("change", () => loadLevel(hskLevel.value));
  hskSearch?.addEventListener("input", filterAndRender);
  learnClose?.addEventListener("click", closeLearn);

  // 初始加载
  loadLevel(hskLevel?.value || "1");
})();
