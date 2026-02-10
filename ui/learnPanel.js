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

  // ✅ 最稳：永不出现 [object Object]，并支持多语言对象/数组/嵌套
  function pickText(v, lang = window.APP_LANG || "ko") {
    if (v == null) return "";

    const L0 = String(lang || "").toLowerCase();
    const L = L0 === "kr" ? "ko" : L0; // 统一 kr/ko

    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    if (Array.isArray(v)) {
      return v
        .map((x) => pickText(x, L))
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(" / ");
    }

    if (typeof v === "object") {
      const direct =
        pickText(v?.[L], L) ||
        pickText(v?.ko, L) ||
        pickText(v?.kr, L) ||
        pickText(v?.["zh-cn"], L) ||
        pickText(v?.zh, L) ||
        pickText(v?.cn, L) ||
        pickText(v?.en, L);

      if (direct) return direct;

      for (const k of Object.keys(v)) {
        const t = pickText(v[k], L);
        if (t) return t;
      }
      return "";
    }

    return "";
  }

  function cleanText(v, lang) {
    const t = pickText(v, lang);
    const s = String(t ?? "").trim();
    if (!s || s === "[object Object]") return "";
    return s;
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

  function renderTabs(root, tabs, defaultKey) {
    const tabBar = document.createElement("div");
    tabBar.className = "flex gap-2 flex-wrap border-b pb-2";

    const contentWrap = document.createElement("div");
    contentWrap.className = "pt-3";

    const btns = new Map();
    const panes = new Map();

    function setActive(key) {
      for (const [k, b] of btns.entries()) {
        b.className =
          "px-3 py-2 rounded-lg text-sm " +
          (k === key ? "bg-blue-600 text-white" : "bg-slate-100 hover:bg-slate-200");
      }
      for (const [k, p] of panes.entries()) {
        p.classList.toggle("hidden", k !== key);
      }
    }

    for (const t of tabs) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t.label;
      b.className = "px-3 py-2 rounded-lg text-sm bg-slate-100 hover:bg-slate-200";
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive(t.key);
      };
      btns.set(t.key, b);
      tabBar.appendChild(b);

      const pane = document.createElement("div");
      pane.className = "hidden";
      pane.appendChild(t.node);
      panes.set(t.key, pane);
      contentWrap.appendChild(pane);
    }

    root.appendChild(tabBar);
    root.appendChild(contentWrap);

    setActive(defaultKey || (tabs[0] && tabs[0].key));
  }

  async function open(item) {
    ensurePanel();

    // ✅ 最近学习（可有可无，不影响）
    window.HSK_HISTORY?.add?.(item);

    const learnPanel = $("learn-panel");
    const learnBody = $("learnBody");
    if (!learnPanel || !learnBody) return;

    learnBody.innerHTML = "";
    learnPanel.classList.remove("hidden");

    try {
      learnBody.scrollTop = 0;
    } catch {}

    const lang = window.APP_LANG || "ko";

    // ✅ 基础字段
    const word = cleanText(item?.word ?? item?.hanzi ?? item?.hz, lang) || "(빈 항목)";
    const pinyin = cleanText(item?.pinyin, lang);
    const meaningText = cleanText(item?.meaning ?? item?.ko ?? item?.kr, lang);

    // ✅ 例句字段（全兜底）
    const exampleZh = cleanText(
      item?.exampleZh ||
        item?.exampleZH ||
        item?.example_zh ||
        item?.sentenceZh ||
        item?.sentence ||
        item?.example,
      "zh"
    );

    const examplePinyin = cleanText(
      item?.examplePinyin ||
        item?.sentencePinyin ||
        item?.example_py ||
        item?.examplePY,
      lang
    );

    const exampleKr = cleanText(
      item?.exampleExplainKr ||
        item?.exampleKR ||
        item?.explainKr ||
        item?.krExplain ||
        item?.example?.kr,
      "ko"
    );

    // ===== Header =====
    const head = document.createElement("div");
    head.className = "space-y-2";

    const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");

    head.innerHTML = `
      <div class="text-3xl font-bold">${escapeHtml(word)}</div>
      ${line2 ? `<div class="text-sm text-gray-600">${escapeHtml(line2)}</div>` : ""}

      <div class="pt-2 flex gap-2 flex-wrap">
        <button id="learnSpeakWord" type="button"
          class="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">
          단어 읽기
        </button>
        <button id="learnAskAI" type="button"
          class="px-3 py-2 rounded-lg bg-slate-100 text-sm">
          AI 선생님에게 질문
        </button>
        <button id="learnMakeQuiz" type="button"
          class="px-3 py-2 rounded-lg bg-slate-100 text-sm">
          AI 연습 만들기
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
        `단어: "${word}"`,
        meaningText ? `뜻: ${meaningText}` : "",
        pinyin ? `병음: ${pinyin}` : "",
        exampleZh ? `예문(중문): ${exampleZh}` : "",
        examplePinyin ? `예문(병음): ${examplePinyin}` : "",
        exampleKr ? `예문 해석(한글): ${exampleKr}` : "",
        "",
        "요청: 한국어로 아주 쉽게 설명해주고, 아이에게 가르치듯이 예시를 2개 더 만들어줘.",
      ]
        .filter(Boolean)
        .join("\n");

      window.AIUI?.addBubble?.(prompt, "user");
      window.AIUI?.send?.();
    });

    head.querySelector("#learnMakeQuiz")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.AIUI?.open?.();

      const prompt = [
        `단어: "${word}"`,
        meaningText ? `뜻: ${meaningText}` : "",
        pinyin ? `병음: ${pinyin}` : "",
        exampleZh ? `예문(중문): ${exampleZh}` : "",
        exampleKr ? `예문 해석(한글): ${exampleKr}` : "",
        "",
        "요청:",
        "1) 초급 학습자용 연습 5개 만들어줘 (빈칸채우기 2, OX 2, 짧은 말하기 1).",
        "2) 정답도 함께 줘.",
        "3) 전체는 한국어로 설명하고, 중국어 예문은 중국어 그대로 써줘.",
      ].join("\n");

      window.AIUI?.addBubble?.(prompt, "user");
      window.AIUI?.send?.();
    });

    // ===== Tabs =====
    const tabsRoot = document.createElement("div");
    tabsRoot.className = "mt-4";
    learnBody.appendChild(tabsRoot);

    // Tab: 단어
    const tabWord = document.createElement("div");
    tabWord.className = "space-y-2";
    tabWord.innerHTML = `
      ${meaningText ? `<div class="text-base text-gray-800"><b>뜻</b> : ${escapeHtml(meaningText)}</div>` : ""}
      ${pinyin ? `<div class="text-base text-gray-800"><b>병음</b> : ${escapeHtml(pinyin)}</div>` : ""}
      <div class="text-sm text-gray-500">단어를 누르면 위에서 “단어 읽기”로 발음을 들을 수 있어요.</div>
    `;

    // Tab: 造句
    const tabExample = document.createElement("div");
    tabExample.className = "space-y-2";
    tabExample.innerHTML = `
      ${exampleZh ? `<div class="p-3 rounded-xl bg-gray-50">${escapeHtml(exampleZh)}</div>` : `<div class="text-sm text-gray-500">예문 데이터가 아직 없어요.</div>`}
      ${examplePinyin ? `<div class="text-sm text-blue-600">${escapeHtml(examplePinyin)}</div>` : ""}
      ${exampleKr ? `<div class="text-sm text-gray-600">${escapeHtml(exampleKr)}</div>` : ""}
    `;

    // Tab: 笔顺
    const tabStroke = document.createElement("div");
    tabStroke.className = "space-y-2";

    const hanChars = Array.from(word || "").filter(isHan);
    if (hanChars.length === 0) {
      tabStroke.innerHTML = `<div class="text-sm text-gray-500">이 단어에는 한자가 없어서 필순을 표시하지 않아요.</div>`;
    } else if (!window.StrokePlayer?.mountStrokeSwitcher) {
      tabStroke.innerHTML = `
        <div class="text-sm text-red-600">
          StrokePlayer가 로드되지 않았어요.<br/>
          <span class="text-xs text-gray-500">index.html에서 strokePlayer.js가 learnPanel.js보다 먼저 로드되는지 확인해 주세요.</span>
        </div>
      `;
    } else {
      const strokesWrap = document.createElement("div");
      strokesWrap.className = "mt-2";
      tabStroke.appendChild(strokesWrap);
      window.StrokePlayer.mountStrokeSwitcher(strokesWrap, hanChars);
    }

    // Tab: AI
    const tabAI = document.createElement("div");
    tabAI.className = "space-y-2";
    tabAI.innerHTML = `
      <div class="text-sm text-gray-600">
        아래 버튼으로 AI 연습을 만들거나, 질문을 보내 학습을 확장할 수 있어요.
      </div>
      <div class="flex gap-2 flex-wrap">
        <button id="aiExplain" type="button" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">쉽게 설명</button>
        <button id="aiMoreExamples" type="button" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">예문 3개 추가</button>
        <button id="aiQuiz" type="button" class="px-3 py-2 rounded-lg bg-slate-100 text-sm">퀴즈 만들기</button>
      </div>
    `;

    const bindAIButton = (id, promptLines) => {
      tabAI.querySelector(id)?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.AIUI?.open?.();
        window.AIUI?.addBubble?.(promptLines.filter(Boolean).join("\n"), "user");
        window.AIUI?.send?.();
      });
    };

    bindAIButton("#aiExplain", [
      `단어: "${word}"`,
      meaningText ? `뜻: ${meaningText}` : "",
      pinyin ? `병음: ${pinyin}` : "",
      "요청: 한국 초등학생도 이해할 수 있게 아주 쉽게 설명해줘.",
    ]);

    bindAIButton("#aiMoreExamples", [
      `단어: "${word}"`,
      meaningText ? `뜻: ${meaningText}` : "",
      "요청: 이 단어로 짧은 중국어 예문 3개와 한국어 번역을 만들어줘. (HSK1~2 수준)",
    ]);

    bindAIButton("#aiQuiz", [
      `단어: "${word}"`,
      meaningText ? `뜻: ${meaningText}` : "",
      "요청: 빈칸채우기 2개 + OX 2개 + 말하기 1개를 만들고 정답도 같이 줘.",
    ]);

    renderTabs(
      tabsRoot,
      [
        { key: "word", label: "단어", node: tabWord },
        { key: "example", label: "造句", node: tabExample },
        { key: "stroke", label: "笔顺", node: tabStroke },
        { key: "ai", label: "AI", node: tabAI },
      ],
      "word"
    );
  }

  window.LEARN_PANEL = { open, close };
})();
