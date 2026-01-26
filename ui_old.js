/* =========================================
   AI + HSK UI (single file)  ✅ 강화판
   - 기존 구조/기능 "삭제하지 않고" 보강
   - (요청하신 것처럼) “작은 스피커(🔊) 아이콘 버튼”은 제거 가능 → HSK 카드의 🔊 읽기 버튼 제거하고,
     카드/예문 자체를 “젤리 클릭”으로 대체(클릭하면 읽기)
   - HSK DOM 없을 때도 에러 없이 동작(다른 페이지에서 흰 화면 방지)
   - AI 요청 AbortController로 중복요청/레이스 컨디션 방지
   - Enter 전송(Shift+Enter 줄바꿈)
   - 패널: ESC로 닫기, 바깥 클릭 시 닫기(옵션)
========================================= */

/* =========================
   0) API
========================= */
const API_URL = "https://hanjiapass.vercel.app/api/gemini"; // 너의 Vercel 도메인

// ✅ GitHub Pages/상대경로 안정화: 현재 문서 기준으로 data 폴더 URL 생성
const DATA_BASE = (() => {
  try {
    // ./data -> 절대 URL로 안전 변환
    const u = new URL("./data/", window.location.href);
    return u.href.replace(/\/$/, ""); // 끝 슬래시 제거
  } catch {
    return "./data";
  }
})();

/* =========================
   1) UI 문안
========================= */
const UI_TEXT = {
  ko: {
    title: "AI 한자 선생님",
    inputPlaceholder: "질문을 입력하세요…",
    send: "보내기",
    explainLang: "설명 언어",
    tts: "읽어주기(TTS)",
    thinking: "잠깐만요 🙂",
    welcome: "안녕하세요 🙂\n중국어 질문, 바로 물어보세요!",
    follow: "🎤 따라읽기",
    exPlay: "예문"
  },
  en: {
    title: "AI Chinese Teacher",
    inputPlaceholder: "Ask your question…",
    send: "Send",
    explainLang: "Explanation language",
    tts: "Read aloud (TTS)",
    thinking: "One sec 🙂",
    welcome: "Hi 🙂\nAsk me anything about Chinese!",
    follow: "🎤 Shadow",
    exPlay: "Example"
  },
  ja: {
    title: "AI 中国語先生",
    inputPlaceholder: "質問を入力してください…",
    send: "送信",
    explainLang: "説明言語",
    tts: "読み上げ(TTS)",
    thinking: "ちょっと待ってね 🙂",
    welcome: "こんにちは 🙂\n中国語、気軽に聞いてください。",
    follow: "🎤 ついて読む",
    exPlay: "例文"
  },
  zh: {
    title: "AI 汉字老师",
    inputPlaceholder: "请输入你的问题…",
    send: "发送",
    explainLang: "说明语言",
    tts: "朗读(TTS)",
    thinking: "等一下🙂",
    welcome: "你好 🙂\n有中文问题，直接问我吧。",
    follow: "🎤 跟读",
    exPlay: "例句"
  }
};

/* =========================
   2) DOM (null-safe)
========================= */
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

/* 主页面 HSK DOM */
const hskLevel = document.getElementById("hskLevel");
const hskSearch = document.getElementById("hskSearch");
const hskGrid = document.getElementById("hskGrid");
const hskError = document.getElementById("hskError");
const hskStatus = document.getElementById("hskStatus");

/* =========================
   3) 面板开关（修复“关不掉”+增强）
========================= */
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

// ✅ ESC 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAI();
});

// ✅ (옵션) 바깥 클릭 시 닫기: 패널/버튼 아닌 곳 클릭하면 닫힘
document.addEventListener("pointerdown", (e) => {
  if (!panel || panel.classList.contains("hidden")) return;
  const t = e.target;
  if (!t) return;
  const clickedInside = panel.contains(t) || botBtn?.contains(t);
  if (!clickedInside) closeAI();
});

/* =========================
   4) 显示清洗（只影响显示，不影响TTS）
========================= */
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

/* =========================
   5) UI 跟随语言切换
========================= */
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

/* =========================
   6) TTS：核心修正
   - 标点显示OK（TTS不念出标点，只停顿）
   - 不读拼音（stripPinyinForTTS）
   - 日语含假名：整段按日语读（不把汉字拆成中文）
   - 中文段落普通话读
========================= */
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

  const prefix = {
    zh: ["zh", "cmn"],
    en: ["en"],
    ko: ["ko"],
    ja: ["ja"]
  }[targetLang] || [targetLang];

  const v = voices.find(v => prefix.some(p => (v.lang || "").toLowerCase().startsWith(p)));
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

// ✅ 不读拼音（但显示保留）
function stripPinyinForTTS(text) {
  let s = String(text || "");

  // 去掉“拼音：xxx”整行
  s = s.replace(/^\s*(拼音|Pinyin)\s*[:：].*$/gmi, "");

  // 去掉“纯拼音行”（声调符号/ü/数字声调）
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

  // 例句行：只读中文 + 解释，不读拼音
  s = s.replace(/^(例句|Example|예문|例文)\s*\d+\s*[:：]\s*([^|]+)\|\s*([^|]+)\|\s*(.+)$/gmi,
    (m, tag, zh, py, exp) => `${zh.trim()}。 ${exp.trim()}`
  );

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

// 把字符串按“中文块/其他块”切分（用于多语混读）
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

      try {
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    };

    speakNext();
  });
}

let speakingJobId = 0;

// ✅ 클릭한 “한 줄”만 읽기 (젤리 클릭 TTS)
async function speakSmart(fullText, uiLang) {
  if (!ttsToggle?.checked) return;
  if (!window.speechSynthesis) return;

  const jobId = ++speakingJobId;
  const params = getSpeakParams();

  // ✅ 关键：先删除“拼音行/拼音部分”
  fullText = stripPinyinForTTS(fullText);

  const text = cleanForSpeak(fullText);
  if (!text) return;

  try { window.speechSynthesis.cancel(); } catch {}

  // ✅ 日语特例：含假名则整段按日语读（不把汉字拆成中文）
  if (uiLang === "ja" && /[\u3040-\u30ff]/.test(text)) {
    await speakQueueByLang(text, "ja", params, jobId);
    return;
  }

  // ✅ 其它语言：中文块用普通话，其它块用界面语言
  const chunks = splitByChineseRuns(text);
  for (const c of chunks) {
    if (jobId !== speakingJobId) return;

    if (c.type === "zh") {
      await speakQueueByLang(c.text, "zh", params, jobId); // 普通话
    } else {
      await speakQueueByLang(c.text, uiLang, params, jobId);
    }
  }
}

/* =========================
   7) “果冻块”点击朗读：把 AI 回复每一行拆成可点读块
========================= */
function attachJellyClickToBubble(wrapEl, answerText, uiLang) {
  const bubble = wrapEl?.querySelector?.(".bubble");
  if (!bubble) return;

  const raw = cleanForDisplay(answerText);
  const lines = raw.split("\n").map(s => s.trim()).filter(Boolean);

  bubble.innerHTML = "";
  lines.forEach((line) => {
    const jelly = document.createElement("div");
    jelly.className =
      "my-1 px-3 py-2 rounded-xl bg-white/70 border border-white shadow-sm cursor-pointer " +
      "hover:shadow hover:bg-white transition";

    jelly.textContent = line;

    jelly.addEventListener("click", async () => {
      await speakSmart(line, uiLang);
    });

    bubble.appendChild(jelly);
  });
}

/* =========================
   8) 打字机（完成后变成果冻可点读）
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
    chat && (chat.scrollTop = chat.scrollHeight);

    if (i >= cleaned.length) {
      stopTyping();
      if (typeof onDone === "function") onDone(cleaned);
    }
  }, speed);
}

/* =========================
   9) 发送（AI） + AbortController 강화
========================= */
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

  const { wrap, bubbleDiv } = createMsgBubble(t.thinking, "ai");
  if (!bubbleDiv) return;

  // ✅ 이전 요청 중단
  try { currentAIController?.abort(); } catch {}
  currentAIController = new AbortController();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: currentAIController.signal,
      body: JSON.stringify({ prompt: msg, explainLang: lang })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || ("HTTP " + res.status));

    const answer = data.text || "(응답 없음)";

    typewriterRender(bubbleDiv, answer, 14, async () => {
      // 先整段读（不读拼音）
      await speakSmart(answer, lang);

      // 变成果冻块：点哪段读哪段
      attachJellyClickToBubble(wrap, answer, lang);
    });

  } catch (e) {
    if (e?.name === "AbortError") {
      bubbleDiv.textContent = ""; // 중단은 조용히
      return;
    }
    bubbleDiv.textContent = "오류: " + (e?.message || "잠시 후 다시 시도해 주세요.");
  }
}

uiSendBtn?.addEventListener("click", () => send());

// ✅ Enter 전송 / Shift+Enter 줄바꿈
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

/* 暴露给 HTML Enter 调用 */
window.AIUI = { send, openAI, closeAI, toggleAI };

/* =========================
   10) ✅ 面板拖动（标题栏）
========================= */
(function enableDrag() {
  const handle = document.getElementById("dragHandle");
  if (!handle || !panel) return;

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

/* =========================
   11) HSK 主页面：加载 JSON 并渲染（白屏防止 + 젤리 클릭형）
   支持两种 JSON：
   A) 数组：[{hanzi,pinyin,meaning_ko,examples:[...]}]
   B) 对象：{items:[...]} 或 {data:[...]}
========================= */

let HSK_CACHE = {}; // level -> items[]
let currentLevel = "1";

function showHSKError(msg) {
  if (!hskError) return;
  hskError.classList.remove("hidden");
  hskError.textContent = msg;
}
function clearHSKError() {
  if (!hskError) return;
  hskError.classList.add("hidden");
  hskError.textContent = "";
}

function normalizeHSKJson(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

async function loadHSK(level) {
  const lv = String(level);
  currentLevel = lv;

  if (HSK_CACHE[lv]) return HSK_CACHE[lv];

  const url = `${DATA_BASE}/hsk${lv}.json`;
  if (hskStatus) hskStatus.textContent = `Loading ${url} ...`;

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);

  const json = await resp.json();
  const items = normalizeHSKJson(json);

  if (!items.length) {
    throw new Error(`데이터는 열렸지만 내용이 비어 있어요: ${url}\n(JSON 구조를 확인해 주세요)`);
  }

  HSK_CACHE[lv] = items;
  return items;
}

/* ✅ 요청 반영: “작은 스피커(🔊) 아이콘 버튼” 제거
   - 기존의 btnRead(🔊 읽기) 버튼 삭제
   - 대신: 단어(한자), 예문 줄을 “젤리 클릭”하면 읽기
*/
function renderHSK(items, keyword = "") {
  if (!hskGrid || !hskStatus) return; // ✅ HSK 섹션 없는 페이지 보호

  const q = String(keyword || "").trim().toLowerCase();

  const filtered = !q ? items : items.filter(it => {
    const blob = JSON.stringify(it).toLowerCase();
    return blob.includes(q);
  });

  hskGrid.innerHTML = "";
  hskStatus.textContent = `HSK ${currentLevel} · ${filtered.length} items`;

  filtered.forEach((it) => {
    const hanzi = it.hanzi || it.word || it.chinese || it.cn || "";
    const pinyin = it.pinyin || it.py || "";
    const meaning = it.meaning_ko || it.ko || it.meaning || it.translation || "";
    const ex = Array.isArray(it.examples) ? it.examples : [];

    const card = document.createElement("div");
    card.className = "bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

    // ✅ 단어 줄을 젤리로: 클릭하면 “중국어(보통화)”로 읽기
    const wordJelly =
      `<div class="jWord my-1 px-3 py-2 rounded-xl bg-white/70 border border-white shadow-sm cursor-pointer hover:shadow hover:bg-white transition">
         <div class="text-2xl font-semibold">${escapeHtml(hanzi || "(no hanzi)")}</div>
         <div class="text-sm text-gray-600 mt-1">${escapeHtml(pinyin)}</div>
         <div class="text-sm mt-2">${escapeHtml(meaning)}</div>
       </div>`;

    card.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1">
          ${wordJelly}
        </div>
        <button class="btnLearn px-3 py-2 rounded-xl bg-orange-500 text-white text-sm">
          배우기
        </button>
      </div>

      ${ex.length ? `<div class="mt-3 text-xs text-gray-600 space-y-2">
        ${ex.slice(0, 3).map((e, i) => `
          <div class="jEx my-1 px-3 py-2 rounded-xl bg-white/70 border border-white shadow-sm cursor-pointer hover:shadow hover:bg-white transition"
               data-ex="${escapeHtml(formatExample(e))}">
            • ${escapeHtml(formatExample(e))}
          </div>
        `).join("")}
      </div>` : ""}

      <div class="mt-3 flex gap-2">
        <button class="btnAsk px-3 py-2 rounded-xl bg-slate-100 text-sm">🤖 AI에게 질문</button>
      </div>
    `;

    // ✅ 단어 젤리 클릭 → 중국어(보통화) 읽기
    card.querySelector(".jWord")?.addEventListener("click", async () => {
      await speakSmart(hanzi, "zh");
    });

    // ✅ 예문 젤리 클릭 → 예문(중문은 zh로) 읽기
    card.querySelectorAll(".jEx").forEach((el) => {
      el.addEventListener("click", async () => {
        const v = el.getAttribute("data-ex") || "";
        // 예문에 한국어가 섞여있어도 중국어 덩어리는 zh, 나머지는 설명언어로 읽음
        const uiLang = explainLang?.value || "ko";
        await speakSmart(v, uiLang);
      });
    });

    // 问：打开面板并发问
    card.querySelector(".btnAsk")?.addEventListener("click", async () => {
      openAI();
      const prompt =
`HSK ${currentLevel} 단어를 가르쳐줘: ${hanzi}
(형식: 1)中文 2)拼音 3)설명 4)예문1~2)`;
      await send(prompt);
    });

    // “배우기”按钮：打开并直接让AI生成
    card.querySelector(".btnLearn")?.addEventListener("click", async () => {
      openAI();
      const prompt =
`HSK ${currentLevel} 단어/표현 수업:
${hanzi}
(형식: 1)中文 2)拼音 3)설명 4)예문1~2)`;
      await send(prompt);
    });

    hskGrid.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatExample(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  const zh = e.zh || e.cn || e.chinese || "";
  const ko = e.ko || e.meaning || e.translation || "";
  return ko ? `${zh} / ${ko}` : zh;
}

async function refreshHSK() {
  // ✅ HSK 섹션이 없는 페이지면 아무것도 안 함(흰화면 방지)
  if (!hskLevel || !hskGrid || !hskStatus) return;

  clearHSKError();
  try {
    const items = await loadHSK(hskLevel.value);
    renderHSK(items, hskSearch?.value || "");
  } catch (err) {
    showHSKError("HSK 데이터 로딩 실패: " + (err?.message || String(err)));
    hskStatus.textContent = "Load failed";
    hskGrid.innerHTML = "";
  }
}

hskLevel?.addEventListener("change", refreshHSK);
hskSearch?.addEventListener("input", () => {
  const items = HSK_CACHE[currentLevel] || [];
  renderHSK(items, hskSearch.value);
});

/* 首次加载 HSK1 */
refreshHSK();
