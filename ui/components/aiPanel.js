// /ui/components/aiPanel.js
// - AI 面板（一次性挂载）
// - 支持拖动（可关）
// - 支持事件：openAIPanel / closeAIPanel / ai:push / ai:clear
// - 不依赖 Tailwind（但兼容你页面已有 Tailwind）
// - 预留 i18n: data-i18n

let mounted = false;

export function mountAIPanel(opts = {}) {
  if (mounted) return;
  mounted = true;

  const {
    container = document.body,
    defaultOpen = false,
    draggable = true,
  } = opts;

  const wrap = document.createElement("div");
  wrap.id = "ai-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const panel = wrap.querySelector("#ai-panel");
  const btn = wrap.querySelector("#botBtn");
  const closeBtn = wrap.querySelector("#closeBtn");
  const dragHandle = wrap.querySelector("#dragHandle");
  const chat = wrap.querySelector("#chat");
  const input = wrap.querySelector("#input");
  const sendBtn = wrap.querySelector("#uiSendBtn");

  // ---------- open/close ----------
  const open = () => {
    panel.classList.remove("hidden");
    btn.classList.add("hidden");
  };
  const close = () => {
    panel.classList.add("hidden");
    btn.classList.remove("hidden");
  };

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  if (defaultOpen) open();
  else close();

  // ---------- send ----------
  function pushBubble(text, who = "user") {
    const b = document.createElement("div");
    b.className =
      who === "user"
        ? "ai-bubble ai-bubble-user"
        : "ai-bubble ai-bubble-bot";
    b.textContent = String(text ?? "");
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  function handleSend() {
    const v = (input.value || "").trim();
    if (!v) return;

    pushBubble(v, "user");
    input.value = "";

    // ✅ 这里先只做事件抛出，不在组件里写业务逻辑（不返工）
    // 你可以在 aiUI.js 里监听 "ai:send" 来接 OpenAI / 规则回复 / TTS 等
    window.dispatchEvent(new CustomEvent("ai:send", { detail: { text: v } }));
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // ---------- external events ----------
  window.addEventListener("openAIPanel", open);
  window.addEventListener("closeAIPanel", close);

  // 外部推送一条消息到面板（比如：点了单词卡 -> 自动把词丢到 AI）
  window.addEventListener("ai:push", (e) => {
    const { text, who } = e.detail || {};
    pushBubble(text, who || "bot");
  });

  window.addEventListener("ai:clear", () => {
    chat.innerHTML = "";
  });

  // ---------- draggable ----------
  if (draggable) enableDrag(panel, dragHandle);

  // ---------- expose helpers (optional) ----------
  // 不挂 window，全靠事件；这里留个返回值方便你在 page 里直接调用
  return { open, close, push: pushBubble };
}

function tpl() {
  return `
    <button
      id="botBtn"
      type="button"
      class="fixed bottom-4 right-4 bg-black text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
      aria-label="Open AI Panel"
      title="AI"
    >🤖</button>

    <div
      id="ai-panel"
      class="hidden fixed bottom-20 right-4 w-[92vw] max-w-[390px] bg-white rounded-xl shadow-xl flex flex-col"
      style="z-index: 9999;"
    >
      <div
        id="dragHandle"
        class="bg-black text-white px-4 py-2 rounded-t-xl flex justify-between items-center cursor-move select-none"
      >
        <span id="uiTitle" data-i18n="ai_title">AI 한자 선생님</span>
        <button id="closeBtn" type="button" aria-label="close">✖</button>
      </div>

      <div
        id="controlBar"
        class="px-3 pt-3 pb-2 border-b text-xs space-y-2 sticky top-0 bg-white z-10"
      >
        <div class="flex items-center gap-2">
          <input id="ttsToggle" type="checkbox" checked class="accent-orange-500" />
          <label for="ttsToggle" data-i18n="ai_tts">읽어주기(TTS)</label>
        </div>

        <div class="flex items-center gap-2">
          <span class="w-[120px] text-gray-600" data-i18n="ai_explain_lang">설명 언어</span>
          <select id="explainLang" class="flex-1 border rounded px-2 py-1 text-xs">
            <option value="ko" selected>한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <span class="w-[120px] text-gray-600" data-i18n="ai_mode">모드</span>
          <select id="speakMode" class="flex-1 border rounded px-2 py-1 text-xs">
            <option value="kids" selected>Kids</option>
            <option value="exam">Exam</option>
          </select>
        </div>

        <div class="text-[11px] text-gray-500 leading-4" data-i18n="ai_tip">
          💡 문장을 클릭하면 그 부분만 읽어줘요.
        </div>
      </div>

      <div id="chat" class="ai-chat p-3 space-y-2 text-sm" style="max-height:60vh; overflow:auto;"></div>

      <div class="p-3 border-t flex gap-2">
        <input id="input" class="flex-1 border rounded px-2 py-2"
          data-i18n-placeholder="ai_placeholder"
          placeholder="질문을 입력하세요…" autocomplete="off" />
        <button id="uiSendBtn" type="button"
          class="bg-orange-500 text-white px-4 py-2 rounded"
          data-i18n="ai_send"
        >보내기</button>
      </div>
    </div>

    <style>
      /* 组件私有样式：不和全站冲突 */
      #ai-panel-root .ai-bubble{
        padding:10px 12px;
        border-radius:14px;
        max-width: 92%;
        white-space: pre-wrap;
        word-break: break-word;
      }
      #ai-panel-root .ai-bubble-user{
        margin-left:auto;
        background: rgba(245,158,11,.12);
        border: 1px solid rgba(245,158,11,.25);
      }
      #ai-panel-root .ai-bubble-bot{
        margin-right:auto;
        background: rgba(37,99,235,.08);
        border: 1px solid rgba(37,99,235,.18);
      }
    </style>
  `;
}

function enableDrag(panel, handle) {
  if (!panel || !handle) return;

  let dragging = false;
  let startX = 0,
    startY = 0,
    startLeft = 0,
    startTop = 0;

  function onDown(e) {
    dragging = true;
    const r = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = r.left;
    startTop = r.top;

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
