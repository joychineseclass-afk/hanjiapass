// ui/learnPanel.js
(function () {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function isHan(ch) {
    return /[\u3400-\u9FFF]/.test(ch);
  }

  // 如果 HTML 里没有 learn-panel，就自动创建（更稳）
  function ensurePanel() {
    if ($("learn-panel")) return;

    const wrap = document.createElement("div");
    wrap.id = "learn-panel";
    wrap.className =
      "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4";

    // ✅ 关键：内容区滚动；顶部标题栏 sticky 固定
    wrap.innerHTML = `
      <div class="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden relative">
        <!-- Top bar (sticky) -->
        <div class="learnTopBar sticky top-0 z-[10000] bg-white border-b">
          <div class="flex items-center justify-between px-4 py-3">
            <div class="font-semibold">배우기</div>
            <div class="flex items-center gap-2">
              <button id="learnClose" class="px-3 py-1 rounded-lg bg-slate-100 text-sm">닫기</button>
              <button id="learnCloseX" class="w-9 h-9 rounded-lg bg-slate-100 text-lg leading-none">×</button>
            </div>
          </div>
        </div>

        <!-- Body (scroll) -->
        <div id="learnBody" class="p-4 space-y-3 max-h-[80vh] overflow-auto"></div>
      </div>
    `;
    document.body.appendChild(wrap);

    // ✅ 关闭：按钮 + X + ESC + 点击遮罩
    $("learnClose")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
    $("learnCloseX")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function close() {
    $("learn-panel")?.classList.add("hidden");
  }

  async function open(item) {
    ensurePanel();

    const learnPanel = $("learn-panel");
    const learnBody = $("learnBody");
    if (!learnPanel || !learnBody) return;

    learnBody.innerHTML = "";
    learnPanel.classList.remove("hidden");

    // ===== 上方信息区 =====
    const head = document.createElement("div");
    head.className = "space-y-1";
    head.innerHTML = `
      <div class="text-2xl font-bold">${escapeHtml(item.word)}</div>
      <div class="text-sm text-gray-600">${escapeHtml(
        [item.pinyin, item.meaning].filter(Boolean).join(" · ")
      )}</div>
      ${item.example ? `<div class="text-sm text-gray-500">예문: ${escapeHtml(item.example)}</div>` : ""}
      <div class="pt-2 flex gap-2 flex-wrap">
        <button id="learnSpeakWord" class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">단어 읽기</button>
        <button id="learnAskAI" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">AI 선생님에게 질문</button>
      </div>
    `;
    learnBody.appendChild(head);

    head.querySelector("#learnSpeakWord")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.AIUI?.speak?.(item.word, "zh-CN");
    });

    head.querySelector("#learnAskAI")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.AIUI?.open?.();
      window.AIUI?.addBubble?.(
        `"${item.word}"를 한국어로 쉽게 설명해줘. 뜻/발음(병음)/예문도 같이 알려줘.`,
        "user"
      );
      window.AIUI?.send?.();
    });

    // ===== 笔顺区 =====
    const hanChars = Array.from(item.word).filter(isHan);

    if (hanChars.length === 0) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-500";
      p.textContent = "이 단어에는 한자가 없어서 필순을 표시하지 않아요.";
      learnBody.appendChild(p);
      return;
    }

    const strokesWrap = document.createElement("div");
    strokesWrap.className = "mt-3";
    strokesWrap.innerHTML = `
      <div class="font-semibold mb-2">필순(筆順)</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="strokeGrid"></div>
      <div class="text-xs text-gray-500 mt-2">
        💡 파일이 없으면 “없음”으로 표시돼요. (data/strokes 폴더 확인)
      </div>
    `;
    learnBody.appendChild(strokesWrap);

    const grid = strokesWrap.querySelector("#strokeGrid");

    for (const ch of hanChars) {
      const box = document.createElement("div");
      box.className = "border rounded-xl p-3 bg-white";

      const strokeUrl = window.DATA_PATHS?.strokeUrl?.(ch);
      const fileName = window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";

      box.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="text-lg font-semibold">${escapeHtml(ch)}</div>
          <div class="flex gap-2 flex-wrap justify-end">
            <button class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
            <button class="btnPlay px-2 py-1 rounded bg-slate-100 text-xs">재생</button>
            <button class="btnPause px-2 py-1 rounded bg-slate-100 text-xs">일시정지</button>
            <button class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs">다시</button>
          </div>
        </div>

        <div class="w-full aspect-square bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
          <div class="text-xs text-gray-400">loading...</div>
        </div>

        <div class="text-[10px] text-gray-400 mt-2">${escapeHtml(fileName)}</div>
      `;

      grid.appendChild(box);

      box.querySelector(".btnSpeak")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.AIUI?.speak?.(ch, "zh-CN");
      });

      const canvas = box.querySelector(".aspect-square");

      // ✅ 使用 <object> 单独加载 SVG → 多字不会乱
      const obj = document.createElement("object");
      obj.type = "image/svg+xml";
      obj.data = strokeUrl || "";
      obj.style.width = "100%";
      obj.style.height = "100%";
      obj.style.display = "block";

      const fallback = document.createElement("div");
      fallback.className = "text-xs text-gray-400 text-center p-2";
      fallback.innerHTML = `필순 파일 없음<br/><span class="text-[10px]">${escapeHtml(fileName)}</span>`;

      canvas.innerHTML = "";
      canvas.appendChild(obj);
      obj.appendChild(fallback);

      function getSvgEl() {
        try {
          const doc = obj.contentDocument;
          return doc?.querySelector("svg") || null;
        } catch {
          return null;
        }
      }

      function replay() {
        if (!strokeUrl) return;
        const bust = `v=${Date.now()}`;
        obj.data = strokeUrl.includes("?") ? `${strokeUrl}&${bust}` : `${strokeUrl}?${bust}`;
      }

      function play() {
        const svg = getSvgEl();
        if (!svg) return;
        try { svg.unpauseAnimations(); } catch {}
      }

      function pause() {
        const svg = getSvgEl();
        if (!svg) return;
        try { svg.pauseAnimations(); } catch {}
      }

      obj.addEventListener("load", () => {
        const svg = getSvgEl();
        if (!svg) return;
        try {
          svg.setCurrentTime(0);
          svg.unpauseAnimations();
        } catch {}
      });

      box.querySelector(".btnPlay")?.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation(); play();
      });
      box.querySelector(".btnPause")?.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation(); pause();
      });
      box.querySelector(".btnReplay")?.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation(); replay();
      });
    }

    // ✅ 打开时滚动到顶部（避免一打开就在中间看不到关闭）
    try { learnBody.scrollTop = 0; } catch {}
  }

  window.LEARN_PANEL = { open, close };
})();
