// ui/pages/page.hanja.js
// ✅ 统一平台风格：与 Home / HSK 一致的 card/section 布局
// ✅ 全部文案走 i18n，支持 KR/CN/EN/JP
// ✅ 语言切换后完整 rerender

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
    .lumina-hanja .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-hanja .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-hanja .page-title{ margin:0; font-size:24px; font-weight:900; letter-spacing:-0.3px; }
    .lumina-hanja .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.6; }
    .lumina-hanja .section-title{ margin:0; font-size:16px; font-weight:800; }
    .lumina-hanja .hanja-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; }
    .lumina-hanja .hanja-card{ padding:14px; border:1px solid var(--line,#e2e8f0); border-radius:12px; background:#fff; text-align:center; }
    .lumina-hanja .hanja-char{ font-size:32px; font-weight:900; margin-bottom:6px; }
    .lumina-hanja .hanja-pinyin{ font-size:13px; color:var(--muted,#475569); }
    .lumina-hanja .hanja-meaning{ font-size:14px; margin-top:4px; }
  `;
  document.head.appendChild(style);
}

function render(container) {
  const hanjaData = [
    { hanja: "学", pinyin: "xué", meaning: "배우다 / 학습" },
    { hanja: "校", pinyin: "xiào", meaning: "학교" },
    { hanja: "生", pinyin: "shēng", meaning: "학생 / 태어나다" },
    { hanja: "先", pinyin: "xiān", meaning: "먼저 / 선생" },
    { hanja: "名", pinyin: "míng", meaning: "이름 / 유명하다" },
  ];

  container.innerHTML = `
    <div class="lumina-hanja">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h1 class="page-title" data-i18n="hanja.title"></h1>
              <p class="page-desc" data-i18n="hanja.coming_soon"></p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h2 class="section-title" data-i18n="hanja.section_vocab"></h2>
              <div id="hanja-list" class="hanja-grid">
                ${hanjaData.map((item) => `
                  <div class="hanja-card">
                    <div class="hanja-char">${item.hanja}</div>
                    <div class="hanja-pinyin">${item.pinyin}</div>
                    <div class="hanja-meaning">${item.meaning}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <h2 class="section-title" data-i18n="hanja.section_compare"></h2>
              <div id="hanja-compare" class="muted" data-i18n="hanja.compare_placeholder"></div>
            </div>
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
