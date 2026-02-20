// /ui/components/dialoguePanel.js
// ✅ Dialogue Panel (Stable, ESM, modalBase compatible)
// - mount once
// - window.DIALOGUE_PANEL.open({ title, subtitle, dialogue, lang })
// - listens event: window.dispatchEvent(new CustomEvent("dialogue:open",{detail:{...}}))

import { modalTpl, createModalSystem } from "./modalBase.js";

let mounted = false;

export function mountDialoguePanel(opts = {}) {
  if (mounted) return window.DIALOGUE_PANEL;
  mounted = true;

  const { container = document.body } = opts;

  // remove old root (hot reload safe)
  const existed = document.getElementById("dialogue-panel-root");
  if (existed) existed.remove();

  // mount root + template
  const wrap = document.createElement("div");
  wrap.id = "dialogue-panel-root";
  wrap.innerHTML = tpl();
  container.appendChild(wrap);

  // create modal system (handles open/close/backdrop/esc)
  const modal = createModalSystem(wrap, {
    id: "dialogue-panel",
    titleId: "dialogueTitle",
    backId: "dialogueBack",
    closeId: "dialogueCloseX",
    bodyId: "dialogueBody",
    onBack: () => {
      modal.close();
      // optional: scroll back to lesson area
      document.querySelector("#hskGrid")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    },
    onClose: () => {
      // hook if you want
    },
    lockScroll: true,
    escClose: true,
  });

  // Ensure initial hidden state uses modalBase class
  // (modalTpl already uses joy-modal-hidden, but keep safe)
  modal.overlay?.classList.add("joy-modal-hidden");

  // event bindings
  const onOpen = (e) => {
    const data = e?.detail || {};
    render(modal.body, data);
    modal.setTitle(pickText(data?.title, getLang(data?.lang)) || "회화 학습");
    modal.open();
  };
  const onClose = () => modal.close();

  window.addEventListener("dialogue:open", onOpen);
  window.addEventListener("dialogue:close", onClose);

  window.DIALOGUE_PANEL = {
    open: (data) => {
      render(modal.body, data || {});
      modal.setTitle(pickText(data?.title, getLang(data?.lang)) || "회화 학습");
      modal.open();
    },
    close: () => modal.close(),
    set: (data) => render(modal.body, data || {}),
    isMounted: true,
    __unbind: () => {
      window.removeEventListener("dialogue:open", onOpen);
      window.removeEventListener("dialogue:close", onClose);
    },
  };

  return window.DIALOGUE_PANEL;
}

/* ===============================
   Template
================================== */
function tpl() {
  return modalTpl({
    id: "dialogue-panel",
    titleId: "dialogueTitle",
    backId: "dialogueBack",
    closeId: "dialogueCloseX",
    bodyId: "dialogueBody",
    titleText: "회화 학습",
    maxWidth: 720,
  });
}

/* ===============================
   Helpers
================================== */
function getLang(lang) {
  return String(lang || window.APP_LANG || window.site_lang || "ko").toLowerCase();
}

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

  const lang = getLang(raw?.lang);
  const title = pickText(raw.title, lang) || "회화 학습";
  const subtitle = pickText(raw.subtitle, lang);

  // accept dialogue under multiple keys (防止你数据字段不同)
  const list =
    (Array.isArray(raw.dialogue) && raw.dialogue) ||
    (Array.isArray(raw.conversation) && raw.conversation) ||
    (Array.isArray(raw.content) && raw.content) ||
    [];

  const dia = list.map(normalizeDialogueItem).filter((x) => x.zh || x.ko);

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
          ? dia
              .map((d, idx) => {
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
              })
              .join("")
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

  // per-line speak
  root.querySelectorAll("[data-speak-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-speak-idx"));
      const zh = pickText(dia[idx]?.zh, "zh");
      speakText(zh, "zh-CN");
    });
  });

  // speak all
  root.querySelector("#btnDiaSpeakAll")?.addEventListener("click", async () => {
    for (const d of dia) {
      const zh = pickText(d.zh, "zh");
      if (!zh) continue;
      speakText(zh, "zh-CN");
      await new Promise((r) => setTimeout(r, Math.min(1400 + zh.length * 120, 4000)));
    }
  });

  window.dispatchEvent(new CustomEvent("dialogue:rendered", { detail: raw }));
}
