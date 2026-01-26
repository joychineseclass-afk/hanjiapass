
/* ui/aiUI.js */

// =========================
// UI TEXT
// =========================
const UI_TEXT = {
  ko: {
    title: "AI 한자 선생님",
    inputPlaceholder: "질문을 입력하세요…",
    send: "보내기",
    explainLang: "설명 언어",
    tts: "읽어주기(TTS)",
    thinking: "잠깐만요 🙂",
    welcome: "안녕하세요 🙂\n중국어 질문, 바로 물어보세요!"
  },
  zh: {
    title: "AI 汉字老师",
    inputPlaceholder: "请输入你的问题…",
    send: "发送",
    explainLang: "说明语言",
    tts: "朗读(TTS)",
    thinking: "等一下🙂",
    welcome: "你好 🙂\n有中文问题，直接问我吧。"
  },
  en: {
    title: "AI Chinese Teacher",
    inputPlaceholder: "Ask your question…",
    send: "Send",
    explainLang: "Explanation language",
    tts: "Read aloud (TTS)",
    thinking: "One sec 🙂",
    welcome: "Hi 🙂\nAsk me anything about Chinese!"
  },
  ja: {
    title: "AI 中国語先生",
    inputPlaceholder: "質問を入力してください…",
    send: "送信",
    explainLang: "説明言語",
    tts: "読み上げ(TTS)",
    thinking: "ちょっと待ってね 🙂",
    welcome: "こんにちは 🙂\n中国語、気軽に聞いてください。"
  }
};

// =========================
// DOM (null-safe)
// =========================
const panel = document.getElementById("ai-panel");
const chat  = document.getElementById("chat");
const input = document.getElementById("input");
const explainLang = document.getElementById("explainLang");
const ttsToggle = document.getElementById("ttsToggle");
const speakMode = document.getElementById("speakMode");

const uiTitle = document.getElementById("uiTitle");
const uiTtsLabel = document.getElementById("uiTtsLabel");
const uiExplainLabel = document.getElementById("uiExplainLabel");
const uiSendBtn = document.getElementById("uiSendBtn");

const botBtn = document.getElementById("botBtn");
const closeBtn = document.getElementById("closeBtn");

// =========================
// Panel open/close
// =========================
function openAI() {
  if (!panel) return;
  panel.classList.remove("hidden");
}
function closeAI() {
  if (!panel) return;
  panel.classList.add("hidden");
}
function toggleAI() {
  if (!panel) return;
  panel.classList.toggle("hidden");
}
botBtn?.addEventListener("click", toggleAI);
closeBtn?.addEventListener("click", closeAI);

// ESC 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAI();
});

// 바깥 클릭 시 닫기(옵션)
document.addEventListener("pointerdown", (e) => {
  if (!panel || panel.classList.contains("hidden")) return;
  const t = e.target;
  if (!t) return;
  const clickedInside = panel.contains(t) || botBtn?.contains(t);
  if (!clickedInside) closeAI();
});

// =========================
// Display cleaning
// =========================
function cleanForDisplay(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/-{3,}/g, "")
    .trim();
}

function createMsgBubble(initialText, who) {
  if (!chat) return { wrap: null, bubbleDiv: null };

  const wrap = document.createElement("div");
  wrap.className = who === "user" ? "text-right" : "text-left";

  const bubbleClass = who === "user"
    ? "bg-orange-500 text-white"
    : "bg-gray-200 text-gray-900";

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

// =========================
// UI text switching
// =========================
function applyUIText(lang) {
  const t = UI_TEXT[lang] || UI_TEXT.ko;

  uiTitle && (uiTitle.innerText = t.title);
  input && (input.placeholder = t.inputPlaceholder);
  uiSendBtn && (uiSendBtn.innerText = t.send);
  uiTtsLabel && (uiTtsLabel.innerText = t.tts);
  uiExplainLabel && (uiExplainLabel.innerText = t.explainLang);

  if (chat) {
    chat.innerHTML = "";
    createMsgBubble(t.welcome, "ai");
  }
}
if (explainLang) applyUIText(explainLang.value);

explainLang?.addEventListener("change", () => {
  stopTyping();
  try { window.speechSynthesis?.cancel(); } catch {}
  applyUIText(explainLang.value);
});

// =========================
// TTS (keep your logic but expose speakSmart)
// =========================
let voices = [];
function loadVoices() {
  try {
    voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
  } catch {
    voices = [];
  }
}
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function pickVoiceByLang(targetLang) {
  if (!voices.length) return null;
  const prefix = { zh:["zh","cmn"], en:["en"], ko:["ko"], ja:["ja"] }[targetLang] || [targetLang];
  const v = voices.find(v => prefix.some(p => (v.lang||"").toLowerCase().startsWith(p)));
  return v || voices[0] || null;
}

function cleanForSpeak(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/-{3,}/g, " ")
    .replace(/[•●◦▶▷■□◆◇※★☆]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPinyinForTTS(text) {
  let s = String(text || "");
  s = s.replace(/^\s*(拼音|Pinyin)\s*[:：].*$/gmi, "");
  const pinyinLine = /^[\sA-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ·'’\-0-9]+$/;
  s = s
    .split("\n")
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(t);
      if (hasCJK) return true;
      return !pinyinLine.test(t);
    })
    .join("\n");
  return s;
}

function splitSentences(text) {
  const s = String(text).trim();
  if (!s) return [];
  const re = /[^。！？!?]+[。！？!?]?/g;
  return s.match(re)?.map(x => x.trim()).filter(Boolean) || [s];
}

function getSpeakParams() {
  const mode = speakMode?.value;
  if (mode === "exam") return { rate: 1.05, pitch: 1.0, pauseShort: 120, pauseLong: 220 };
  return { rate: 0.98, pitch: 1.07, pauseShort: 180, pauseLong: 320 };
}

function splitByChineseRuns(text) {
  const s = cleanForSpeak(text);
  if (!s) return [];
  const parts = [];
  const re = /([\u4e00-\u9fff]+)|([^\u4e00-\u9fff]+)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1]) parts.push({ type: "zh", text: m[1] });
    else if (m[2]) parts.push({ type: "other", text: m[2] });
  }
  return parts;
}

function speakQueueByLang(text, langKey, params, jobId) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    const sentences = splitSentences(text);
    if (!sentences.length) return resolve();

    let idx = 0;
    const speakNext = () => {
      if (jobId !== speakingJobId) return resolve();
      if (idx >= sentences.length) return resolve();

      const s = sentences[idx++];
      const u = new SpeechSynthesisUtterance(s);

      const voice = pickVoiceByLang(langKey);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || (langKey === "zh" ? "zh-CN" : langKey);
      } else {
        u.lang = (langKey === "zh" ? "zh-CN" : langKey);
      }
      u.rate = params.rate;
      u.pitch = params.pitch;

      const endsWithStrong = /[。！？!?]$/.test(s);
      const pause = endsWithStrong ? params.pauseLong : params.pauseShort;

      u.onend = () => setTimeout(speakNext, pause);
      u.onerror = () => resolve();
      try { window.speechSynthesis.speak(u); } catch { resolve(); }
    };
    speakNext();
  });
}

let speakingJobId = 0;

async function speakSmart(fullText, uiLang) {
  if (!ttsToggle?.checked) return;
  if (!window.speechSynthesis) return;

  const jobId = ++speakingJobId;
  const params = getSpeakParams();

  fullText = stripPinyinForTTS(fullText);
  const text = cleanForSpeak(fullText);
  if (!text) return;

  try { window.speechSynthesis.cancel(); } catch {}

  if (uiLang === "ja" && /[\u3040-\u30ff]/.test(text)) {
    await speakQueueByLang(text, "ja", params, jobId);
    return;
  }

  const chunks = splitByChineseRuns(text);
  for (const c of chunks) {
    if (jobId !== speakingJobId) return;
    if (c.type === "zh") await speakQueueByLang(c.text, "zh", params, jobId);
    else await speakQueueByLang(c.text, uiLang, params, jobId);
  }
}

// expose for other files
window.speakSmart = speakSmart;

// =========================
// Typewriter
// =========================
let typingTimer = null;
function stopTyping() {
  if (typingTimer) {
    clearInterval(typingTimer);
    typingTimer = null;
  }
}

function typewriterRender(bubbleDiv, fullText, speed = 14) {
  stopTyping();
  const cleaned = cleanForDisplay(fullText);
  bubbleDiv.textContent = "";
  let i = 0;

  typingTimer = setInterval(() => {
    i += 1;
    bubbleDiv.textContent = cleaned.slice(0, i);
    chat && (chat.scrollTop = chat.scrollHeight);

    if (i >= cleaned.length) stopTyping();
  }, speed);
}

// =========================
// Send (AI) + AbortController
// =========================
let currentAIController = null;

async function send(msgFromOutside) {
  const msg = (msgFromOutside ?? input?.value ?? "").trim();
  if (!msg) return;

  stopTyping();
  try { window.speechSynthesis?.cancel(); } catch {}

  createMsgBubble(msg, "user");
  if (input) input.value = "";

  const lang = explainLang?.value || "ko";
  const t = UI_TEXT[lang] || UI_TEXT.ko;

  const { bubbleDiv } = createMsgBubble(t.thinking, "ai");
  if (!bubbleDiv) return;

  try { currentAIController?.abort(); } catch {}
  currentAIController = new AbortController();

  try {
    const res = await fetch(window.APP_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: currentAIController.signal,
      const mode = window.AI_CONTEXT?.mode || "teach";
      const context = window.AI_CONTEXT?.context || null;

   body: JSON.stringify({ prompt: msg, explainLang: lang, mode, context })
   ;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || ("HTTP " + res.status));

    const answer = data.text || "(응답 없음)";
    typewriterRender(bubbleDiv, answer, 14);
    await speakSmart(answer, lang);

  } catch (e) {
    if (e?.name === "AbortError") {
      bubbleDiv.textContent = "";
      return;
    }
    bubbleDiv.textContent = "오류: " + (e?.message || "잠시 후 다시 시도해 주세요.");
  }
}

uiSendBtn?.addEventListener("click", () => send());
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

// expose to window
window.AIUI = { send, openAI, closeAI, toggleAI };
