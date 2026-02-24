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
      // ✅ 用 loader 的版本管理（会自动 normalize + 清内部缓存）
if (window.HSK_LOADER?.setVersion) {
  window.HSK_LOADER.setVersion(hskVersion.value);
} else {
  localStorage.setItem("hsk_vocab_version", hskVersion.value);
}

// ✅ 保留你原有的缓存机制（双保险）
try { CACHE.clear(); } catch {}
try { LESSON_DETAIL_CACHE.clear(); } catch {}

// ✅ 清当前课程全局，避免跨版本 lessonId 污染
window.__HSK_CURRENT_LESSON_ID = "";
window.__HSK_CURRENT_LESSON = null;

// ✅ 触发当前 level 重新加载
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

  // ✅ NEW: 课程Tab页状态（不破坏你现有 view）
  let viewMode = "auto"; // "auto" | "lessonDetail"
  let lessonTab = "vocab"; // "vocab" | "dialogue" | "grammar" | "practice" | "ai"
  let currentLessonDetail = null;

  // ✅ NEW: 课件详情缓存（避免反复请求）
  const LESSON_DETAIL_CACHE = new Map(); // key: `${version}:${level}:${lessonNo}` -> {ts, data}
  const LESSON_DETAIL_TTL = 1000 * 60 * 30;

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

  // ✅ NEW: 简单 fetch JSON（课件详情用）
  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
    return res.json();
  }

  // ✅ NEW: 解析 lessonNo（兼容 id / lesson / title）
  function getLessonNo(lesson, idxFallback = 0) {
    const n =
      Number(lesson?.lesson) ||
      Number(lesson?.id) ||
      Number(lesson?.no) ||
      Number(idxFallback + 1);
    return Number.isFinite(n) && n > 0 ? n : idxFallback + 1;
  }

  // ✅ NEW: 课件详情 URL
  function lessonDetailUrl(level, lessonNo, version) {
    const lv = safeText(level || "1");
    const ver = safeText(version || getVersion());
    return `/data/lessons/${ver}/hsk${lv}_lesson${lessonNo}.json`;
  }

  // ✅ NEW: 读取课件详情（带缓存）
  async function loadLessonDetail(level, lessonNo, version) {
    const ver = safeText(version || getVersion());
    const lv = safeText(level || "1");
    const key = `${ver}:${lv}:${lessonNo}`;

    const hit = LESSON_DETAIL_CACHE.get(key);
    if (hit && Date.now() - hit.ts < LESSON_DETAIL_TTL) return hit.data;

    const url = lessonDetailUrl(lv, lessonNo, ver);
    const data = await fetchJson(url);

    LESSON_DETAIL_CACHE.set(key, { ts: Date.now(), data });
    return data;
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

  // ✅ NEW: 进入课程 Tab 页（核心入口）
  async function openLessonDetail(lesson, idxFallback = 0) {
    clearError();
    const lv = safeText(hskLevel?.value || "1");
    const ver = getVersion();
    const lessonNo = getLessonNo(lesson, idxFallback);

    viewMode = "lessonDetail";
    lessonTab = "vocab"; // 默认先词汇
    currentLesson = lesson;
    inRecentView = false;

    renderFallback("불러오는 중...", `Lesson ${lessonNo} 데이터를 가져오고 있어요...`);
    setStatus("(loading...)");

    try {
      currentLessonDetail = await loadLessonDetail(lv, lessonNo, ver);
      renderLessonDetailView();
      scrollToTop();
      focusSearch();
    } catch (e) {
      // ✅ 不破坏旧逻辑：课件详情不存在时，回退到你原本的“本课单词列表”
      console.warn("Lesson detail load failed, fallback to word list:", e);
      currentLessonDetail = null;
      viewMode = "auto";
      currentLesson = lesson;
      renderLessonWordsView();
      showError(
        `⚠️ Lesson 상세 파일을 못 찾았어요.\n` +
          `경로: ${lessonDetailUrl(lv, lessonNo, ver)}\n` +
          `에러: ${e?.message || e}\n\n` +
          `대신 '이 수업 단어' 보기로 전환했어요.`
      );
      setStatus("");
    }
  }

  // ✅ NEW: Tab 버튼 UI
  function renderTabBar() {
    const tabs = [
      { key: "vocab", text: "단어" },
      { key: "dialogue", text: "회화" },
      { key: "grammar", text: "문법" },
      { key: "practice", text: "연습" },
      { key: "ai", text: "AI" },
    ];

    const bar = document.createElement("div");
    bar.className = "bg-white rounded-2xl shadow p-2 mb-3 flex flex-wrap gap-2";

    bar.innerHTML = tabs
      .map((t) => {
        const active = t.key === lessonTab;
        return `<button type="button" data-tab="${t.key}"
          class="px-3 py-2 rounded-xl text-sm ${
            active ? "bg-blue-600 text-white" : "bg-slate-100"
          }">${t.text}</button>`;
      })
      .join("");

    bar.querySelectorAll("button[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lessonTab = btn.getAttribute("data-tab") || "vocab";
        renderLessonDetailView();
        scrollToTop();
        focusSearch();
      });
    });

    return bar;
  }

  // ✅ NEW: 课程 Tab 页整体渲染
  function renderLessonDetailView() {
    if (!hskGrid) return;

    // 安全：没有 detail 就退回原模式
    if (!currentLessonDetail) {
      viewMode = "auto";
      return renderAuto();
    }

    const lv = safeText(hskLevel?.value || "1");
    const ver = getVersion();
    const lessonNo = Number(currentLessonDetail?.lesson) || getLessonNo(currentLesson, 0);

    const title =
      safeText(currentLessonDetail?.title) ||
      safeText(currentLesson?.title) ||
      `Lesson ${lessonNo}`;

    const topic = safeText(currentLessonDetail?.topic);
    const subtitle = `HSK ${lv} · ${ver}` + (topic ? ` · ${topic}` : "");

    hskGrid.innerHTML = "";

    const top = renderTopBar({
      title,
      subtitle,
      leftBtn: { key: "backLessons", text: "← 수업 목록" },
      rightBtns: [
        { key: "recent", text: "최근 학습" },
        { key: "goAll", text: "전체 단어" },
      ],
    });
    hskGrid.appendChild(top);

    top.querySelector(`[data-key="backLessons"]`)?.addEventListener("click", () => {
      viewMode = "auto";
      currentLessonDetail = null;
      lessonTab = "vocab";
      currentLesson = null;
      renderLessonsView();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="recent"]`)?.addEventListener("click", () => {
      viewMode = "auto";
      currentLessonDetail = null;
      currentLesson = null;
      renderRecentView();
      scrollToTop();
      focusSearch();
    });

    top.querySelector(`[data-key="goAll"]`)?.addEventListener("click", () => {
      viewMode = "auto";
      currentLessonDetail = null;
      currentLesson = null;
      renderAllWordsView();
      scrollToTop();
      focusSearch();
    });

    // Tab bar
    hskGrid.appendChild(renderTabBar());

    // Content wrap
    const wrap = document.createElement("div");
    wrap.className = "bg-white rounded-2xl shadow p-4";
    hskGrid.appendChild(wrap);

    // Tab contents
    if (lessonTab === "vocab") return renderLessonTabVocab(wrap);
    if (lessonTab === "dialogue") return renderLessonTabDialogue(wrap);
    if (lessonTab === "grammar") return renderLessonTabGrammar(wrap);
    if (lessonTab === "practice") return renderLessonTabPractice(wrap);
    if (lessonTab === "ai") return renderLessonTabAI(wrap);

    // fallback
    renderLessonTabVocab(wrap);
  }

  // ✅ NEW: Tab - 단어(词汇)
  function renderLessonTabVocab(container) {
    if (!container) return;

    if (!window.HSK_RENDER?.renderWordCards) {
      container.innerHTML = `<div class="text-sm text-red-600">HSK_RENDER.renderWordCards 가 없습니다.</div>`;
      return;
    }

    const q = safeText(hskSearch?.value);
    const allMap = buildAllMap();

    // 优先用 lesson detail 的 words（课件真实词表）
    const wordsRaw = Array.isArray(currentLessonDetail?.words)
      ? currentLessonDetail.words
      : Array.isArray(currentLesson?.words)
      ? currentLesson.words
      : [];

    // 用 ALL map 解析成完整词条（带meaning/example）
    const tmpLesson = { words: wordsRaw };
    const { list: lessonWords, missing } = buildLessonWordList(tmpLesson, allMap);
    const filtered = filterWordList(lessonWords, q);

    container.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "text-sm text-gray-600 mb-3";
    meta.textContent =
      (q ? `검색: "${q}" · ` : "") +
      `단어 ${filtered.length}개` +
      (missing ? ` · ⚠️ 누락 ${missing}개` : "");
    container.appendChild(meta);

    const cardWrap = document.createElement("div");
    cardWrap.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    container.appendChild(cardWrap);

    if (filtered.length === 0) {
      renderEmptyHint(cardWrap, "단어가 없어요", "이 수업 words 목록을 확인해 주세요.");
      setStatus("(0)");
      return;
    }

    window.HSK_RENDER.renderWordCards(
      cardWrap,
      filtered,
      (item) => window.LEARN_PANEL?.open?.(item),
      { lang: LANG, query: q, showTag: "학습", compact: false }
    );

    setStatus(`(${filtered.length})`);
  }

  // ✅ NEW: Tab - 회화(对话)
  function renderLessonTabDialogue(container) {
    if (!container) return;

    const dia = Array.isArray(currentLessonDetail?.dialogue)
      ? currentLessonDetail.dialogue
      : [];

    container.innerHTML = "";

    if (dia.length === 0) {
      container.innerHTML = `<div class="text-sm text-gray-600">회화 데이터가 없어요. (dialogue: [])</div>`;
      setStatus("(0)");
      return;
    }

    const list = document.createElement("div");
    list.className = "space-y-2";
    container.appendChild(list);

    dia.forEach((it, idx) => {
      const speaker = safeText(it?.speaker || it?.role || `S${idx + 1}`);
      const line = safeText(it?.line || it?.text || it?.zh || it?.cn);

      const row = document.createElement("div");
      row.className = "p-3 rounded-xl bg-slate-50";
      row.innerHTML = `
        <div class="text-xs text-gray-500 mb-1">${speaker}</div>
        <div class="text-base">${line || ""}</div>
      `;
      list.appendChild(row);
    });

    setStatus(`(${dia.length})`);
  }

  // ✅ NEW: Tab - 문법(语法)
  function renderLessonTabGrammar(container) {
    if (!container) return;

    const gram = Array.isArray(currentLessonDetail?.grammar)
      ? currentLessonDetail.grammar
      : [];

    container.innerHTML = "";

    if (gram.length === 0) {
      container.innerHTML = `<div class="text-sm text-gray-600">문법 데이터가 없어요. (grammar: [])</div>`;
      setStatus("(0)");
      return;
    }

    const list = document.createElement("div");
    list.className = "space-y-3";
    container.appendChild(list);

    gram.forEach((g, idx) => {
      const title = safeText(g?.title || `문법 ${idx + 1}`);
      const kr = safeText(g?.explanation_kr || g?.kr || g?.explainKr);
      const zh = safeText(g?.explanation_zh || g?.zh || g?.explainZh);
      const ex = safeText(g?.example || g?.eg);

      const card = document.createElement("div");
      card.className = "p-4 rounded-2xl bg-slate-50";
      card.innerHTML = `
        <div class="text-base font-semibold">${title}</div>
        ${kr ? `<div class="text-sm text-gray-700 mt-2"><b>KR</b> ${kr}</div>` : ""}
        ${zh ? `<div class="text-sm text-gray-700 mt-2"><b>ZH</b> ${zh}</div>` : ""}
        ${ex ? `<div class="text-sm text-gray-500 mt-2"><b>예문</b> ${ex}</div>` : ""}
      `;
      list.appendChild(card);
    });

    setStatus(`(${gram.length})`);
  }

  // ✅ NEW: Tab - 연습(练习)
  function renderLessonTabPractice(container) {
    if (!container) return;

    const prac = Array.isArray(currentLessonDetail?.practice)
      ? currentLessonDetail.practice
      : [];

    container.innerHTML = "";

    if (prac.length === 0) {
      container.innerHTML = `<div class="text-sm text-gray-600">연습 데이터가 없어요. (practice: [])</div>`;
      setStatus("(0)");
      return;
    }

    const list = document.createElement("div");
    list.className = "space-y-3";
    container.appendChild(list);

    prac.forEach((p, idx) => {
      const type = safeText(p?.type || "practice");
      const q = safeText(p?.question || "");
      const options = Array.isArray(p?.options) ? p.options : [];
      const answer = safeText(p?.answer || "");

      const card = document.createElement("div");
      card.className = "p-4 rounded-2xl bg-slate-50";
      card.innerHTML = `
        <div class="text-xs text-gray-500 mb-2">${idx + 1}. ${type}</div>
        ${q ? `<div class="text-base font-medium">${q}</div>` : ""}
        ${
          options.length
            ? `<div class="mt-2 text-sm text-gray-700 space-y-1">
                ${options.map((x) => `<div>• ${safeText(x)}</div>`).join("")}
               </div>`
            : ""
        }
        ${answer ? `<div class="mt-2 text-sm text-gray-500"><b>정답</b> ${answer}</div>` : ""}
      `;
      list.appendChild(card);
    });

    setStatus(`(${prac.length})`);
  }

  // ✅ NEW: Tab - AI (这里先做“可用版”，后续你要接豆包/Gemini再升级)
  function renderLessonTabAI(container) {
    if (!container) return;

    const lv = safeText(hskLevel?.value || "1");
    const title =
      safeText(currentLessonDetail?.title) ||
      safeText(currentLesson?.title) ||
      "Lesson";

    const topic = safeText(currentLessonDetail?.topic);
    const words = Array.isArray(currentLessonDetail?.words) ? currentLessonDetail.words : [];

    const prompt =
      `당신은 한국 학생을 가르치는 중국어 선생님입니다.\n` +
      `오늘 수업: HSK${lv} / ${title}\n` +
      (topic ? `주제: ${topic}\n` : "") +
      (words.length ? `단어: ${words.join(", ")}\n` : "") +
      `\n요청:\n` +
      `1) 위 단어로 쉬운 회화 5문장 만들어 주세요.\n` +
      `2) 한국어 뜻 + 중국어 + 병음 같이 보여 주세요.\n` +
      `3) 마지막에 간단한 퀴즈 3개(객관식) 만들어 주세요.\n`;

    container.innerHTML = `
      <div class="text-sm text-gray-600 mb-2">
        아래 프롬프트를 복사해서 AI 패널/ChatGPT에 붙여넣으면 바로 연습할 수 있어요.
      </div>
      <textarea id="hskAiPrompt" class="w-full border rounded-xl p-3 text-sm" rows="10"></textarea>
      <div class="flex gap-2 mt-3">
        <button id="btnCopyAi" type="button" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm">프롬프트 복사</button>
        <button id="btnOpenRecent" type="button" class="px-4 py-2 rounded-xl bg-slate-100 text-sm">최근 학습 보기</button>
      </div>
      <div class="text-xs text-gray-500 mt-2">
        (다음 단계) AI 패널에 "이 프롬프트로 시작" 버튼을 직접 연결해 줄 수도 있어요.
      </div>
    `;

    const ta = container.querySelector("#hskAiPrompt");
    if (ta) ta.value = prompt;

    container.querySelector("#btnCopyAi")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        // fallback
        try {
          ta?.select?.();
          document.execCommand("copy");
        } catch {}
      }
    });

    container.querySelector("#btnOpenRecent")?.addEventListener("click", () => {
      viewMode = "auto";
      currentLessonDetail = null;
      currentLesson = null;
      renderRecentView();
      scrollToTop();
      focusSearch();
    });

    setStatus("");
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
        // ✅ PATCH/NEW: 原来是 renderLessonWordsView()，现在进入“课程Tab页”
        const idxFallback = LESSONS?.indexOf?.(lesson) ?? 0;
        openLessonDetail(lesson, idxFallback);
      },
      { lang: LANG, query: q, meta, showBadge: true }
    );

    setStatus(`(${matches.length}/${LESSONS.length})`);
  }

  // ✅ 保留原本的“本课单词列表”视图（作为 fallback/工具页）
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
    // ✅ NEW: 如果在课程Tab页，优先渲染课程Tab页
    if (viewMode === "lessonDetail") return renderLessonDetailView();

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

    // ✅ NEW: 레벨 바꾸면 탭 페이지 해제
    viewMode = "auto";
    currentLessonDetail = null;
    lessonTab = "vocab";

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
