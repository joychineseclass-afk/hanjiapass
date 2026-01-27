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

  let ALL = [];

  function showError(msg) {
    hskError.classList.remove("hidden");
    hskError.textContent = msg;
  }
  function clearError() {
    hskError.classList.add("hidden");
    hskError.textContent = "";
  }

  function normalizeItem(raw) {
    const word =
      raw.word || raw.hanzi || raw.zh || raw.chinese || raw.text || raw.term || "";
    const pinyin = raw.pinyin || raw.py || raw.pron || "";
    const meaning =
      raw.meaning || raw.ko || raw.kr || raw.translation || raw.en || raw.def || "";
    const example = raw.example || raw.sentence || raw.eg || "";
    // 预留：以后做“按课”展示会用到（没有也不影响）
    const lesson = raw.lesson || raw.unit || raw.category || "";
    return { raw, word, pinyin, meaning, example, lesson };
  }

  function isHan(ch) {
    return /[\u3400-\u9FFF]/.test(ch);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function render(list) {
    hskGrid.innerHTML = "";
    list.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      const title = document.createElement("div");
      title.className = "flex items-center justify-between gap-2";
      title.innerHTML = `
        <div class="text-lg font-semibold">${escapeHtml(item.word || "(빈 항목)")}</div>
        <div class="text-xs text-gray-400">Learn</div>
      `;

      const sub = document.createElement("div");
      sub.className = "mt-1 text-sm text-gray-600";
      sub.textContent = [item.pinyin, item.meaning].filter(Boolean).join(" · ");

      const ex = document.createElement("div");
      ex.className = "mt-2 text-xs text-gray-500";
      ex.textContent = item.example ? `예문: ${item.example}` : " ";

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(ex);

      card.addEventListener("click", () => openLearn(item));
      hskGrid.appendChild(card);
    });
  }

  function filterAndRender() {
    const q = (hskSearch.value || "").trim().toLowerCase();
    const list = !q
      ? ALL
      : ALL.filter((x) => {
          const blob = `${x.word} ${x.pinyin} ${x.meaning} ${x.example}`.toLowerCase();
          return blob.includes(q);
        });
    render(list);
    hskStatus.textContent = `(${list.length}/${ALL.length})`;
  }

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

      filterAndRender();
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
      <div class="text-sm text-gray-600">${escapeHtml(
        [item.pinyin, item.meaning].filter(Boolean).join(" · ")
      )}</div>
      ${
        item.example
          ? `<div class="text-sm text-gray-500">예문: ${escapeHtml(item.example)}</div>`
          : ""
      }
      <div class="pt-2 flex gap-2 flex-wrap">
        <button id="learnSpeakWord" class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">단어 읽기</button>
        <button id="learnAskAI" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">AI 선생님에게 질문</button>
      </div>
    `;
    learnBody.appendChild(head);

    // 버튼 동작
    head.querySelector("#learnSpeakWord")?.addEventListener("click", () => {
      window.AIUI?.speak?.(item.word, "zh-CN");
    });
    head.querySelector("#learnAskAI")?.addEventListener("click", () => {
      window.AIUI?.open?.();
      window.AIUI?.addBubble?.(`"${item.word}"(을)를 설명해줘. 뜻/발음/예문도 같이.`, "user");
      window.AIUI?.send?.();
    });

    // ===== 笔顺：点击某个字才播放 / 暂停 / 重播 =====
    const hanChars = Array.from(item.word).filter(isHan);

    if (hanChars.length === 0) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-500 mt-3";
      p.textContent = "이 단어에는 한자가 없어서 필순을 표시하지 않아요.";
      learnBody.appendChild(p);
      return;
    }

    const strokesWrap = document.createElement("div");
    strokesWrap.className = "mt-4";
    strokesWrap.innerHTML = `
      <div class="font-semibold mb-2">필순(筆順) — 글자를 눌러보세요</div>

      <div id="strokeButtons" class="flex gap-2 flex-wrap mb-3"></div>

      <div class="flex items-center gap-2 mb-2">
        <button id="strokePlay" class="px-3 py-1 rounded bg-orange-500 text-white text-sm">재생</button>
        <button id="strokePause" class="px-3 py-1 rounded bg-slate-100 text-sm">일시정지</button>
        <button id="strokeReplay" class="px-3 py-1 rounded bg-slate-100 text-sm">다시보기</button>
        <div id="strokeHint" class="text-xs text-gray-500 ml-2"></div>
      </div>

      <div id="strokeViewer" class="border rounded-xl p-3 bg-white text-center text-gray-400">
        글자를 누르면 필순 애니메이션이 나와요
      </div>

      <div class="text-xs text-gray-500 mt-2">💡 파일이 없으면 “없음”으로 표시돼요. (data/strokes 폴더 확인)</div>
    `;
    learnBody.appendChild(strokesWrap);

    const btnWrap = strokesWrap.querySelector("#strokeButtons");
    const viewer = strokesWrap.querySelector("#strokeViewer");
    const hint = strokesWrap.querySelector("#strokeHint");
    const btnPlay = strokesWrap.querySelector("#strokePlay");
    const btnPause = strokesWrap.querySelector("#strokePause");
    const btnReplay = strokesWrap.querySelector("#strokeReplay");

    let currentChar = "";
    let currentSvgText = ""; // replay 用

    function setSvgPaused(paused) {
      const svg = viewer.querySelector("svg");
      if (!svg) return;
      // 暂停所有 CSS 动画
      svg.style.animationPlayState = paused ? "paused" : "running";
      svg.querySelectorAll("*").forEach((el) => {
        el.style.animationPlayState = paused ? "paused" : "running";
      });
    }

    async function loadAndShowChar(ch) {
      currentChar = ch;
      currentSvgText = "";
      hint.textContent = `선택: ${ch}`;

      viewer.innerHTML = `
        <div class="text-sm text-gray-500 mb-2">【 ${escapeHtml(ch)} 】笔顺演示</div>
        <div class="w-full flex items-center justify-center">
          <div class="text-xs text-gray-400">loading...</div>
        </div>
      `;

      try {
        const url = window.DATA_PATHS.strokeUrl(ch);
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) throw new Error(`missing ${url}`);

        const svgText = await res.text();
        currentSvgText = svgText;

        viewer.innerHTML = `
          <div class="text-sm text-gray-500 mb-2">【 ${escapeHtml(ch)} 】笔顺演示</div>
          <div id="svgHost" class="w-full flex items-center justify-center"></div>
        `;

        const host = viewer.querySelector("#svgHost");
        host.innerHTML = svgText;

        const svg = host.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "260");
          svg.setAttribute("height", "260");
          svg.style.maxWidth = "100%";
          svg.style.height = "auto";
          svg.style.display = "block";
        }

        setSvgPaused(false);
      } catch (e) {
        viewer.innerHTML = `
          <div class="text-sm text-gray-500 mb-2">【 ${escapeHtml(ch)} 】</div>
          <div class="text-xs text-gray-400">
            필순 파일 없음<br/>
            <span class="text-[10px]">${escapeHtml(window.DATA_PATHS.strokeFileNameForChar(ch))}</span>
          </div>
        `;
      }
    }

    // 字按钮
    hanChars.forEach((ch, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "px-3 py-2 bg-orange-100 hover:bg-orange-200 rounded text-lg font-bold";
      btn.textContent = ch;

      btn.addEventListener("click", () => {
        loadAndShowChar(ch);
      });

      btnWrap.appendChild(btn);

      // 默认自动加载第一个字（可改成不自动）
      if (idx === 0) loadAndShowChar(ch);
    });

    // 控制按钮：play / pause / replay
    btnPlay?.addEventListener("click", () => setSvgPaused(false));
    btnPause?.addEventListener("click", () => setSvgPaused(true));
    btnReplay?.addEventListener("click", () => {
      if (!currentChar) return;
      // 重新塞入 SVG，达到“重播”的效果
      if (!currentSvgText) return;
      const host = viewer.querySelector("#svgHost");
      if (host) {
        host.innerHTML = currentSvgText;
        const svg = host.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "260");
          svg.setAttribute("height", "260");
          svg.style.maxWidth = "100%";
          svg.style.height = "auto";
          svg.style.display = "block";
        }
      } else {
        // 如果当前是“文件不存在”状态，点击 replay 也无意义
      }
      setSvgPaused(false);
    });

    // 点击某个字：也读音（可选：你想要就打开）
    // btnWrap.addEventListener("click", (e) => {
    //   const t = e.target;
    //   if (t && t.tagName === "BUTTON") window.AIUI?.speak?.(t.textContent, "zh-CN");
    // });
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
