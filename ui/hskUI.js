/* ui/hskUI.js */

// HSK DOM
const hskLevel  = document.getElementById("hskLevel");
const hskSearch = document.getElementById("hskSearch");
const hskGrid   = document.getElementById("hskGrid");
const hskError  = document.getElementById("hskError");
const hskStatus = document.getElementById("hskStatus");

// cache
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

  // ✅ new path: /data/vocab/hsk1_vocab.json (and hsk2_vocab.json later)
  const url = window.APP_CONFIG.HSK_VOCAB_URL(lv);
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

// ---------- Learn Panel (배우기) ----------
function ensureLearnPanel() {
  let el = document.getElementById("learn-panel");
  if (el) return el;

  el = document.createElement("div");
  el.id = "learn-panel";
  el.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
  el.innerHTML = `
    <div class="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b">
        <div class="font-semibold">배우기</div>
        <button id="learnClose" class="px-3 py-1 rounded-lg bg-slate-100">닫기</button>
      </div>
      <div id="learnBody" class="p-4 space-y-3"></div>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector("#learnClose")?.addEventListener("click", () => {
    el.classList.add("hidden");
  });
  el.addEventListener("click", (e) => {
    if (e.target === el) el.classList.add("hidden");
  });

  return el;
}

function openLearn(it) {
  const panel = ensureLearnPanel();
  const body = panel.querySelector("#learnBody");
  if (!body) return;

  const hanzi = it.hanzi || it.word || it.chinese || it.cn || "";
  const pinyin = it.pinyin || it.py || "";
  const meaning = it.meaning_ko || it.ko || it.meaning || it.translation || "";
  const ex = Array.isArray(it.examples) ? it.examples : [];

  body.innerHTML = `
    <div class="p-3 rounded-xl bg-slate-50">
      <div class="text-3xl font-bold">${escapeHtml(hanzi || "(no hanzi)")}</div>
      <div class="text-gray-600 mt-1">${escapeHtml(pinyin)}</div>
      <div class="mt-2">${escapeHtml(meaning)}</div>
      <div class="mt-3 flex gap-2">
        <button class="btnReadZH px-3 py-2 rounded-xl bg-orange-500 text-white text-sm">🔊 중국어로 읽기</button>
        <button class="btnAskAI px-3 py-2 rounded-xl bg-slate-100 text-sm">🤖 AI에게 질문</button>
      </div>
    </div>

    <div class="space-y-2">
      <div class="font-semibold text-sm text-gray-700">예문 (클릭하면 읽기)</div>
      ${ex.length ? ex.slice(0,3).map(e => `
        <div class="exLine px-3 py-2 rounded-xl bg-white border cursor-pointer hover:bg-slate-50"
             data-ex="${escapeHtml(formatExample(e))}">
          ${escapeHtml(formatExample(e))}
        </div>
      `).join("") : `<div class="text-sm text-gray-500">(예문 없음)</div>`}
    </div>
  `;

  body.querySelector(".btnReadZH")?.addEventListener("click", () => {
    window.speakSmart?.(hanzi, "zh");
  });

  body.querySelector(".btnAskAI")?.addEventListener("click", async () => {
    window.AIUI?.openAI?.();
    const prompt =
`HSK ${currentLevel} 단어를 가르쳐줘: ${hanzi}
(형식: 1)中文 2)拼音 3)설명 4)예문1~2)`;
    await window.AIUI?.send?.(prompt);
  });

  body.querySelectorAll(".exLine").forEach((el) => {
    el.addEventListener("click", async () => {
      const v = el.getAttribute("data-ex") || "";
      const uiLang = document.getElementById("explainLang")?.value || "ko";
      await window.speakSmart?.(v, uiLang);
    });
  });

  panel.classList.remove("hidden");
}

// ---------- Render ----------
function renderHSK(items, keyword = "") {
  if (!hskGrid || !hskStatus) return;

  const q = String(keyword || "").trim().toLowerCase();
  const filtered = !q ? items : items.filter(it => JSON.stringify(it).toLowerCase().includes(q));

  hskGrid.innerHTML = "";
  hskStatus.textContent = `HSK ${currentLevel} · ${filtered.length} items`;

  filtered.forEach((it) => {
    const hanzi = it.hanzi || it.word || it.chinese || it.cn || "";
    const pinyin = it.pinyin || it.py || "";
    const meaning = it.meaning_ko || it.ko || it.meaning || it.translation || "";
    const ex = Array.isArray(it.examples) ? it.examples : [];

    const card = document.createElement("div");
    card.className = "bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

    const wordJelly =
      `<div class="jWord my-1 px-3 py-2 rounded-xl bg-white/70 border border-white shadow-sm cursor-pointer hover:shadow hover:bg-white transition">
         <div class="text-2xl font-semibold">${escapeHtml(hanzi || "(no hanzi)")}</div>
         <div class="text-sm text-gray-600 mt-1">${escapeHtml(pinyin)}</div>
         <div class="text-sm mt-2">${escapeHtml(meaning)}</div>
       </div>`;

    card.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1">${wordJelly}</div>
        <button class="btnLearn px-3 py-2 rounded-xl bg-orange-500 text-white text-sm">배우기</button>
      </div>

      ${ex.length ? `<div class="mt-3 text-xs text-gray-600 space-y-2">
        ${ex.slice(0, 3).map((e) => `
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

    // click-to-read
    card.querySelector(".jWord")?.addEventListener("click", async () => {
      await window.speakSmart?.(hanzi, "zh");
    });

    card.querySelectorAll(".jEx").forEach((el) => {
      el.addEventListener("click", async () => {
        const v = el.getAttribute("data-ex") || "";
        const uiLang = document.getElementById("explainLang")?.value || "ko";
        await window.speakSmart?.(v, uiLang);
      });
    });

    // ✅ Ask AI only
    card.querySelector(".btnAsk")?.addEventListener("click", async () => {
      window.AIUI?.openAI?.();
      const prompt =
`HSK ${currentLevel} 단어를 가르쳐줘: ${hanzi}
(형식: 1)中文 2)拼音 3)설명 4)예문1~2)`;
      await window.AIUI?.send?.(prompt);
    });

    // ✅ Learn goes to learning panel (not AI)
    card.querySelector(".btnLearn")?.addEventListener("click", () => {
      openLearn(it);
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

// initial
refreshHSK();
