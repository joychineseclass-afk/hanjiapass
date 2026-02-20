// /ui/components/modalBase.js
// ✅ Modal Base (single-style system)
// - consistent overlay + modal layout
// - mount once
// - open/close helpers
// - Esc close (bind once per modal id)
// - click backdrop to close
// - optional: lock body scroll while modal open
// - ESM-friendly

export function modalTpl({
  id,
  titleId,
  backId,
  closeId,
  bodyId,
  titleText = "",
  maxWidth = 560,
}) {
  return `
    <div id="${id}"
      class="hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      aria-label="${id}"
    >
      <div class="w-full max-w-[${maxWidth}px] rounded-2xl bg-white shadow-2xl overflow-hidden relative">
        <!-- topbar -->
        <div class="sticky top-0 z-10 bg-white border-b">
          <div class="flex items-center justify-between px-4 py-3">
            <button id="${backId}" type="button"
              class="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold">
              ← 뒤로
            </button>

            <div class="font-extrabold" id="${titleId}">${titleText}</div>

            <button id="${closeId}" type="button"
              class="w-10 h-10 rounded-xl bg-slate-100 text-lg leading-none font-bold">
              ×
            </button>
          </div>
        </div>

        <!-- body -->
        <div id="${bodyId}" class="p-4 space-y-4 max-h-[78vh] overflow-auto"></div>
      </div>
    </div>
  `;
}

/**
 * createModalSystem
 * - takes rootWrap (the wrapper you inserted into DOM)
 * - wires open/close/backdrop/esc
 * - returns { overlay, body, titleEl, open(), close(), setTitle(), setBodyHTML() }
 */
export function createModalSystem(rootWrap, cfg) {
  const {
    id,
    titleId,
    backId,
    closeId,
    bodyId,
    onBack,
    onClose,
    lockScroll = true,
    escClose = true,
  } = cfg;

  const overlay = rootWrap.querySelector(`#${id}`);
  const backBtn = rootWrap.querySelector(`#${backId}`);
  const closeBtn = rootWrap.querySelector(`#${closeId}`);
  const body = rootWrap.querySelector(`#${bodyId}`);
  const titleEl = rootWrap.querySelector(`#${titleId}`);

  if (!overlay || !body) {
    console.warn("[modalBase] overlay/body not found:", id);
  }

  const open = () => {
    overlay?.classList.remove("hidden");
    if (lockScroll) lockBodyScroll(true);
  };

  const close = () => {
    overlay?.classList.add("hidden");
    if (lockScroll) lockBodyScroll(false);
    onClose?.();
  };

  // close button
  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  // back button (default = close)
  backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onBack === "function") onBack();
    else close();
  });

  // click backdrop to close
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Esc close (bind once per modal id) ✅ safe for ids with hyphen
if (escClose) {
  const attr = `data-esc-bound-${id}`; // id can contain "-"
  if (!document.body.hasAttribute(attr)) {
    document.body.setAttribute(attr, "1");
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }
}
  

  return {
    overlay,
    body,
    titleEl,
    open,
    close,
    setTitle: (t) => {
      if (titleEl) titleEl.textContent = String(t ?? "");
    },
    setBodyHTML: (html) => {
      if (body) body.innerHTML = html || "";
    },
  };
}

function lockBodyScroll(locked) {
  try {
    if (locked) {
      if (!document.body.dataset.__modalScrollLocked) {
        document.body.dataset.__modalScrollLocked = "1";
        document.body.dataset.__modalScrollTop = String(window.scrollY || 0);
        document.body.style.position = "fixed";
        document.body.style.top = `-${window.scrollY || 0}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
      }
    } else {
      if (document.body.dataset.__modalScrollLocked) {
        const top = Number(document.body.dataset.__modalScrollTop || "0");
        delete document.body.dataset.__modalScrollLocked;
        delete document.body.dataset.__modalScrollTop;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, top);
      }
    }
  } catch {}
}
