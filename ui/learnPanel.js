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

  // ✅ 统一把 meaning/example 转成“当前语言的字符串”，避免 [object Object]
  function pickText(v) {
    // 优先使用 learn.js 里提供的 pickLang（支持 ko 优先 & 跟随 window.APP_LANG）
    if (window.strokeUI?.pickLang) return window.strokeUI.pickLang(v);

    // 兜底：如果没有 strokeUI，就尽量安全转字符串
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map(pickText).filter(Boolean).join(" / ");
    if (typeof v === "object") {
      // 尝试常见字段
      return (
        pickText(v.ko) ||
        pickText(v.zh) ||
        pickText(v.en) ||
        pickText(Object.values(v).find((x) => pickText(x)))
      );
    }
    return String(v);
  }

  // ✅ 确保 learn-panel 存在（只创建一次）
  function ensurePanel() {
    // 1) 兼容旧 id
    let wrap = $("learn-panel") || $("learnPanel") || $("learnpanel");
    if (wrap) wrap.id = "learn-panel";

    // 2) 不存在才创建
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "learn-panel";
      document.body.appendChild(wrap);
    }

    // 3) ✅ 每次都覆盖模板（保证按钮一定存在）
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

    // 4) 绑定关闭（用 onclick 覆盖，避免重复绑定）
    const close = () => $("learn-panel")?.classList.add("hidden");

    $("learnClose").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    $("learnCloseX").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    };

    wrap.onclick = (e) => {
      if (e.target === wrap) close();
    };

    // 5) ESC 只绑一次
    if (!document.body.dataset.learnEscBound) {
      document.body.dataset.learnEscBound = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    }
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

    // ✅ 打开时先滚回顶部
    try {
      learnBody.scrollTop = 0;
    } catch {}

    // ✅ 把 meaning/example 转成文本（当前语言）
    const word = pickText(item.word);
    const pinyin = pickText(item.pinyin);
    const meaningText = pickText(item.meaning);
    const exampleText = pickText(item.example);

    // ===== 上方信息区 =====
    const head = document.createElement("div");
    head.className = "space-y-1";

    const line2 = [pinyin, meaningText].filter(Boolean).join(" · ");

    head.innerHTML = `
      <div class="text-2xl font-bold">${escapeHtml(word)}</div>
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

      // ✅ AI 질문也用当前 meaning/example（不会 object）
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

      const strokeUrl = window.DATA_PATHS?.strokeUrl?.(ch) || "";
      const fileName = window.DATA_PATHS?.strokeFileNameForChar?.(ch) || "";

      box.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="text-lg font-semibold">${escapeHtml(ch)}</div>
          <div class="flex gap-2 flex-wrap justify-end">
            <button type="button" class="btnSpeak px-2 py-1 rounded bg-slate-100 text-xs">읽기</button>
            <button type="button" class="btnPlay px-2 py-1 rounded bg-slate-100 text-xs">재생</button>
            <button type="button" class="btnPause px-2 py-1 rounded bg-slate-100 text-xs">일시정지</button>
            <button type="button" class="btnReplay px-2 py-1 rounded bg-slate-100 text-xs">다시</button>
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

      // ✅ <object> 单独加载 SVG：多字不串台
      const obj = document.createElement("object");
      obj.type = "image/svg+xml";
      obj.data = strokeUrl;
      obj.style.width = "100%";
      obj.style.height = "100%";
      obj.style.display = "block";

      const fb = document.createElement("div");
      fb.className = "text-xs text-gray-400 text-center p-2";
      fb.innerHTML = `필순 파일 없음<br/><span class="text-[10px]">${escapeHtml(
        fileName
      )}</span>`;

      canvas.innerHTML = "";
      canvas.appendChild(obj);
      obj.appendChild(fb);

      function getSvgEl() {
        try {
          return obj.contentDocument?.querySelector("svg") || null;
        } catch {
          return null;
        }
      }

      function replay() {
        if (!strokeUrl) return;
        const bust = `v=${Date.now()}`;
        obj.data = strokeUrl.includes("?")
          ? `${strokeUrl}&${bust}`
          : `${strokeUrl}?${bust}`;
      }

      function play() {
        const svg = getSvgEl();
        if (!svg) return;
        try {
          svg.unpauseAnimations();
        } catch {}
      }

      function pause() {
        const svg = getSvgEl();
        if (!svg) return;
        try {
          svg.pauseAnimations();
        } catch {}
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
        e.preventDefault();
        e.stopPropagation();
        play();
      });
      box.querySelector(".btnPause")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        pause();
      });
      box.querySelector(".btnReplay")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        replay();
      });
    }
  }

  // 供外部调用
  window.LEARN_PANEL = { open, close };
})();
