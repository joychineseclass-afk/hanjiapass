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

export function modalTpl({ id, titleId, backId, closeId, bodyId, titleText = "" }) {
  return `
    <div id="${id}" class="jc-hidden jc-modal-overlay" aria-label="${id}">
      <div class="jc-modal-box">
        <div class="jc-modal-top">
          <button id="${backId}" type="button" class="jc-btn">← 뒤로</button>
          <div id="${titleId}" style="font-weight:800;">${titleText}</div>
          <button id="${closeId}" type="button" class="jc-btn">×</button>
        </div>
        <div id="${bodyId}" class="jc-modal-body"></div>
      </div>
    </div>
  `;
}

export function createModalSystem(rootWrap, cfg) {
  ensureModalCSS();

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
function ensureModalCss() {
  if (document.getElementById("jc-modal-css")) return;
  const style = document.createElement("style");
  style.id = "jc-modal-css";
  style.textContent = `
    /* ✅ Tailwind fallback for modal usage */
    .hidden{display:none!important;}

    /* common overlay look if you rely on fixed/inset styles */
    .fixed{position:fixed;}
    .inset-0{top:0;right:0;bottom:0;left:0;}
    .bg-black\\/50{background:rgba(0,0,0,.5);}
    .flex{display:flex;}
    .items-center{align-items:center;}
    .justify-center{justify-content:center;}
    .p-4{padding:16px;}

    /* better modal box defaults */
    .shadow-2xl{box-shadow:0 20px 60px rgba(0,0,0,.25);}
    .rounded-2xl{border-radius:16px;}
    .overflow-hidden{overflow:hidden;}
    .bg-white{background:#fff;}

    /* body scrolling */
    .max-h-\\[78vh\\]{max-height:78vh;}
    .overflow-auto{overflow:auto;}

    /* simple button styling if tailwind absent */
    .bg-slate-100{background:#f1f5f9;}
    .rounded-xl{border-radius:12px;}
    .px-3{padding-left:12px;padding-right:12px;}
    .py-2{padding-top:8px;padding-bottom:8px;}
    .text-sm{font-size:14px;}
    .font-bold{font-weight:700;}
    .w-10{width:40px;}
    .h-10{height:40px;}
    .text-lg{font-size:18px;}
    .leading-none{line-height:1;}
    .border-b{border-bottom:1px solid #eee;}
    .border{border:1px solid #eee;}
    .sticky{position:sticky;}
    .top-0{top:0;}
    .z-10{z-index:10;}
    .relative{position:relative;}
  `;
  document.head.appendChild(style);
}
