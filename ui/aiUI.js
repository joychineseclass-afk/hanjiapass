(function () {
  const $ = (id) => document.getElementById(id);

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

  function addBubble(text, who = "bot") {
    const wrap = document.createElement("div");
    wrap.className = `bubble px-3 py-2 rounded-xl ${who === "user" ? "bg-orange-100 ml-auto" : "bg-gray-100 mr-auto"}`;
    wrap.textContent = text;

    // 点击句子只读这段（TTS）
    wrap.addEventListener("click", () => {
      const sel = window.getSelection()?.toString()?.trim();
      if (sel) speak(sel, langForTTS());
      else speak(text, langForTTS());
    });

    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  function langForTTS() {
    // 你可以按需要调整：ko-KR / zh-CN / en-US / ja-JP
    const v = explainLang?.value || "ko";
    if (v === "ko") return "ko-KR";
    if (v === "zh") return "zh-CN";
    if (v === "ja") return "ja-JP";
    return "en-US";
  }

  function speak(text, lang = "ko-KR") {
    if (!ttsToggle?.checked) return;
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  }

  function open() {
    panel.classList.remove("hidden");
  }
  function close() {
    panel.classList.add("hidden");
  }

  // ===== 拖拽 =====
  let isDragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;

  function onMouseDown(e) {
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = `${startLeft + dx}px`;
    panel.style.top = `${startTop + dy}px`;
  }

  function onMouseUp() {
    isDragging = false;
  }

  dragHandle?.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  // ===== 发送 =====
  async function send() {
    const text = (input?.value || "").trim();
    if (!text) return;

    addBubble(text, "user");
    input.value = "";

    // 这里先做本地“AI老师”模拟：你以后如果接 OpenAI / Gemini 接口，就替换这里
    const mode = speakMode?.value || "kids";
    const lang = explainLang?.value || "ko";

    let reply = "";
    if (lang === "ko") {
      reply = mode === "kids"
        ? `좋아요! 😊 "${text}"에 대해 쉬운 말로 설명해볼게요.\n\n(1) 핵심 뜻\n(2) 예문 1개\n(3) 기억 팁`
        : `시험 모드로 정리해볼게요.\n\n- 의미/용법\n- 자주 나오는 패턴\n- 예문(HSK 스타일)\n\n질문: ${text}`;
    } else {
      reply = `(${lang}/${mode}) 답변 템플릿입니다:\n${text}`;
    }

    addBubble(reply, "bot");
    speak(reply, langForTTS());
  }

  // events
  botBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  sendBtn?.addEventListener("click", send);

  window.AIUI = { open, close, send, addBubble, speak };
})();
