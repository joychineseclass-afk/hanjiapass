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
    // 兼容不同字段名（你以后换 JSON 结构也不怕）
    const word =
      raw.word || raw.hanzi || raw.zh || raw.chinese || raw.text || raw.term || "";
    const pinyin = raw.pinyin || raw.py || raw.pron || "";
    const meaning =
      raw.meaning || raw.ko || raw.kr || raw.translation || raw.en || raw.def || "";
    const example = raw.example || raw.sentence || raw.eg || "";

    return { raw, word, pinyin, meaning, example };
  }

  function isHan(ch) {
    // 简单汉字判断（够用）
    return /[\u3400-\u9FFF]/.test(ch);
  }

  function render(list) {
    hskGrid.innerHTML = "";
    list.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

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

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
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
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} - ${url}`);
      }
      const data = await res.json();

      const arr = Array.isArray(data) ? data : (data.items || data.data || []);
      ALL = arr.map(normalizeItem).filter(x => x.word);

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
      <div class="text-sm text-gray-600">${escapeHtml([item.pinyin, item.meaning].filter(Boolean).join(" · "))}</div>
      ${item.example ? `<div class="text-sm text-gray-500">예문: ${escapeHtml(item.example)}</div>` : ""}
      <div class="pt-2 flex gap-2 flex-wrap">
        <button id="learnSpeakWord" class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">단어 읽기</button>
        <button id="learnAskAI" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">AI 선생님에게 질문</button>
      </div>
    `;
    learnBody.appendChild(head);

    // 버튼 동작
    head.querySelector("#learnSpeakWord")?.addEventListener("click", () => {
      window.AIUI?.speak?.(item.word, "zh-CN"); // 단어는 중국어 발음으로
    });

    head.querySelector("#learnAskAI")?.addEventListener("click", () => {
      window.AIUI?.open?.();
      window.AIUI?.addBubble?.(`"${item.word}"(을)를 설명해줘. 뜻/발음/예문도 같이.`, "user");
      window.AIUI?.send?.();
    });

    // 笔顺区
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
          <button class="px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
        </div>
        <div class="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden">
          <div class="text-xs text-gray-400">loading...</div>
        </div>
      `;
      box.querySelector("button")?.addEventListener("click", () => {
        window.AIUI?.speak?.(ch, "zh-CN");
      });
      grid.appendChild(box);

      const canvas = box.querySelector(".aspect-square");

      try {
        const url = window.DATA_PATHS.strokeUrl(ch);
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) throw new Error(`missing ${url}`);

        const svgText = await res.text();
        // 直接塞 SVG（makemeahanzi 的 SVG 自带动画/路径）
        canvas.innerHTML = svgText;

        // 让 SVG 自适应容器
        const svg = canvas.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          svg.style.display = "block";
        }
      } catch (e) {
        canvas.innerHTML = `<div class="text-xs text-gray-400">필순 파일 없음<br/><span class="text-[10px]">${escapeHtml(window.DATA_PATHS.strokeFileNameForChar(ch))}</span></div>`;
      }
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
