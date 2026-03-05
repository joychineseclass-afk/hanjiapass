// /ui/modules/hsk/strokeModal.js
// HSK 页内 Stroke 弹窗：iframe 内嵌 stroke 页，关闭时恢复滚动

import { modalTpl, createModalSystem } from "../../components/modalBase.js";

/** 解析 stroke 页 URL（避免 /pages/pages/） */
function resolveStrokeUrl(hanzi, opts = {}) {
  const ch = encodeURIComponent((hanzi || "").trim());
  const embed = opts.embed ? "&embed=1" : "";
  const inPages =
    typeof location !== "undefined" && location.pathname?.includes("/pages/");
  const base = inPages ? "stroke.html" : "/pages/stroke.html";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}ch=${ch}${embed}`;
}

/** 构建 return 参数（用于新标签 fallback） */
function buildReturnParams(ctx = {}) {
  const from = ctx.from || location.pathname || "/pages/hsk.html";
  const p = new URLSearchParams();
  p.set("from", from);
  if (ctx.lessonId) p.set("lessonId", String(ctx.lessonId));
  if (ctx.level != null) p.set("level", String(ctx.level));
  if (ctx.version) p.set("version", String(ctx.version));
  if (ctx.wordId) p.set("wordId", String(ctx.wordId));
  return p.toString();
}

let _strokeModal = null;

function ensureStrokeModal() {
  if (_strokeModal) return _strokeModal;

  let portal = document.getElementById("portal-root") || document.getElementById("strokeModalRoot");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "stroke-modal-portal";
    document.body.appendChild(portal);
  }

  const root = document.createElement("div");
  root.id = "hsk-stroke-modal-root";
  root.innerHTML = modalTpl({
    id: "hsk-stroke-modal",
    titleId: "hskStrokeTitle",
    backId: "hskStrokeBack",
    closeId: "hskStrokeClose",
    bodyId: "hskStrokeBody",
    titleText: "",
    maxWidth: 920,
  });
  portal.appendChild(root);

  let _onClose = null;

  const sys = createModalSystem(root, {
    id: "hsk-stroke-modal",
    titleId: "hskStrokeTitle",
    backId: "hskStrokeBack",
    closeId: "hskStrokeClose",
    bodyId: "hskStrokeBody",
    lockScroll: true,
    escClose: true,
    onClose: () => {
      try {
        _onClose?.();
      } finally {
        _onClose = null;
      }
    },
  });

  _strokeModal = {
    open: (opts) => sys.open(opts),
    close: () => sys.close(),
    setTitle: sys.setTitle,
    setBodyHTML: (html) => {
      if (sys.body) sys.body.innerHTML = html || "";
    },
    body: sys.body,
    _setOnClose: (fn) => {
      _onClose = fn;
    },
  };

  return _strokeModal;
}

/**
 * 打开 Stroke 弹窗（优先 iframe 内嵌）
 * @param {string} hanzi - 汉字
 * @param {object} ctx - { version, level, lessonId, wordId, scrollY, hash, from }
 */
export async function openStrokeInModal(hanzi, ctx = {}) {
  const ch = String(hanzi ?? "").trim();
  if (!ch) return;

  const modal = ensureStrokeModal();
  const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
  const hash = typeof location !== "undefined" ? (location.hash || "") : "";
  const fullCtx = {
    ...ctx,
    scrollY,
    hash,
    from: ctx.from || (typeof location !== "undefined" ? location.pathname : "/pages/hsk.html"),
    wordId: ctx.wordId || ch,
  };

  const iframeSrc = resolveStrokeUrl(ch, { embed: true });
  const bodyHTML = `
    <div id="strokeHost" style="min-height:70vh;">
      <iframe
        id="stroke-iframe"
        src="${iframeSrc}"
        style="width:100%;height:70vh;border:0;border-radius:12px;"
        title="笔画 - ${ch}"
      ></iframe>
    </div>
  `;

  modal.setTitle(`笔画 / Stroke - ${ch}`);
  modal.setBodyHTML(bodyHTML);

  modal._setOnClose(() => {
    try {
      window.scrollTo(0, fullCtx.scrollY ?? 0);
    } catch {}
    const card = document.querySelector(`[data-word-hanzi="${ch}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  modal.open();

  // 可选：iframe 加载失败时 fallback 到新标签
  const iframe = document.getElementById("stroke-iframe");
  if (iframe) {
    iframe.onerror = () => fallbackToNewTab(ch, fullCtx);
    iframe.addEventListener("load", function onLoad() {
      try {
        iframe.removeEventListener("load", onLoad);
        // 简单探测：若 iframe 内容为空或报错，可视为失败
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body?.innerHTML?.trim()) {
          fallbackToNewTab(ch, fullCtx);
        }
      } catch {
        // 跨域时无法访问 contentDocument，忽略
      }
    });
  }
}

/**
 * Fallback：新标签打开 stroke 页，并带上 return 参数
 */
function fallbackToNewTab(hanzi, ctx) {
  const baseUrl = resolveStrokeUrl(hanzi, { embed: false });
  const returnParams = buildReturnParams(ctx);
  const sep = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${sep}${returnParams}`;
  window.open(url, "_blank", "noopener");
}

export { resolveStrokeUrl, buildReturnParams };
