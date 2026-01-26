(() => {
  "use strict";

  /* =========================
     0) API
  ========================= */
  const API_URL = "https://hanjiapass.vercel.app/api/gemini";

  /* =========================
     1) UI 多语言文案
  ========================= */
  const UI_TEXT = {
    ko: {
      title: "AI 한자 선생님",
      inputPlaceholder: "질문을 입력하세요…",
      send: "보내기",
      explainLang: "설명 언어",
      tts: "읽어주기(TTS)",
      mode: "모드",
      thinking: "잠깐만요 🙂",
      welcome: "안녕하세요 🙂\n중국어 질문, 바로 물어보세요!",
      clickHint: "💡 문장(젤리)을 클릭하면 그 부분만 읽어줘요.",
      autoVoiceHint: "(언어=음성 자동)"
    },
    en: {
      title: "AI Chinese Teacher",
      inputPlaceholder: "Ask your question…",
      send: "Send",
      explainLang: "Explanation language",
      tts: "Read aloud (TTS)",
      mode: "Mode",
      thinking: "One sec 🙂",
      welcome: "Hi 🙂\nAsk me anything about Chinese!",
      clickHint: "💡 Click a jelly line to read that part only.",
      autoVoiceHint: "(Language=Voice auto)"
    },
    ja: {
      title: "AI 中国語先生",
      inputPlaceholder: "質問を入力してください…",
      send: "送信",
      explainLang: "説明言語",
      tts: "読み上げ(TTS)",
      mode: "モード",
      thinking: "ちょっと待ってね 🙂",
      welcome: "こんにちは 🙂\n中国語、気軽に聞いてください。",
      clickHint: "💡 ゼリー文をクリックすると、その部分だけ読みます。",
      autoVoiceHint: "(言語=音声 自動)"
    },
    zh: {
      title: "AI 汉字老师",
      inputPlaceholder: "请输入你的问题…",
      send: "发送",
      explainLang: "说明语言",
      tts: "朗读(TTS)",
      mode: "模式",
      thinking: "等一下🙂",
      welcome: "你好 🙂\n有中文问题，直接问我吧。",
      clickHint: "💡 点击果冻句子，只朗读你点的那一段。",
      autoVoiceHint: "(语言=音色自动)"
    }
  };

  /* =========================
     2) DOM
  ========================= */
  const panel = document.getElementById("ai-panel");
  const chat = document.getElementById("chat");
  const input = document.getElementById("input");
  const explainLang = document.getElementById("explainLang");
  const ttsToggle = document.getElementById("ttsToggle");
  const speakMode = document.getElementById("speakMode");

  const uiTitle = document.getElementById("uiTitle");
  const uiTtsLabel = document.getElementById("uiTtsLabel");
  const uiExplainLabel = document.getElementById("uiExplainLabel");
  const uiSendBtn = document.getElementById("uiSendBtn");
  const uiModeLabel = document.getElementById("uiModeLabel");
  const uiAutoVoiceHint = document.getElementById("uiAutoVoiceHint");

  /* =========================
     3) 安全：报错显示
  ========================= */
  function showError(msg) {
    createMsgBubble("오류: " + msg, "ai");
  }
  window.addEventListener("error", (e) => {
    showError(e?.message || "Unknown error");
  });

  /* =========================
     4) UI 基础
  ========================= */
  function toggleAI() {
    panel.classList.toggle("hidden");
  }
  // ✅ 让 HTML inline onclick 能调用到
  window.toggleAI = toggleAI;

  function cleanForDisplay(text) {
    return String(text)
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/#+\s*/g, "")
      .replace(/-{3,}/g, "")
      .trim();
  }

  function createMsgBubble(initialText, who) {
    const wrap = document.createElement("div");
    wrap.className = who === "user" ? "text-right" : "text-left";

    const bubbleClass = who === "user" ? "bg-orange-500 text-white" : "bg-gray-200";
    wrap.innerHTML = `
      <span class="inline-block px-3 py-2 rounded-lg ${bubbleClass}">
        <div class="bubble"></div>
      </span>
    `;
    const bubbleDiv = wrap.querySelector(".bubble");
    bubbleDiv.textContent = cleanForDisplay(initialText);

    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
    return { wrap, bubbleDiv };
  }

  function applyUIText(lang) {
    const t = UI_TEXT[lang] || UI_TEXT.ko;

    uiTitle.innerText = t.title;
    input.placeholder = t.inputPlaceholder;
    uiSendBtn.innerText = t.send;

    uiTtsLabel.innerText = t.tts;
    uiExplainLabel.innerText = t.explainLang;
    uiModeLabel.innerText = t.mode;

    if (uiAutoVoiceHint) uiAutoVoiceHint.textContent = t.autoVoiceHint;

    chat.innerHTML = "";
    createMsgBubble(t.welcome, "ai");
  }

  /* =========================
     5) TTS：语言=音色 自动绑定
     - 点击果冻句子：只读该段
  ========================= */
  let voices = [];
  const voiceByLang = { ko: null, en: null, ja: null, zh: null };
  let speakingJobId = 0;

  function loadVoices() {
    voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
    // 语言变了就重新挑最合适的 voice
    setVoiceForLang(explainLang.value);
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  function pickBestVoice(langKey) {
    if (!voices.length) return null;

    const prefix = {
      zh: ["zh", "cmn"],
      en: ["en"],
      ko: ["ko"],
      ja: ["ja"]
    }[langKey] || [langKey];

    const found = voices.find(v =>
      prefix.some(p => (v.lang || "").toLowerCase().startsWith(p))
    );
    return found || voices[0] || null;
  }

  function setVoiceForLang(langKey) {
    voiceByLang[langKey] = pickBestVoice(langKey);
  }

  function cleanForSpeak(text) {
    return String(text)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/#+\s*/g, "")
      .replace(/-{3,}/g, " ")
      .replace(/[•●◦▶▷■□◆◇※★☆]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSpeakParams() {
    const mode = speakMode.value; // kids / exam
    if (mode === "exam") return { rate: 1.05, pitch: 1.0 };
    return { rate: 0.98, pitch: 1.07 };
  }

  function speakLine(text, uiLang) {
    if (!ttsToggle.checked) return Promise.resolve();
    if (!window.speechSynthesis) return Promise.resolve();

    const jobId = ++speakingJobId;
    const t = cleanForSpeak(text);
    if (!t) return Promise.resolve();

    const params = getSpeakParams();

    return new Promise((resolve) => {
      if (jobId !== speakingJobId) return resolve();

      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(t);
      const v = voiceByLang[uiLang] || pickBestVoice(uiLang);

      if (v) {
        u.voice = v;
        u.lang = v.lang || (uiLang === "zh" ? "zh-CN" : uiLang);
      } else {
        u.lang = (uiLang === "zh" ? "zh-CN" : uiLang);
      }

      u.rate = params.rate;
      u.pitch = params.pitch;

      u.onend = () => resolve();
      u.onerror = () => resolve();

      window.speechSynthesis.speak(u);
    });
  }

  /* =========================
     6) 果冻段渲染：点哪段读哪段
  ========================= */
  function renderJellySegments(wrapEl, fullText, uiLang) {
    const bubble = wrapEl.querySelector(".bubble");
    if (!bubble) return;

    const lines = String(fullText)
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    bubble.innerHTML = "";
    bubble.classList.add("jellyWrap");

    lines.forEach((line) => {
      const seg = document.createElement("div");
      seg.className = "jelly";
      seg.textContent = line;

      seg.addEventListener("click", async () => {
        await speakLine(line, uiLang);
      });

      bubble.appendChild(seg);
    });

    chat.scrollTop = chat.scrollHeight;
  }

  /* =========================
     7) 打字机效果（保留核心）
  ========================= */
  let typingTimer = null;
  function stopTyping() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
  }

  function typewriterRender(bubbleDiv, fullText, speed = 14, onDone) {
    stopTyping();
    const cleaned = cleanForDisplay(fullText);

    bubbleDiv.textContent = "";
    let i = 0;

    typingTimer = setInterval(() => {
      i += 1;
      bubbleDiv.textContent = cleaned.slice(0, i);
      chat.scrollTop = chat.scrollHeight;

      if (i >= cleaned.length) {
        stopTyping();
        if (typeof onDone === "function") onDone(cleaned);
      }
    }, speed);
  }

  /* =========================
     8) ✅ 离线 HSK 兜底（API 挂了也能教）
     - 先内置少量 HSK1 示例
     - 若你创建 /data/hsk1.json，会自动读取并替换
  ========================= */
  const LOCAL_HSK = {
    1: [
      { hanzi: "你好", pinyin: "nǐ hǎo", ko: "안녕하세요", en: "Hello", ja: "こんにちは", zh: "你好" },
      { hanzi: "谢谢", pinyin: "xiè xie", ko: "감사합니다", en: "Thank you", ja: "ありがとう", zh: "谢谢" },
      { hanzi: "再见", pinyin: "zài jiàn", ko: "안녕히 가세요/계세요", en: "Goodbye", ja: "さようなら", zh: "再见" },
      { hanzi: "是", pinyin: "shì", ko: "~이다/맞다", en: "to be / yes", ja: "〜です", zh: "是" },
      { hanzi: "不", pinyin: "bù", ko: "아니다/안", en: "not", ja: "〜ない", zh: "不" }
    ]
  };

  const HSK_CACHE = new Map(); // level -> array

  async function loadHSKLevel(level) {
    if (HSK_CACHE.has(level)) return HSK_CACHE.get(level);

    // 先尝试读取仓库里的 JSON：/data/hsk1.json
    try {
      const url = `./data/hsk${level}.json`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) {
          HSK_CACHE.set(level, arr);
          return arr;
        }
      }
    } catch (_) {}

    // 读不到就用本地内置
    const fallback = LOCAL_HSK[level] || LOCAL_HSK[1];
    HSK_CACHE.set(level, fallback);
    return fallback;
  }

  function exLabel(lang) {
    if (lang === "ko") return "예문";
    if (lang === "en") return "Example";
    if (lang === "ja") return "例文";
    return "例句"; // zh
  }

  function explainText(item, lang) {
    if (lang === "ko") return item.ko || "";
    if (lang === "en") return item.en || "";
    if (lang === "ja") return item.ja || "";
    return item.zh || "";
  }

  function makeOfflineLesson(userMsg, lang) {
    // 默认先从 HSK1 随机拿
    const label = exLabel(lang);
    const item = (HSK_CACHE.get(1) || LOCAL_HSK[1])[Math.floor(Math.random() * (HSK_CACHE.get(1)?.length || LOCAL_HSK[1].length))];

    const exp = explainText(item, lang);

    // 例句尽量短，符合你前端识别格式（每条一行）
    const ex1 = {
      zh: `${item.hanzi}！`,
      py: `${item.pinyin}!`,
      ko: `${exp}라고 말해요.`,
      en: `We say “${exp}”.`,
      ja: `「${exp}」と言います。`,
      zh2: `就是“${exp}”。`
    };

    const exp1 = lang === "ko" ? ex1.ko : lang === "en" ? ex1.en : lang === "ja" ? ex1.ja : ex1.zh2;

    const lesson =
`${item.hanzi}
${item.pinyin}
${exp}

${label}1：${ex1.zh} | ${ex1.py} | ${exp1}`;

    return lesson.trim();
  }

  /* =========================
     9) 发送（保留核心 + API失败自动离线兜底）
  ========================= */
  async function send() {
    const msg = input.value.trim();
    if (!msg) return;

    stopTyping();
    window.speechSynthesis && window.speechSynthesis.cancel();

    createMsgBubble(msg, "user");
    input.value = "";

    const lang = explainLang.value;
    const t = UI_TEXT[lang] || UI_TEXT.ko;

    const { wrap, bubbleDiv } = createMsgBubble(t.thinking, "ai");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: msg, explainLang: lang })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || ("HTTP " + res.status));

      const answer = data.text || "(응답 없음)";

      typewriterRender(bubbleDiv, answer, 14, async () => {
        // ✅ 打完后：果冻化（点击读单段）
        renderJellySegments(wrap, answer, lang);
      });

    } catch (e) {
      // ✅ API 挂了：离线兜底（先加载 hsk1.json；没有就用内置）
      await loadHSKLevel(1);

      const offline = makeOfflineLesson(msg, lang);
      typewriterRender(bubbleDiv, offline, 14, async () => {
        renderJellySegments(wrap, offline, lang);
      });
    }
  }
  window.send = send; // ✅ inline onclick

  /* =========================
     10) 初始化 & 切换语言
  ========================= */
  applyUIText(explainLang.value);
  setVoiceForLang(explainLang.value);

  explainLang.addEventListener("change", () => {
    stopTyping();
    window.speechSynthesis && window.speechSynthesis.cancel();

    setVoiceForLang(explainLang.value);
    applyUIText(explainLang.value);
  });

  /* =========================
     11) ✅ 面板拖动（拖标题栏）
  ========================= */
  (function enableDrag() {
    const handle = document.getElementById("dragHandle");
    if (!handle) return;

    let isDown = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function getLeftTop() {
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    }

    handle.addEventListener("pointerdown", (e) => {
      isDown = true;
      handle.setPointerCapture(e.pointerId);

      const { left, top } = getLeftTop();
      startLeft = left;
      startTop = top;
      startX = e.clientX;
      startY = e.clientY;

      // 把定位切换为 left/top（避免 bottom/right 干扰）
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = startLeft + "px";
      panel.style.top = startTop + "px";
    });

    handle.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      panel.style.left = (startLeft + dx) + "px";
      panel.style.top = (startTop + dy) + "px";
    });

    handle.addEventListener("pointerup", () => {
      isDown = false;
    });
  })();

})();
