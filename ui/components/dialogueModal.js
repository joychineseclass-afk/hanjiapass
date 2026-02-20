// /ui/components/dialogueModal.js
// ✅ Dialogue Modal (ESM)
// Usage:
//   import { mountDialogueModal, openDialogueModal } from "../components/dialogueModal.js";
//   mountDialogueModal(); // once
//   openDialogueModal({ title, subtitle, dialogue, lang });

let mounted = false;

export function mountDialogueModal(opts = {}) {
  if (mounted) return;
  mounted = true;

  const { container = document.body } = opts;

  // remove old if exists
  const existed = document.getElementById("dialogue-modal-root");
  if (existed) existed.remove();

  const root = document.createElement("div");
  root.id = "dialogue-modal-root";
  root.innerHTML = tpl();
  container.appendChild(root);

  const overlay = root.querySelector("#dialogueModal");
  const titleEl = root.querySelector("#diaTitle");
  const subtitleEl = root.querySelector("#diaSubtitle");
  const bodyEl = root.querySelector("#diaBody");
  const btnClose = root.querySelector("#diaClose");
  const btnBack = root.querySelector("#diaBack");

  const open = () => overlay?.classList.remove("hidden");
  const close = () => overlay?.classList.add("hidden");

  btnClose?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  btnBack?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  if (!document.body.dataset.__diaEscBound) {
    document.body.dataset.__diaEscBound = "1";
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // event-driven open (optional)
  window.addEventListener("dialogue:open", (e) => {
    const d = e?.detail || {};
    render(titleEl, subtitleEl, bodyEl, d);
    open();
  });

  window.DIALOGUE_MODAL = { open, close, render: (d) => render(titleEl, subtitleEl, bodyEl, d) };
}

export function openDialogueModal(data) {
  // safe: mount if not
  if (!mounted) mountDialogueModal();
  window.dispatchEvent(new CustomEvent("dialogue:open", { detail: data }));
}

function tpl() {
  return `
  <div id="dialogueModal" class="hidden fixed inset-0 z-[9999] bg-black/50 p-4 flex items-center justify-center">
    <div class="w-full max-w-[760px] bg-white rounded-2xl shadow-2xl overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b">
        <button id="diaBack" class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">← 뒤로</button>
        <div class="text-base font-extrabold">회화 학습</div>
        <button id="diaClose" class="w-10 h-10 rounded-xl bg-slate-100 text-lg font-bold">×</button>
      </div>

      <div class="p-4">
        <div id="diaTitle" class="text-xl font-extrabold"></div>
        <div id="diaSubtitle" class="text-sm text-gray-500 mt-1"></div>
      </div>

      <div id="diaBody" class="px-4 pb-5 space-y-3 max-h-[72vh] overflow-auto"></div>
    </div>
  </div>
  `;
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
    return (
      pickText(v?.[L], lang) ||
      pickText(v?.ko, lang) ||
      pickText(v?.kr, lang) ||
      pickText(v?.zh, lang) ||
      pickText(v?.cn, lang) ||
      pickText(v?.en, lang) ||
      ""
    );
  }
  return "";
}

function normalizeItem(item) {
  if (typeof item === "string") return { speaker: "", zh: item, ko: "", pinyin: "" };
  if (!item || typeof item !== "object") return { speaker: "", zh: "", ko: "", pinyin: "" };

  return {
    speaker: item.speaker || item.role || item.who || "",
    zh: item.zh ?? item.cn ?? item.textZh ?? item.textCN ?? item.text ?? item.line ?? "",
    ko: item.ko ?? item.kr ?? item.trans ?? item.textKo ?? item.textKR ?? "",
    pinyin: item.pinyin ?? item.py ?? "",
  };
}

function render(titleEl, subtitleEl, bodyEl, raw) {
  const lang = raw?.lang || localStorage.getItem("joy_lang") || "ko";
  const title = pickText(raw?.title, lang) || "회화 학습";
  const subtitle = pickText(raw?.subtitle, lang) || "";

  const list = Array.isArray(raw?.dialogue) ? raw.dialogue : [];
  const dia = list.map(normalizeItem).filter((x) => x.zh || x.ko);

  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  if (!bodyEl) return;

  if (!dia.length) {
    bodyEl.innerHTML = `<div class="text-sm text-gray-500">회화 데이터가 없어요.</div>`;
    return;
  }

  bodyEl.innerHTML = dia
    .map((d) => {
      const sp = esc(pickText(d.speaker, lang));
      const zh = esc(pickText(d.zh, "zh"));
      const py = esc(pickText(d.pinyin, lang));
      const ko = esc(pickText(d.ko, "ko"));
      return `
        <div class="rounded-2xl border p-4">
          ${sp ? `<div class="text-xs text-gray-500 mb-1">${sp}</div>` : ""}
          <div class="text-lg font-bold">${zh}</div>
          ${py ? `<div class="text-blue-600 mt-1">${py}</div>` : ""}
          ${ko ? `<div class="text-gray-600 mt-2">${ko}</div>` : ""}
        </div>
      `;
    })
    .join("");
}
