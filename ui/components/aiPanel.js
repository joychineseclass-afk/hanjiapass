// /ui/components/aiPanel.js
// ✅ STABLE / NO-REWORK EDITION
// - UI only (no business logic)
// - Uses /styles/panels.css for all styles (no <style> injection)
// - Events:
//   openAIPanel / closeAIPanel / ai:push / ai:clear / ai:send
// - Optional drag (default: false; recommend on desktop only)

let mounted = false;

export function mountAIPanel(opts = {}) {
  if (mounted) return;
  mounted = true;

  const {
    container = document.body,
    defaultOpen = false,
    draggable = false,      // ✅ 默认关（移动端更稳定）
    rememberState = true,   // ✅ 记住打开/关闭
    storageKey = "joy_ai_open",
  } = opts;

  const wrap = document.createElement("div");
  wrap.id = "ai-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const panel = wrap.querySelector("#aiPanel");
  const fab = wrap.querySelector("#aiFab");
  const closeBtn = wrap.querySelector("#aiCloseBtn");
  const dragHandle = wrap.querySelector("#aiDragHandle");

  const chat = wrap.querySelector("#aiChat");
  const input = wrap.querySelector("#aiInput");
  const sendBtn = wrap.querySelector("#aiSendBtn");

  const ttsToggle = wrap.querySelector("#aiTTSToggle");
  const explainLang = wrap.querySelector("#aiExplainLang");
  const speakMode = wrap.querySelector("#aiSpeakMode");

  if (!panel || !fab || !closeBtn || !chat || !input || !sendBtn) return;

  // ===== state =====
  let isOpen = false;

  function setOpen(next) {
    isOpen = !!next;
    panel.classList.toggle("is-open", isOpen);
    fab.classList.toggle("is-hidden", isOpen);

    if (rememberState) {
      try {
        localStorage.setItem(storageKey, isOpen ? "1" : "0");
      } catch {}
    }

    // open 时自动聚焦输入
    if (isOpen) {
      setTimeout(() => {
        try { input.focus(); } catch {}
      }, 0);
    }
  }

  function open() { setOpen(true); }
  function close() { setOpen(false); }
  function toggle() { setOpen(!isOpen); }

  // ===== init open state =====
  if (rememberState) {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
      else setOpen(!!defaultOpen);
    } catch {
      setOpen(!!defaultOpen);
    }
  } else {
    setOpen(!!defaultOpen);
  }

  // ===== bubbles =====
  function pushBubble(text, who = "bot") {
    const msg = String(text ?? "").trim();
    if (!msg) return;

    const b = document.createElement("div");
    b.className = `ai-bubble ${who === "user" ? "is-user" : "is-bot"}`;
    b.textContent = msg;

    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  function clearChat() {
    chat.innerHTML = "";
  }

  // ===== send =====
  function handleSend() {
    const v = (input.value || "").trim();
    if (!v) return;

    pushBubble(v, "user");
    input.value = "";

    // ✅ 只抛事件，不做业务
    window.dispatchEvent(
      new CustomEvent("ai:send", {
        detail: {
          text: v,
          // ✅ 这些控件值也一起抛出，外部 aiUI.js 可以直接用
          prefs: {
            tts: !!ttsToggle?.checked,
            explainLang: explainLang?.value || "ko",
            speakMode: speakMode?.value || "kids",
          },
        },
      })
    );
  }

  // ===== ui events =====
  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Esc 关闭（桌面更友好）
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) close();
  });

  // ===== external events =====
  window.addEventListener("openAIPanel", open);
  window.addEventListener("closeAIPanel", close);

  window.addEventListener("ai:push", (e) => {
    const { text, who, open: autoOpen } = e.detail || {};
    if (autoOpen) open();
    pushBubble(text, who || "bot");
  });

  window.addEventListener("ai:clear", () => {
    clearChat();
  });

  // ===== draggable (optional) =====
  if (draggable) enableDrag(panel, dragHandle);

  return {
    open,
    close,
    toggle,
    push: pushBubble,
    clear: clearChat,
    getPrefs: () => ({
      tts: !!ttsToggle?.checked,
      explainLang: explainLang?.value || "ko",
      speakMode: speakMode?.value || "kids",
    }),
  };
}

function tpl() {
  return `
    <!-- Floating button -->
    <button id="aiFab" type="button" class="ai-fab" aria-label="Open AI" title="AI">🤖</button>

    <!-- Panel -->
    <section id="aiPanel" class="ai-panel" aria-label="AI Panel" role="dialog" aria-modal="false">
      <header id="aiDragHandle" class="ai-panel__header">
        <span class="ai-panel__title" id="uiTitle" data-i18n="ai_title">AI 한자 선생님</span>
        <button id="aiCloseBtn" type="button" class="ai-icon-btn" aria-label="close">✖</button>
      </header>

      <div class="ai-panel__controls">
        <label class="ai-row">
          <input id="aiTTSToggle" type="checkbox" checked />
          <span data-i18n="ai_tts">읽어주기(TTS)</span>
        </label>

        <div class="ai-row">
          <span class="ai-label" data-i18n="ai_explain_lang">설명 언어</span>
          <select id="aiExplainLang" class="ai-select">
            <option value="ko" selected>한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <div class="ai-row">
          <span class="ai-label" data-i18n="ai_mode">모드</span>
          <select id="aiSpeakMode" class="ai-select">
            <option value="kids" selected>Kids</option>
            <option value="exam">Exam</option>
          </select>
        </div>

        <div class="ai-tip" data-i18n="ai_tip">💡 문장을 클릭하면 그 부분만 읽어줘요.</div>
      </div>

      <div id="aiChat" class="ai-chat" aria-label="Chat"></div>

      <footer class="ai-panel__inputbar">
        <input
          id="aiInput"
          class="ai-input"
          placeholder="질문을 입력하세요…"
          data-i18n-placeholder="ai_placeholder"
          autocomplete="off"
        />
        <button id="aiSendBtn" type="button" class="ai-send" data-i18n="ai_send">보내기</button>
      </footer>
    </section>
  `;
}

function enableDrag(panel, handle) {
  if (!panel || !handle) return;

  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  function onDown(e) {
    dragging = true;

    const r = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = r.left;
    startTop = r.top;

    // ✅ 拖动后改为 top/left 定位，避免和 right/bottom 打架
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${startLeft}px`;
    panel.style.top = `${startTop}px`;

    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    panel.style.left = `${startLeft + dx}px`;
    panel.style.top = `${startTop + dy}px`;
    e.preventDefault();
  }

  function onUp(e) {
    dragging = false;
    e.preventDefault();
  }

  handle.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
