import { modalTpl, createModalSystem } from "./modalBase.js";
// /ui/components/dialoguePanel.js
// ✅ Dialogue Panel (stable, extensible, ESM-compatible)
// - mount once
// - window.DIALOGUE_PANEL.open({ title, subtitle, dialogue, lang })
// - dialogue can be: array of strings OR array of { zh/cn, ko/kr, pinyin, speaker, audio }
// - has per-line speak button + speak all

let mounted = false;

export function mountDialoguePanel(opts = {}) {
  if (mounted) return window.DIALOGUE_PANEL;
  mounted = true;

  const { container = document.body } = opts;

  const existed = document.getElementById("dialogue-panel-root");
  if (existed) existed.remove();

  const wrap = document.createElement("div");
  wrap.id = "dialogue-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  const overlay = wrap.querySelector("#dialogue-panel");
  const backBtn = wrap.querySelector("#dialogueBack");
  const closeBtn = wrap.querySelector("#dialogueCloseX");
  const body = wrap.querySelector("#dialogueBody");

  const open = () => overlay?.classList.remove("hidden");
  const close = () => overlay?.classList.add("hidden");

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
    document.querySelector("#hskGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  if (!document.body.dataset.dialogueEscBound) {
    document.body.dataset.dialogueEscBound = "1";
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // events
  window.addEventListener("dialogue:open", (e) => {
    const data = e?.detail || {};
    render(body, data);
    open();
  });
  window.addEventListener("dialogue:close", close);

  window.DIALOGUE_PANEL = {
    open: (data) => {
      render(body, data);
      open();
    },
    close,
    set: (data) => render(body, data),
    isMounted: true,
  };

  return window.DIALOGUE_PANEL;
}

/* ===============================
   Template
================================== */
function tpl() {
  return `
    <div id="dialogue-panel"
      class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      aria-label="Dialogue Panel"
    >
      <div class="w-full max-w-[720px] rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div class="sticky top-0 z-10 bg-white border-b">
          <div class="flex items-center justify-between px-4 py-3">
            <button id="dialogueBack" type="button"
              class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
              ← 뒤로
            </button>

            <div class="font-extrabold" id="dialogueTitle">회화 학습</div>

            <button id="dialogueCloseX" type="button"
              class="w-10 h-10 rounded-xl bg-slate-100 text-lg leading-none font-bold">
              ×
            </button>
          </div>
        </div>

        <div id="dialogueBody" class="p-4 space-y-4 max-h-[78vh] overflow-auto"></div>
      </div>
    </div>
  `;
}

/* ===============================
   Helpers
================================== */
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pickText(v, lang = "ko") {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) return v.map((x) => pickText(x, lang)).filter(Boolean).join(" / ");

  if (typeof v === "object") {
    const L = String(lang || "").toLowerCase();
    const direct =
      pickText(v?.[L], lang) ||
      pickText(v?.ko, lang) ||
      pickText(v?.kr, lang) ||
      pickText(v?.zh, lang) ||
      pickText(v?.cn, lang) ||
      pickText(v?.en, lang);
    if (direct) return direct;

    for (const k of Object.keys(v)) {
      const t = pickText(v[k], lang);
      if (t) return t;
    }
  }
  return "";
}

function speakText(text, lang = "zh-CN") {
  const t = String(text || "").trim();
  if (!t) return;

  // 1) if you already have AIUI.speak
  if (window.AIUI?.speak) {
    try {
      window.AIUI.speak(t, lang);
      return;
    } catch {}
  }

  // 2) fallback: Web Speech API
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

function normalizeDialogueItem(item) {
  // allow string
  if (typeof item === "string") {
    return { zh: item, ko: "", pinyin: "", speaker: "" };
  }
  if (!item || typeof item !== "object") return { zh: "", ko: "", pinyin: "", speaker: "" };

  return {
    speaker: item.speaker || item.role || item.who || "",
    zh: item.zh ?? item.cn ?? item.textZh ?? item.textCN ?? item.text ?? "",
    ko: item.ko ?? item.kr ?? item.textKo ?? item.textKR ?? item.trans ?? "",
    pinyin: item.pinyin ?? item.py ?? "",
  };
}

/* ===============================
   Render
================================== */
function render(root, raw = {}) {
  if (!root) return;

  const lang = window.APP_LANG || window.site_lang || "ko";
  const title = pickText(raw.title, lang) || "회화 학습";
  const subtitle = pickText(raw.subtitle, lang);

  const list = Array.isArray(raw.dialogue) ? raw.dialogue : [];
  const dia = list.map(normalizeDialogueItem).filter((x) => x.zh || x.ko);

  // update title
  const titleEl = document.getElementById("dialogueTitle");
  if (titleEl) titleEl.textContent = title;

  root.innerHTML = `
    <div class="rounded-2xl border p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-extrabold">${esc(title)}</div>
          ${subtitle ? `<div class="text-sm text-gray-500 mt-1">${esc(subtitle)}</div>` : ""}
        </div>
        <div class="flex gap-2">
          <button id="btnDiaSpeakAll" type="button"
            class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
            🔊 전체 듣기
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      ${
        dia.length
          ? dia.map((d, idx) => {
              const zh = pickText(d.zh, "zh");
              const ko = pickText(d.ko, "ko");
              const py = pickText(d.pinyin, lang);
              const sp = pickText(d.speaker, lang);
              return `
                <div class="rounded-2xl border p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      ${sp ? `<div class="text-xs text-gray-500 mb-1">${esc(sp)}</div>` : ""}
                      <div class="text-lg font-bold">${esc(zh)}</div>
                      ${py ? `<div class="text-blue-600 mt-1">${esc(py)}</div>` : ""}
                      ${ko ? `<div class="text-gray-600 mt-2">${esc(ko)}</div>` : ""}
                    </div>
                    <div class="flex flex-col gap-2">
                      <button type="button" data-speak-idx="${idx}"
                        class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
                        🔊
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join("")
          : `<div class="rounded-2xl border p-6 text-sm text-gray-500">회화 데이터가 없어요.</div>`
      }
    </div>

    <div class="rounded-2xl border p-4">
      <div class="font-extrabold mb-2">확장</div>
      <div class="text-xs text-gray-400">
        (여기에 나중에 역할극/녹음/빈칸채우기/따라말하기 등을 붙일 수 있어요)
      </div>
    </div>
  `;

  // per line speak
  root.querySelectorAll("[data-speak-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-speak-idx"));
      const zh = pickText(dia[idx]?.zh, "zh");
      speakText(zh, "zh-CN");
    });
  });

  // speak all
  root.querySelector("#btnDiaSpeakAll")?.addEventListener("click", async () => {
    // simple sequential speaking (best effort)
    for (const d of dia) {
      const zh = pickText(d.zh, "zh");
      if (!zh) continue;
      speakText(zh, "zh-CN");
      // naive delay, avoids overlapping a bit
      await new Promise((r) => setTimeout(r, Math.min(1400 + zh.length * 120, 4000)));
    }
  });

  window.dispatchEvent(new CustomEvent("dialogue:rendered", { detail: raw }));
}
