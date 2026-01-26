/* =========================================
   hskUI.js (Full) ✅
   - HSK 카드 렌더 + 검색 + 레벨 전환
   - "배우기" → 학습 패널(learn panel)로 들어감 (AI 패널 아님)
   - "AI에게 질문" → AI 패널 열고 mode/context 함께 전송
   - 학습 패널 안 "AI에게 질문"도 mode/context 함께 전송
   - 데이터 경로: window.DATA_PATHS.getVocabUrl(level) 사용
     (dataPaths.js 에서 제공)
========================================= */

(() => {
  /* =========================
     0) DOM (null-safe)
  ========================= */
  const hskLevel  = document.getElementById("hskLevel");
  const hskSearch = document.getElementById("hskSearch");
  const hskGrid   = document.getElementById("hskGrid");
  const hskError  = document.getElementById("hskError");
  const hskStatus = document.getElementById("hskStatus");

  // HSK 섹션 없는 페이지면 종료 (흰 화면 방지)
  if (!hskLevel || !hskGrid || !hskStatus) return;

  /* =========================
     1) Utils
  ========================= */
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showError(msg) {
    if (!hskError) return;
    hskError.classList.remove("hidden");
    hskError.textContent = msg;
  }

  function clearError() {
    if (!hskError) return;
    hskError.classList.add("hidden");
    hskError.textContent = "";
  }

  // 예문: 문자열/객체 모두 허용
  function formatExample(e) {
    if (!e) return "";
    if (typeof e === "string") return e;

    const zh = e.zh || e.cn || e.chinese || e.sentence || "";
    const ko = e.ko || e.meaning || e.translation || e.explain || "";
    const py = e.pinyin || e.py || "";

    // 표시는 "중문 / 해석" 위주로 (py는 있어도 OK)
    if (ko && py) return `${zh} | ${py} | ${ko}`;
    if (ko) return `${zh} / ${ko}`;
    return zh;
  }

  function normalizeItems(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.items)) return json.items;
    if (Array.isArray(json?.data)) return json.data;
    return [];
  }

  function toCardFields(it) {
    const hanzi   = it.hanzi || it.word || it.chinese || it.cn || "";
    const pinyin  = it.pinyin || it.py || "";
    const meaning = it.meaning_ko || it.ko || it.meaning || it.translation || "";
    const ex      = Array.isArray(it.examples) ? it.examples : [];
    return { hanzi, pinyin, meaning, ex };
  }

  /* =========================
     2) Learn Panel (create if missing)
  ========================= */
  function ensureLearnPanel() {
    let panel = document.getElementById("learn-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "learn-panel";
    panel.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";

    panel.innerHTML = `
      <div class="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <div class="font-semibold">배우기</div>
          <button id="learnClose" class="px-3 py-1 rounded-lg bg-slate-100">닫기</button>
        </div>
        <div id="learnBody" class="p-4 space-y-3"></div>
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#learnClose")?.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    // 바깥 클릭 닫기
    panel.addEventListener("pointerdown", (e) => {
      if (e.target === panel) panel.classList.add("hidden");
    });

    // ESC 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") panel.classList.add("hidden");
    });

    return panel;
  }

  function openLearnPanel(html) {
    const panel = ensureLearnPanel();
    const body = panel.querySelector("#learnBody");
    if (body) body.innerHTML = html;
    panel.classList.remove("hidden");
    return { panel, body };
  }

  /* =========================
     3) Data loading
  ========================= */
  const CACHE = {}; // level -> items[]
  let currentLevel = String(hskLevel.value || "1");

  async function loadLevel(level) {
    const lv = String(level || "1");
    currentLevel = lv;

    if (CACHE[lv]) return CACHE[lv];

    // ✅ dataPaths.js 에서 URL 제공 (없으면 기본 경로로 fallback)
    const url =
      window.DATA_PATHS?.getVocabUrl
        ? window.DATA_PATHS.getVocabUrl(lv)
        : `./data/vocab/hsk${lv}_vocab.json`;

    hskStatus.textContent = `Loading ${url} ...`;

    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);

    const json = await resp.json();
    const items = normalizeItems(json);

    if (!items.length) {
      throw new Error(`데이터는 열렸지만 내용이 비어 있어요: ${url}`);
    }

    CACHE[lv] = items;
    return items;
  }

  /* =========================
     4) Render cards
  ========================= */
  function render(items, keyword = "") {
    const q = String(keyword || "").trim().toLowerCase();

    const filtered = !q
      ? items
      : items.filter((it) => JSON.stringify(it).toLowerCase().includes(q));

    hskGrid.innerHTML = "";
    hskStatus.textContent = `HSK ${currentLevel} · ${filtered.length} items`;

    filtered.forEach((it) => {
      const { hanzi, pinyin, meaning, ex } = toCardFields(it);

      const card = document.createElement("div");
      card.className = "bg-white rounded-2xl shadow p-4 hover:shadow-md transition";

      // 단어 젤리(클릭하면 발음)
      const wordJelly = `
        <div class="jWord my-1 px-3 py-2 rounded-xl bg-white/70 border border-white shadow-sm cursor-pointer hover:shadow hover:bg-white transition">
          <div class="text-2xl font-semibold">${escapeHtml(hanzi || "(no hanzi)")}</div>
          <div class="text-sm text-gray-600 mt-1">${escapeHtml(pinyin)}</div>
          <div class="text-sm mt-2">${escapeHtml(meaning)}</div>
        </div>
      `;

      const exHtml = ex.length
        ? `
          <div class="mt-3 text-xs text-gray-600 space-y-2">
            ${ex.slice(0, 3).map((e) => {
              const line = formatExample(e);
              return `
                <div class="exLine my-1 px-3 py-2 rounded-xl bg-white/70 border border-white shadow-sm cursor-pointer hover:shadow hover:bg-white transition"
                     data-ex="${escapeHtml(line)}">
                  • ${escapeHtml(line)}
                </div>
              `;
            }).join("")}
          </div>
        `
        : `<div class="mt-3 text-xs text-gray-400">(예문 없음)</div>`;

      card.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="flex-1">${wordJelly}</div>

          <!-- ✅ 배우기: 학습 패널로 -->
          <button class="btnLearn px-3 py-2 rounded-xl bg-orange-500 text-white text-sm">
            배우기
          </button>
        </div>

        ${exHtml}

        <div class="mt-3 flex gap-2">
          <!-- ✅ AI에게 질문: AI 패널로 + mode/context -->
          <button class="btnAsk px-3 py-2 rounded-xl bg-slate-100 text-sm">🤖 AI에게 질문</button>
        </div>
      `;

      // 단어 클릭 → 중국어(보통화) 발음
      card.querySelector(".jWord")?.addEventListener("click", async () => {
        await window.speakSmart?.(hanzi, "zh");
      });

      // 예문 클릭 → UI 언어(설명언어) 기반 스마트 읽기
      card.querySelectorAll(".exLine").forEach((el) => {
        el.addEventListener("click", async () => {
          const v = el.getAttribute("data-ex") || "";
          const uiLang = document.getElementById("explainLang")?.value || "ko";
          await window.speakSmart?.(v, uiLang);
        });
      });

      // ✅ 배우기 버튼: 학습 패널 오픈
      card.querySelector(".btnLearn")?.addEventListener("click", () => {
        openLearn(it);
      });

      // ✅ 카드의 "AI에게 질문" 버튼: AI 패널 + ask 모드 + context
      card.querySelector(".btnAsk")?.addEventListener("click", async () => {
        window.AIUI?.openAI?.();

        // ✅ context 세팅 (학생 질문 모드)
        window.AI_CONTEXT = {
          mode: "ask",
          context: {
            level: currentLevel,
            hanzi,
            pinyin,
            meaning,
            examples: ex.slice(0, 3).map(formatExample),
          },
        };

        const prompt =
`이 단어를 잘 모르겠어요: ${hanzi}
학생에게 이해하기 쉽게 설명해 주세요.`;

        await window.AIUI?.send?.(prompt);
      });

      hskGrid.appendChild(card);
    });
  }

  /* =========================
     5) Learn Panel content + events
  ========================= */
  function openLearn(it) {
    const { hanzi, pinyin, meaning, ex } = toCardFields(it);

    const html = `
      <div class="space-y-3">
        <div class="px-3 py-2 rounded-xl bg-orange-50 border border-orange-100">
          <div class="text-xl font-semibold">${escapeHtml(hanzi || "(no hanzi)")}</div>
          <div class="text-sm text-gray-600 mt-1">${escapeHtml(pinyin)}</div>
          <div class="text-sm mt-2">${escapeHtml(meaning)}</div>
        </div>

        <div class="mt-1 flex gap-2">
          <button class="btnReadZH px-3 py-2 rounded-xl bg-orange-500 text-white text-sm">🔊 읽기</button>
          <button class="btnAskAI px-3 py-2 rounded-xl bg-slate-100 text-sm">🤖 AI에게 질문</button>
        </div>

        <div class="space-y-2">
          <div class="font-semibold text-sm text-gray-700">예문 (클릭하면 읽기)</div>
          ${
            ex.length
              ? ex.slice(0, 3).map((e) => {
                  const line = formatExample(e);
                  return `
                    <div class="exLine px-3 py-2 rounded-xl bg-white border cursor-pointer hover:bg-slate-50"
                         data-ex="${escapeHtml(line)}">
                      ${escapeHtml(line)}
                    </div>
                  `;
                }).join("")
              : `<div class="text-sm text-gray-400">(예문 없음)</div>`
          }
        </div>
      </div>
    `;

    const { body } = openLearnPanel(html);

    // 읽기 버튼
    body?.querySelector(".btnReadZH")?.addEventListener("click", () => {
      window.speakSmart?.(hanzi, "zh");
    });

    // 예문 클릭 읽기
    body?.querySelectorAll(".exLine").forEach((el) => {
      el.addEventListener("click", async () => {
        const v = el.getAttribute("data-ex") || "";
        const uiLang = document.getElementById("explainLang")?.value || "ko";
        await window.speakSmart?.(v, uiLang);
      });
    });

    // ✅ 학습 패널의 AI에게 질문: AI 패널 + teach 모드 + context
    body?.querySelector(".btnAskAI")?.addEventListener("click", async () => {
      window.AIUI?.openAI?.();

      window.AI_CONTEXT = {
        mode: "teach",
        context: {
          level: currentLevel,
          hanzi,
          pinyin,
          meaning,
          examples: ex.slice(0, 3).map(formatExample),
        },
      };

      const prompt =
`HSK ${currentLevel} 단어/표현 수업:
${hanzi}
(형식: 1)中文 2)拼音 3)설명 4)예문1~2)`;

      await window.AIUI?.send?.(prompt);
    });
  }

  /* =========================
     6) Refresh + events
  ========================= */
  async function refresh() {
    clearError();
    try {
      const items = await loadLevel(hskLevel.value);
      render(items, hskSearch?.value || "");
    } catch (err) {
      showError("HSK 데이터 로딩 실패: " + (err?.message || String(err)));
      hskStatus.textContent = "Load failed";
      hskGrid.innerHTML = "";
    }
  }

  hskLevel.addEventListener("change", refresh);

  hskSearch?.addEventListener("input", () => {
    const items = CACHE[currentLevel] || [];
    render(items, hskSearch.value);
  });

  // First load
  refresh();

  // (선택) 디버깅용
  window.HSKUI = { refresh };
})();
