// /ui/components/modalBase.js
// ✅ Modal Base (single-style system, no Tailwind dependency)
// - injects minimal CSS once (center + overlay + z-index)
// - provides modalTpl() + createModalSystem()
// - safe Esc binding per modal id

const STYLE_ID = "__joy_modal_base_style__";

function ensureModalCss() {
  if (document.getElementById(STYLE_ID)) return;

  const css = `
    /* ===== Joy Modal Base (no tailwind required) ===== */
    .joy-modal-hidden { display: none !important; }

    .joy-modal-overlay{
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.45);
      padding: 16px;
    }

    .joy-modal-box{
      width: 100%;
      max-height: 78vh;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,.28);
      overflow: hidden;
      position: relative;
      max-width: 720px;
    }

    .joy-modal-topbar{
      position: sticky;
      top: 0;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      z-index: 2;
    }

    .joy-modal-topbar-inner{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
    }

    .joy-modal-btn{
      border: 0;
      background: #f1f5f9;
      border-radius: 12px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
      user-select: none;
    }
    .joy-modal-btn:hover{ background: #e8eef6; }

    .joy-modal-closeX{
      width: 40px;
      height: 40px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
    }

    .joy-modal-title{
      font-weight: 800;
      font-size: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 55vw;
    }

    .joy-modal-body{
      padding: 14px;
      overflow: auto;
      max-height: 78vh;
    }
  `.trim();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export function modalTpl({
  id,
  titleId,
  backId,
  closeId,
  bodyId,
  titleText = "",
  maxWidth = 720,
}) {
  // ✅ ensure base CSS once
  ensureModalCss();

  return `
    <div id="${id}" class="joy-modal-overlay joy-modal-hidden" aria-label="${id}">
      <div class="joy-modal-box" style="max-width:${Number(maxWidth) || 720}px">
        <div class="joy-modal-topbar">
          <div class="joy-modal-topbar-inner">
            <button id="${backId}" type="button" class="joy-modal-btn">← 뒤로</button>
            <div class="joy-modal-title" id="${titleId}">${titleText}</div>
            <button id="${closeId}" type="button" class="joy-modal-btn joy-modal-closeX">×</button>
          </div>
        </div>
        <div id="${bodyId}" class="joy-modal-body"></div>
      </div>
    </div>
  `;
}

export function createModalSystem(rootWrap, cfg) {
  ensureModalCss();

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

  const open = () => {
    overlay?.classList.remove("joy-modal-hidden");
    if (lockScroll) lockBodyScroll(true);
  };

  const close = () => {
  overlay?.classList.add("joy-modal-hidden");
  if (lockScroll) lockBodyScroll(false);
  onClose?.();

  // ⭐ 通知系统：弹窗关闭了
  window.dispatchEvent(
    new CustomEvent("modal:close")
  );
};

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

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

  // Esc close (bind once per modal id)
  if (escClose) {
    const attr = `data-esc-bound-${id}`;
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
