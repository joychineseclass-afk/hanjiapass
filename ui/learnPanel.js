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
      return (
        pickText(v.ko) ||
        pickText(v.kr) ||
        pickText(v.zh) ||
        pickText(v.cn) ||
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

    const close = () => $("learn-panel")?.classList.add("hidden");

    // 4) 绑定关闭（用 onclick 覆盖，避免重复绑定）
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

    // ✅ 记录最近学习（你说先不加历史也可以，不影响）
    window.HSK_HISTORY?.add?.(item);

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

    // ✅ 一个区域 + 按字切换（不会挤满）
    const strokeBox = document.createElement("div");
    strokeBox.className = "mt-3";
    learnBody.appendChild(strokeBox);
    mountStrokeSwitcher(strokeBox, hanChars);
  }

  // 供外部调用
  window.LEARN_PANEL = { open, close };
})();
