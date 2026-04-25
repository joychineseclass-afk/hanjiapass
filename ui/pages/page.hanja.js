// ui/pages/page.hanja.js — 汉字学习（与笔顺工具页分离）
import { i18n } from "../i18n.js";

let _hanjaLangHandler = null;

function ensureHanjaStyles() {
  if (document.getElementById("lumina-hanja-style")) return;
  const style = document.createElement("style");
  style.id = "lumina-hanja-style";
  style.textContent = `
    .lumina-hanja{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-hanja .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-hanja .section{ padding:10px 0 18px; }
    .lumina-hanja .card{ background:rgba(255,255,255,.92); border:1px solid var(--line,#e2e8f0); border-radius:calc(var(--radius,18px) + 4px); box-shadow:0 12px 32px rgba(15,23,42,.08); overflow:hidden; }
    .lumina-hanja .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-hanja .page-title{ margin:0; font-size:24px; font-weight:900; letter-spacing:-0.3px; }
    .lumina-hanja .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.65; }
    .lumina-hanja .hanja-grid-3{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
    .lumina-hanja .hanja-card{ padding:16px; border-radius:14px; border:1px solid var(--line,#e2e8f0); background:#fff; min-height:120px; }
    .lumina-hanja .hanja-card h3{ margin:0 0 8px; font-size:1.05rem; font-weight:800; }
    .lumina-hanja .hanja-card p{ margin:0; font-size:14px; color:var(--muted,#475569); line-height:1.6; }
  `;
  document.head.appendChild(style);
}

function phCard(titleKey, descKey) {
  return `
    <div class="hanja-card">
      <h3 data-i18n="${titleKey}"></h3>
      <p data-i18n="${descKey}"></p>
    </div>`;
}

function render(container) {
  container.innerHTML = `
    <div class="lumina-hanja">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h1 class="page-title" data-i18n="hanja.title"></h1>
              <p class="page-desc" data-i18n="hanja.lead"></p>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="hanja-grid-3">
            ${phCard("hanja.card_levels_title", "hanja.card_levels_desc")}
            ${phCard("hanja.card_vocab_title", "hanja.card_vocab_desc")}
            ${phCard("hanja.card_quiz_title", "hanja.card_quiz_desc")}
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mount(ctxOrRoot) {
  const el = ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!el) return;

  ensureHanjaStyles();
  render(el);
  i18n.apply(el);

  _hanjaLangHandler = () => {
    i18n.apply(el);
  };

  window.addEventListener("joy:langChanged", _hanjaLangHandler);
  window.addEventListener("joy:lang", _hanjaLangHandler);
  window.addEventListener("i18n:changed", _hanjaLangHandler);
}

export function unmount() {
  if (_hanjaLangHandler) {
    window.removeEventListener("joy:langChanged", _hanjaLangHandler);
    window.removeEventListener("joy:lang", _hanjaLangHandler);
    window.removeEventListener("i18n:changed", _hanjaLangHandler);
    _hanjaLangHandler = null;
  }
}

export default { mount, unmount };
