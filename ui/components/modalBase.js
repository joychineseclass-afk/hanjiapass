// /ui/components/modalBase.js
// ✅ Modal Base (no-tailwind required)

let __modalStyleInjected = false;

function injectModalCSS() {
  if (__modalStyleInjected) return;
  __modalStyleInjected = true;

  const css = `
  .joy-modal-overlay{
    position: fixed; inset: 0;
    z-index: 9999;
    display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,.5);
    padding: 16px;
  }
  .joy-modal-overlay.is-open{ display:flex; }

  .joy-modal-card{
    width: 100%;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
    overflow: hidden;
  }
  .joy-modal-top{
    position: sticky; top:0;
    background:#fff;
    border-bottom:1px solid #eee;
  }
  .joy-modal-topbar{
    display:flex; align-items:center; justify-content:space-between;
    padding: 12px 16px;
    gap: 12px;
  }
  .joy-modal-btn{
    padding: 8px 12px;
    border-radius: 12px;
    background: #f1f5f9;
    font-weight: 700;
    border: 0;
    cursor: pointer;
  }
  .joy-modal-x{
    width: 40px; height: 40px;
    border-radius: 12px;
    background: #f1f5f9;
    font-size: 18px;
    font-weight: 800;
    border: 0;
    cursor: pointer;
  }
  .joy-modal-body{
    padding: 16px;
    max-height: 78vh;
    overflow: auto;
  }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-joy-modal", "1");
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
  maxWidth = 560,
}) {
  // 这里不注入，等 createModalSystem 时注入（确保 head 已存在）
  return `
    <div id="${id}" class="joy-modal-overlay" aria-label="${id}">
      <div class="joy-modal-card" style="max-width:${Number(maxWidth) || 560}px">
        <div class="joy-modal-top">
          <div class="joy-modal-topbar">
            <button id="${backId}" type="button" class="joy-modal-btn">← 뒤로</button>
            <div id="${titleId}" style="font-weight:800">${titleText}</div>
            <button id="${closeId}" type="button" class="joy-modal-x">×</button>
          </div>
        </div>
        <div id="${bodyId}" class="joy-modal-body"></div>
      </div>
    </div>
  `;
}

export function createModalSystem(rootWrap, cfg) {
  injectModalCSS();

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
    overlay?.classList.add("is-open");
    if (lockScroll) lockBodyScroll(true);
  };

  const close = () => {
    overlay?.classList.remove("is-open");
    if (lockScroll) lockBodyScroll(false);
    onClose?.();
  };

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    close();
  });

  backBtn?.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (typeof onBack === "function") onBack();
    else close();
  });

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  if (escClose) {
    // ✅ dataset key 不能有 "-"，用 safeKey
    const safeKey = String(id).replace(/[^a-zA-Z0-9_]/g, "_");
    const key = `escBound_${safeKey}`;
    if (!document.body.dataset[key]) {
      document.body.dataset[key] = "1";
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
    setTitle: (t) => { if (titleEl) titleEl.textContent = String(t ?? ""); },
    setBodyHTML: (html) => { if (body) body.innerHTML = html || ""; },
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
