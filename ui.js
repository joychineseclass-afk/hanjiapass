/* =========================
   0) API
========================= */
const API_URL = "https://hanjiapass.vercel.app/api/gemini";

/* =========================
   0.5) ✅ 离线 HSK：前端也兜底（API 挂了也能教）
   - 这里先加载 /data/hsk1.json
========================= */
let OFFLINE_HSK1 = {};
async function loadOfflineHSK1() {
  try {
    const res = await fetch("./data/hsk1.json", { cache: "no-store" });
    if (!res.ok) return;
    OFFLINE_HSK1 = await res.json();
  } catch {
    // ignore
  }
}
loadOfflineHSK1();

/* 生成离线回答（保持你们的固定格式：例句1/例句2 一行一条） */
function buildOfflineAnswer(term, uiLang) {
  const entry = OFFLINE_HSK1?.[term];
  if (!entry) return "";

  const explain =
    uiLang === "ko" ? (entry.ko || entry.zh || "") :
    uiLang === "en" ? (entry.en || entry.zh || "") :
    uiLang === "ja" ? (entry.ja || entry.zh || "") :
    (entry.zh || "");

  const ex = (entry.ex || []).slice(0, 2).map((e, idx) => {
    const trans =
      uiLang === "ko" ? (e.ko || "") :
      uiLang === "en" ? (e.en || "") :
      uiLang === "ja" ? (e.ja || "") :
      (e.zh2 || e.zh || "");
    return `例句${idx + 1}：${e.zh} | ${e.py} | ${trans}`;
  });

  return [term, entry.py, explain, ...ex].join("\n");
}

/* 尝试从用户输入命中 HSK1 词条 */
function tryOfflineFallback(userMsg, uiLang) {
  const msg = String(userMsg || "");
  const keys = Object.keys(OFFLINE_HSK1 || {});
  const hit = keys.find(k => msg.includes(k));
  if (hit) return buildOfflineAnswer(hit, uiLang);

  // 没命中：给一个不会白屏的引导
  const intro =
    uiLang === "ko" ? "지금은 오프라인 기본 수업 모드예요. 가장 쉬운 인사말부터 시작해요." :
    uiLang === "en" ? "Offline basic lesson mode. Let’s start with greetings." :
    uiLang === "ja" ? "オフライン基礎レッスンです。挨拶から始めましょう。" :
    "离线基础课程模式：我们先从最常用的问候开始。";

  return [
    "你好",
    "nǐ hǎo",
    intro,
    `例句1：你好！ | nǐ hǎo! | ${uiLang === "ko" ? "안녕하세요!" : uiLang === "en" ? "Hello!" : uiLang === "ja" ? "こんにちは！" : "你好！"}`
  ].join("\n");
}

/* =========================
   1) UI 多语言文案
========================= */
const UI_TEXT = {
  ko: { title:"AI 한자 선생님", inputPlaceholder:"질문을 입력하세요…", send:"보내기",
    explainLang:"설명 언어", tts:"읽어주기(TTS)", voice:"음색",
    keyMode:"🔐 Key 보호 모드: Vercel API", thinking:"잠깐만요 🙂",
    welcome:"안녕하세요 🙂\n중국어 질문, 바로 물어보세요!", readScope:"읽기 범위", mode:"모드",
    follow:"🎤 따라읽기", exPlay:"🔊 예문"
  },
  en: { title:"AI Chinese Teacher", inputPlaceholder:"Ask your question…", send:"Send",
    explainLang:"Explanation language", tts:"Read aloud (TTS)", voice:"Voice",
    keyMode:"🔐 Key protection: Vercel API", thinking:"One sec 🙂",
    welcome:"Hi 🙂\nAsk me anything about Chinese!", readScope:"Read scope", mode:"Mode",
    follow:"🎤 Shadow", exPlay:"🔊 Example"
  },
  ja: { title:"AI 中国語先生", inputPlaceholder:"質問を入力してください…", send:"送信",
    explainLang:"説明言語", tts:"読み上げ(TTS)", voice:"音声",
    keyMode:"🔐 キー保護: Vercel API", thinking:"ちょっと待ってね 🙂",
    welcome:"こんにちは 🙂\n中国語、気軽に聞いてください。", readScope:"読み範囲", mode:"モード",
    follow:"🎤 ついて読む", exPlay:"🔊 例文"
  },
  zh: { title:"AI 汉字老师", inputPlaceholder:"请输入你的问题…", send:"发送",
    explainLang:"说明语言", tts:"朗读(TTS)", voice:"音色",
    keyMode:"🔐 密钥保护：Vercel API", thinking:"等一下🙂",
    welcome:"你好 🙂\n有中文问题，直接问我吧。", readScope:"朗读范围", mode:"模式",
    follow:"🎤 跟读", exPlay:"🔊 例句"
  }
};

/* =========================
   2) DOM
========================= */
const panel = document.getElementById("ai-panel");
const chat  = document.getElementById("chat");
const input = document.getElementById("input");

const explainLang = document.getElementById("explainLang");
const ttsToggle = document.getElementById("ttsToggle");
const voiceSelect = document.getElementById("voiceSelect");
const readScope = document.getElementById("readScope");
const speakMode = document.getElementById("speakMode");

const uiTitle = document.getElementById("uiTitle");
const uiTtsLabel = document.getElementById("uiTtsLabel");
const uiVoiceLabel = document.getElementById("uiVoiceLabel");
const uiExplainLabel = document.getElementById("uiExplainLabel");
const uiSendBtn = document.getElementById("uiSendBtn");
const uiKeyMode = document.getElementById("uiKeyMode");
const uiReadScopeLabel = document.getElementById("uiReadScopeLabel");
const uiModeLabel = document.getElementById("uiModeLabel");

const openAiBtn = document.getElementById("openAiBtn");
const closeAiBtn = document.getElementById("closeAiBtn");

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
   4) ✅ 打开/关闭（修复你说的“关不掉”）
========================= */
function toggleAI(force) {
  const isHidden = panel.classList.contains("hidden");
  const nextHidden = (typeof force === "boolean") ? !force : !isHidden;
  panel.classList.toggle("hidden", nextHidden);
}

// 绑定按钮事件（不再用 inline onclick）
openAiBtn.addEventListener("click", () => toggleAI(true));
closeAiBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // 防止拖动把手抢事件
  toggleAI(false);
});

/* =========================
   5) UI 基础
========================= */
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

/* =========================
   6) UI 跟随语言切换
========================= */
function applyUIText(lang) {
  const t = UI_TEXT[lang] || UI_TEXT.ko;

  uiTitle.innerText = t.title;
  input.placeholder = t.inputPlaceholder;
  uiSendBtn.innerText = t.send;

  uiTtsLabel.innerText = t.tts;
  uiVoiceLabel.innerText = t.voice;
  uiExplainLabel.innerText = t.explainLang;
  uiKeyMode.innerText = t.keyMode;
  uiReadScopeLabel.innerText = t.readScope;
  uiModeLabel.innerText = t.mode;

  chat.innerHTML = "";
  createMsgBubble(t.welcome, "ai");
}

/* =========================
   7) TTS：Smart（保留你们核心）
========================= */
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
  voiceSelect.innerHTML = "";

  if (!voices.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(No voices yet)";
    voiceSelect.appendChild(opt);
    return;
  }

  voices.forEach((v, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${v.name} - ${v.lang}`;
    voiceSelect.appendChild(opt);
  });

  voiceSelect.value = "0";
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function pickVoiceByLang(targetLang) {
  if (!voices.length) return null;

  const prefix = {
    zh: ["zh", "cmn"],
    en: ["en"],
    ko: ["ko"],
    ja: ["ja"]
  }[targetLang] || [targetLang];

  const v = voices.find(v => prefix.some(p => (v.lang || "").toLowerCase().startsWith(p)));
  if (v) return v;

  const idx = parseInt(voiceSelect.value, 10);
  if (!Number.isNaN(idx) && voices[idx]) return voices[idx];

  return voices[0] || null;
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

function keepLettersForLang(text, lang) {
  const t = String(text);
  if (lang === "en") return t.replace(/[^A-Za-z0-9\s'.,!?-]/g," ").replace(/\s+/g," ").trim();
  if (lang === "ko") return t.replace(/[^가-힣0-9\s.,!?-]/g," ").replace(/\s+/g," ").trim();
  if (lang === "ja") return t.replace(/[^ぁ-ゟ゠-ヿ一-龯0-9\s.,!?-]/g," ").replace(/\s+/g," ").trim();
  if (lang === "zh") return t.replace(/[^\u4e00-\u9fff0-9\s，。！？、]/g," ").replace(/\s+/g," ").trim();
  return t.replace(/\s+/g," ").trim();
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

function splitSentences(text) {
  const s = String(text).trim();
  if (!s) return [];
  const re = /[^。！？!?]+[。！？!?]?/g;
  return s.match(re)?.map(x => x.trim()).filter(Boolean) || [s];
}

function getSpeakParams() {
  const mode = speakMode.value;
  if (mode === "exam") return { rate: 1.05, pitch: 1.0, pauseShort: 120, pauseLong: 220 };
  return { rate: 0.98, pitch: 1.07, pauseShort: 180, pauseLong: 320 };
}

function filterByReadScope(fullText, uiLang, scope) {
  const text = cleanForSpeak(fullText);

  if (scope === "zhOnly") {
    const onlyZh = (text.match(/[\u4e00-\u9fff]+/g) || []).join(" ");
    return { mode: "zhOnly", zhText: onlyZh, otherText: "" };
  }
  if (scope === "zhPlus") return { mode:"zhPlus", zhText:text, otherText:text };
  return { mode:"all", zhText:text, otherText:text };
}

let speakingJobId = 0;

async function speakSmart(fullText, uiLang) {
  if (!ttsToggle.checked) return;
  if (!window.speechSynthesis) return;

  const jobId = ++speakingJobId;
  const scope = readScope.value;
  const params = getSpeakParams();
  const filtered = filterByReadScope(fullText, uiLang, scope);

  if (filtered.mode === "zhOnly") {
    const t = keepLettersForLang(filtered.zhText, "zh");
    if (!t) return;
    await speakQueueByLang(t, "zh", params, jobId);
    return;
  }

  const chunks = splitByChineseRuns(filtered.otherText);
  if (!chunks.length) return;

  window.speechSynthesis.cancel();

  for (const c of chunks) {
    if (jobId !== speakingJobId) return;

    if (c.type === "zh") {
      const t = keepLettersForLang(c.text, "zh");
      if (!t) continue;
      await speakQueueByLang(t, "zh", params, jobId);
    } else {
      const t = keepLettersForLang(c.text, uiLang);
      if (!t) continue;

      if (filtered.mode === "zhPlus") {
        const shortened = t.length > 260 ? (t.slice(0, 260) + " ...") : t;
        await speakQueueByLang(shortened, uiLang, params, jobId);
      } else {
        await speakQueueByLang(t, uiLang, params, jobId);
      }
    }
  }
}

function speakQueueByLang(text, langKey, params, jobId) {
  return new Promise((resolve) => {
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

      window.speechSynthesis.speak(u);
    };

    speakNext();
  });
}

/* =========================
   8) ✅ 例句按钮 + 跟读按钮（固定放在这一条 AI 回复下）
========================= */
function parseExampleLines(text) {
  const raw = String(text || "");
  const lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const examples = [];
  const re = /^(?:例句|예문|Example)\s*([0-9]+)\s*[:：]\s*(.+)$/i;

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const idx = m[1];
    const rest = m[2];

    const parts = rest.split("|").map(s => s.trim());
    const zh = parts[0] || "";
    const py = parts[1] || "";
    examples.push({ idx, zh, py });
  }
  return examples;
}

function attachSpeakControlsToAiMessage(wrapEl, answerText, uiLang) {
  const t = UI_TEXT[uiLang] || UI_TEXT.ko;
  const examples = parseExampleLines(answerText);

  const box = document.createElement("div");
  box.className = "mt-2 flex flex-wrap gap-2 justify-start";

  // 整段跟读
  const followBtn = document.createElement("button");
  followBtn.type = "button";
  followBtn.className = "px-2 py-1 rounded bg-white border text-xs hover:bg-slate-50";
  followBtn.textContent = t.follow;
  followBtn.addEventListener("click", async () => {
    await speakSmart(answerText, uiLang);
  });
  box.appendChild(followBtn);

  // 每条例句点读（喇叭跟在“例句按钮”上）
  examples.forEach(ex => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-2 py-1 rounded bg-white border text-xs hover:bg-slate-50";
    btn.textContent = `${t.exPlay} ${ex.idx}`;
    btn.addEventListener("click", async () => {
      const lineToRead = `${ex.zh}${ex.py ? (" " + ex.py) : ""}`;
      await speakSmart(lineToRead, uiLang);
    });
    box.appendChild(btn);
  });

  wrapEl.appendChild(box);
  chat.scrollTop = chat.scrollHeight;
}

/* =========================
   9) 打字机（保持你们核心）
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
   10) 发送（✅ API失败就走离线兜底）
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
      await speakSmart(answer, lang);
      attachSpeakControlsToAiMessage(wrap, answer, lang);
    });

  } catch (e) {
    // ✅ API挂了：离线教学继续
    const offlineAnswer = tryOfflineFallback(msg, lang);

    typewriterRender(bubbleDiv, offlineAnswer, 14, async () => {
      await speakSmart(offlineAnswer, lang);
      attachSpeakControlsToAiMessage(wrap, offlineAnswer, lang);
    });
  }
}

/* 发送按钮/回车绑定（不再写在 HTML 里） */
uiSendBtn.addEventListener("click", send);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

/* =========================
   11) 初始化 & 切换语言
========================= */
applyUIText(explainLang.value);

explainLang.addEventListener("change", () => {
  stopTyping();
  window.speechSynthesis && window.speechSynthesis.cancel();
  applyUIText(explainLang.value);
});

/* =========================
   12) ✅ 面板拖动（拖标题栏）
========================= */
(function enableDrag() {
  const handle = document.getElementById("dragHandle");
  let isDown = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;

  function getLeftTop() {
    const rect = panel.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  }

  handle.addEventListener("pointerdown", (e) => {
    // 如果点的是关闭按钮，不触发拖动
    if (e.target && e.target.id === "closeAiBtn") return;

    isDown = true;
    handle.setPointerCapture(e.pointerId);

    const { left, top } = getLeftTop();
    startLeft = left;
    startTop = top;
    startX = e.clientX;
    startY = e.clientY;

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
