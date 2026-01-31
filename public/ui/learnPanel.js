// ui/learnPanel.js
(function () {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function isHan(ch) {
    return /[\u3400-\u9FFF]/.test(ch);
  }

  // ✅ 最稳：永不出现 [object Object]，并支持多语言对象/数组/嵌套
  function pickText(v, lang = (window.APP_LANG || "ko")) {
    if (v == null) return "";

    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    if (Array.isArray(v)) {
      return v.map((x) => pickText(x, lang)).filter(Boolean).join(" / ");
    }

    if (typeof v === "object") {
      // 优先：lang -> ko/kr -> zh/cn -> en
      const direct =
        pickText(v?.[lang], lang) ||
        pickText(v?.ko, lang) ||
        pickText(v?.kr, lang) ||
        pickText(v?.zh, lang) ||
        pickText(v?.cn, lang) ||
        pickText(v?.en, lang);

      if (direct) return direct;

      for (const k of Object.keys(v)) {
        const t = pickText(v[k], lang);
        if (t) return t;
      }
      return "";
    }

    return "";
  }

  // ✅ 确保 learn-panel 存在（只创建一次）
  function ensurePanel() {
    let wrap = $("learn-panel") || $("learnPanel") || $("learnpanel");
    if (wrap) wrap.id = "learn-panel";

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "learn-panel";
      document.body.appendChild(wrap);
    }

    wrap.className =
      "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4";

    wrap.innerHTML = `
      <div class="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden relative">
        <div class="learnTopBar sticky top-0 z-[10000] bg-white border-b">
          <div class="flex items-center justify-between px-4 py-3">
            <div class="font-semibold">배우기</div>
            <div class="flex items-center gap-2">
              <button id="learnClose" type="button"
                class="px-3 py-1 rounded-lg bg-slate-100 text-sm hover:bg-slate-200">닫기</button>
              <button id="learnCloseX" type="button"
                class="w-9 h-9 rounded-lg bg-slate-100 text-lg leading-none hover:bg-slate-200">×</button>
            </div>
          </div>
        </div>

        <div id="learnBody" class="p-4 space-y-3 max-h-[80vh] overflow-auto"></div>
      </div>
    `;

    const closeLocal = () => $("learn-panel")?.classList.add("hidden");

    $("learnClose").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeLocal();
    };
    $("learnCloseX").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeLocal();
    };

    wrap.onclick = (e) => {
      if (e.target === wrap) closeLocal();
    };

    if (!document.body.dataset.learnEscBound) {
      document.body.dataset.learnEscBound = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLocal();
      });
    }
  }

  function close() {
    $("learn-panel")?.classList.add("hidden");
  }

  async function open(item) {
    ensurePanel();

    // ✅ 记录最近学习（你说先不加历史也可以，不影响）
    window.HSK_HISTORY?.add?.(item);

    const learnPanel = $("learn-panel");
    const learnBody = $("learnBody");
    if (!learnPanel || !learnBody) return;

    learnBody.innerHTML = "";
    learnPanel.classList.remove("hidden");

    try {
      learnBody.scrollTop = 0;
    } catch {}

    // ✅ 语言（韩语优先）
    const lang = window.APP_LANG || "ko";

    // ✅ 全部走 pickText，彻底防 object
    const word = pickText(item.word, lang);
    const pinyin = pickText(item.pinyin, lang);
    const meaningText = pickText(item.meaning, lang);
    const exampleText = pickText(item.example, lang);

    // ===== 上方信息区 =====
    const head = document.createElement("div");
    head.className = "space-y-1";

    const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");

    head.innerHTML = `
      <div class="text-2xl font-bold">${escapeHtml(word || "(빈 항목)")}</div>
      ${line2 ? `<div class="text-sm text-gray-600">${escapeHtml(line2)}</div>` : ""}
      ${
        exampleText
          ? `<div class="text-sm text-gray-500">예문: ${escapeHtml(exampleText)}</div>`
          : ""
      }
      <div class="pt-2 flex gap-2 flex-wrap">
        <button id="learnSpeakWord" type="button"
          class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">
          단어 읽기
        </button>
        <button id="learnAskAI" type="button"
          class="px-3 py-2 rounded-lg bg-slate-100 text-sm">
          AI 선생님에게 질문
        </button>
      </div>
    `;
    learnBody.appendChild(head);

    head.querySelector("#learnSpeakWord")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.AIUI?.speak?.(word, "zh-CN");
    });

    head.querySelector("#learnAskAI")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.AIUI?.open?.();

      const prompt = [
        `"${word}"를 한국어로 쉽게 설명해줘.`,
        meaningText ? `뜻: ${meaningText}` : "",
        pinyin ? `병음: ${pinyin}` : "",
        exampleText ? `예문: ${exampleText}` : "",
        "뜻/발음(병음)/예문을 더 자연스럽게 만들어서 알려줘.",
      ]
        .filter(Boolean)
        .join("\n");

      window.AIUI?.addBubble?.(prompt, "user");
      window.AIUI?.send?.();
    });

    // ===== 笔顺区 =====
    const hanChars = Array.from(word || "").filter(isHan);

    const strokesWrap = document.createElement("div");
    strokesWrap.className = "mt-3";
    learnBody.appendChild(strokesWrap);

    if (hanChars.length === 0) {
      const p = document.createElement("div");
      p.className = "text-sm text-gray-500";
      p.textContent = "이 단어에는 한자가 없어서 필순을 표시하지 않아요.";
      strokesWrap.appendChild(p);
      return;
    }

    // ✅ 给一个兜底提示：StrokePlayer 没加载时不会“空白”
    if (!window.StrokePlayer?.mountStrokeSwitcher) {
      strokesWrap.innerHTML = `
        <div class="text-sm text-red-600">
          StrokePlayer가 로드되지 않았어요.<br/>
          <span class="text-xs text-gray-500">index.html에서 strokePlayer.js가 learnPanel.js보다 먼저 로드되는지 확인해 주세요.</span>
        </div>
      `;
      return;
    }

    // ✅ 交给独立笔顺播放器
    window.StrokePlayer.mountStrokeSwitcher(strokesWrap, hanChars);
  }

  window.LEARN_PANEL = { open, close };
})();
