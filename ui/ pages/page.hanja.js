// /ui/pages/page.hanja.js  ✅融合升级版：结构保留 + i18n + 兼容旧路由
import { i18n } from "../i18n.js";

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <h1 class="page-title" data-i18n="hanja_title">한자공부</h1>

      <div class="section-box">
        <h2 data-i18n="hanja_section_vocab">📖 常用韩语汉字</h2>
        <div id="hanja-list" class="placeholder" data-i18n="coming_soon_detail">
          （以后加载汉字词汇）
        </div>
      </div>

      <div class="section-box">
        <h2 data-i18n="hanja_section_compare">🔄 中韩对比</h2>
        <div id="hanja-compare" class="placeholder" data-i18n="hanja_compare_placeholder">
          （以后做简体/繁体/韩字对照）
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <section class="hero">
          <p class="desc" data-i18n="coming_soon">
            준비 중입니다. 한자 학습 콘텐츠를 추가할 예정입니다.
          </p>
        </section>
      </div>
    </div>
  `;

  // ✅ 只对当前页面区域 apply（更稳）
  i18n.apply?.(container);

// ================== HSK8 한자 단어 예시 ==================
const hanjaData = [
  { hanja: "学", pinyin: "xué", meaning: "배우다 / 학습" },
  { hanja: "校", pinyin: "xiào", meaning: "학교" },
  { hanja: "生", pinyin: "shēng", meaning: "학생 / 태어나다" },
  { hanja: "先", pinyin: "xiān", meaning: "먼저 / 선생" },
  { hanja: "名", pinyin: "míng", meaning: "이름 / 유명하다" }
];

const listEl = container.querySelector("#hanja-list");
if (listEl) {
  listEl.classList.remove("placeholder");

  listEl.innerHTML = hanjaData.map(item => `
    <div class="hanja-card">
      <div class="hanja-char">${item.hanja}</div>
      <div class="hanja-pinyin">${item.pinyin}</div>
      <div class="hanja-meaning">${item.meaning}</div>
    </div>
  `).join("");
}
// =========================================================
}

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;
  render(app);
}

// ✅ 兼容旧写法：window.PageHanja.init()
(function exposeToWindow() {
  window.PageHanja = {
    init: () => mount(),
    mount,
  };
})();
