(function () {
  const $ = (id) => document.getElementById(id);

  // ===== DOM (允许缺失，不崩) =====
  const botBtn = $("botBtn");
  const panel = $("ai-panel");
  const closeBtn = $("closeBtn");
  const sendBtn = $("uiSendBtn");
  const chat = $("chat");
  const input = $("input");

  const ttsToggle = $("ttsToggle");
  const explainLang = $("explainLang");
  const speakMode = $("speakMode");

  const dragHandle = $("dragHandle");

  // ===== Config =====
  const POS_KEY = "AI_PANEL_POS_V1";
  const DEFAULT_LANG = "ko"; // 网站韩语优先
  const DEFAULT_MODE = "kids";
  const MAX_CHAT_BUBBLES = 80; // 防止越聊越卡
  const TTS_CHUNK_LEN = 160; // 长文本分段朗读，避免某些手机吞字/中断

  // ===== State =====
  let isOpen = false;

  // drag state
  let isDragging = false;
  let startX = 0,
    startY = 0;
  let startLeft = 0,
    startTop = 0;

  // ===== Utils =====
  function safeText(x) {
    return String(x ?? "").trim();
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function ensurePanelReady() {
    if (!panel) return false;
    return true;
  }

  function pruneChat() {
    if (!chat) return;
    // 保留最后 MAX_CHAT_BUBBLES 条，避免 DOM 太多卡顿
    while (chat.children.length > MAX_CHAT_BUBBLES) {
      chat.removeChild(chat.firstChild);
    }
  }

  function scrollChatToBottom() {
    if (!chat) return;
    chat.scrollTop = chat.scrollHeight;
  }

  function addBubble(text, who = "bot") {
    if (!chat) return;

    const wrap = document.createElement("div");
    wrap.className =
      `bubble px-3 py-2 rounded-xl whitespace-pre-wrap break-words ` +
      (who === "user" ? "bg-orange-100 ml-auto" : "bg-gray-100 mr-auto");
    wrap.textContent = text;

    // 点击句子只读选中段（TTS）
    wrap.addEventListener("click", () => {
      const sel = window.getSelection?.()?.toString()?.trim();
      if (sel) speak(sel, langForTTS());
      else speak(text, langForTTS());
    });

    chat.appendChild(wrap);
    pruneChat();
    scrollChatToBottom();
  }

  function langForTTS() {
    const v = explainLang?.value || DEFAULT_LANG;
    if (v === "ko") return "ko-KR";
    if (v === "zh") return "zh-CN";
    if (v === "ja") return "ja-JP";
    return "en-US";
  }

  function canTTS() {
    return !!(ttsToggle?.checked && "speechSynthesis" in window);
  }

  function stopSpeak() {
    try {
      window.speechSynthesis?.cancel?.();
    } catch {}
  }

  // 长文本分段，避免移动端 TTS 卡顿/中断
  function chunkText(text) {
    const t = safeText(text);
    if (!t) return [];

    // 优先按换行/句号切，再按长度硬切
    const rough = t
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.!?。？！])\s*/))
      .map((s) => s.trim())
      .filter(Boolean);

    const out = [];
    for (const part of rough) {
      if (part.length <= TTS_CHUNK_LEN) out.push(part);
      else {
        for (let i = 0; i < part.length; i += TTS_CHUNK_LEN) {
          out.push(part.slice(i, i + TTS_CHUNK_LEN));
        }
      }
    }
    return out;
  }

  function pickVoice(lang) {
    // 不强制指定 voice，默认系统更稳定
    // 但我们可以尽量挑语言匹配的 voice（存在就用，不存在就系统默认）
    try {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      const short = String(lang || "").toLowerCase(); // e.g. ko-kr
      const hit = voices.find((v) => String(v.lang || "").toLowerCase() === short);
      return hit || null;
    } catch {
      return null;
    }
  }

  function speak(text, lang = "ko-KR") {
    if (!canTTS()) return;
    if (!safeText(text)) return;

    stopSpeak();

    const parts = chunkText(text);
    if (parts.length === 0) return;

    const voice = pickVoice(lang);

    // 顺序朗读
    for (const p of parts) {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = lang;

      // 可在这里后续扩展：语速、音高、音量（先保持默认最稳）
      // u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;

      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    }
  }

  // ===== Panel open/close =====
  function open() {
    if (!ensurePanelReady()) return;
    panel.classList.remove("hidden");
    isOpen = true;
    restorePosition(); // 打开时恢复上次位置
    // 让输入框更好用
    try {
      input?.focus?.();
    } catch {}
  }

  function close() {
    if (!ensurePanelReady()) return;
    panel.classList.add("hidden");
    isOpen = false;
    stopSpeak(); // 关闭面板停止朗读
  }

  // 页面切到后台/隐藏：停止朗读，避免打扰
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopSpeak();
  });

  // ===== Drag (mouse + touch) =====
  function setPanelAbsolute(left, top) {
    if (!panel) return;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function getPanelRect() {
    if (!panel) return { left: 0, top: 0, width: 0, height: 0 };
    return panel.getBoundingClientRect();
  }

  function savePosition(left, top) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left, top }));
    } catch {}
  }

  function restorePosition() {
    if (!panel) return;
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj) return;

      const rect = getPanelRect();
      // 视口内约束：防止跑出屏幕
      const vw = window.innerWidth || 360;
      const vh = window.innerHeight || 640;

      const left = clamp(Number(obj.left ?? rect.left), 8, Math.max(8, vw - rect.width - 8));
      const top = clamp(Number(obj.top ?? rect.top), 8, Math.max(8, vh - rect.height - 8));
      setPanelAbsolute(left, top);
    } catch {}
  }

  function onDragStart(clientX, clientY) {
    if (!panel) return;
    isDragging = true;
    const rect = getPanelRect();
    startX = clientX;
    startY = clientY;
    startLeft = rect.left;
    startTop = rect.top;

    setPanelAbsolute(rect.left, rect.top);
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging || !panel) return;

    const rect = getPanelRect();
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;

    const dx = clientX - startX;
    const dy = clientY - startY;

    const left = clamp(startLeft + dx, 8, Math.max(8, vw - rect.width - 8));
    const top = clamp(startTop + dy, 8, Math.max(8, vh - rect.height - 8));

    setPanelAbsolute(left, top);
  }

  function onDragEnd() {
    if (!panel) return;
    if (!isDragging) return;
    isDragging = false;

    const rect = getPanelRect();
    savePosition(rect.left, rect.top);
  }

  // mouse events
  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    onDragStart(e.clientX, e.clientY);
  }
  function onMouseMove(e) {
    onDragMove(e.clientX, e.clientY);
  }
  function onMouseUp() {
    onDragEnd();
  }

  // touch events (mobile)
  function onTouchStart(e) {
    const t = e.touches?.[0];
    if (!t) return;
    e.preventDefault();
    onDragStart(t.clientX, t.clientY);
  }
  function onTouchMove(e) {
    const t = e.touches?.[0];
    if (!t) return;
    onDragMove(t.clientX, t.clientY);
  }
  function onTouchEnd() {
    onDragEnd();
  }

  dragHandle?.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  dragHandle?.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);

  // 视口变化：把面板拉回视口内（横竖屏切换很常见）
  window.addEventListener("resize", () => {
    if (!panel || !isOpen) return;
    restorePosition();
  });

  // ===== Send =====
  async function send() {
    const text = safeText(input?.value);
    if (!text) return;

    addBubble(text, "user");
    if (input) input.value = "";

    const mode = speakMode?.value || DEFAULT_MODE;
    const lang = explainLang?.value || DEFAULT_LANG;

    let reply = "";
    if (lang === "ko") {
      reply =
        mode === "kids"
          ? `좋아요! 😊 "${text}"에 대해 쉬운 말로 설명해볼게요.\n\n(1) 핵심 뜻\n(2) 예문 1개\n(3) 기억 팁`
          : `시험 모드로 정리해볼게요.\n\n- 의미/용법\n- 자주 나오는 패턴\n- 예문(HSK 스타일)\n\n질문: ${text}`;
    } else {
      reply = `(${lang}/${mode}) 답변 템플릿입니다:\n${text}`;
    }

    addBubble(reply, "bot");
    speak(reply, langForTTS());
  }

  // Enter 发送 / Shift+Enter 换行（如果 input 是 textarea 也适用）
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // events
  botBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  sendBtn?.addEventListener("click", send);

  // 初始：如果面板默认显示，就恢复位置
  try {
    if (panel && !panel.classList.contains("hidden")) {
      isOpen = true;
      restorePosition();
    }
  } catch {}

  window.AIUI = { open, close, send, addBubble, speak, stopSpeak };
})();
