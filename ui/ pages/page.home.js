// /ui/pages/page.home.js
// ✅ Home page (Router mount version)
// - 合并：旧 home-card 网格 + 新 hero/badges
// - 点击卡片 → 切换 hash → router 加载对应 page

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <div>
          <h2 class="title" data-i18n="heroTitle">
            적합한 어린이~성인 종합 중국어 학습 사이트
          </h2>

          <p class="desc" data-i18n="heroDesc">
            HSK, 한자 필순, 회화, 여행 중국어 등 기능을 단계적으로 추가합니다.
          </p>

          <div class="badges">
            <span class="badge">HSK</span>
            <span class="badge">필순</span>
            <span class="badge">회화</span>
            <span class="badge">여행</span>
            <span class="badge">문화</span>
          </div>
        </div>
      </section>

      <!-- ✅ 功能入口网格：来自你旧版 home.js，但改成系统风格 + 路由跳转 -->
      <div class="page-wrap" style="padding:0; margin-top:14px;">
        <div class="home-grid">
          <button class="home-card" type="button" data-go="#hsk">
            📘 <span data-i18n="home_hsk">HSK 시스템 코스</span>
          </button>

          <button class="home-card" type="button" data-go="#stroke">
            ✍️ <span data-i18n="home_stroke">한자 필순 연습</span>
          </button>

          <button class="home-card" type="button" data-go="#hanja">
          🇰🇷 <span data-i18n="home_hanja">한국식 한자 공부</span>
          </button>

          <button class="home-card" type="button" data-go="#speaking">
            💬 <span data-i18n="home_speaking">일상 회화</span>
          </button>

          <button class="home-card" type="button" data-go="#travel">
            ✈️ <span data-i18n="home_travel">여행 중국어</span>
          </button>

          <button class="home-card" type="button" data-go="#culture">
            🏮 <span data-i18n="home_culture">중국 문화</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // ✅ 卡片点击 → hash 跳转（router 会自动加载对应 page）
  app.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const go = btn.getAttribute("data-go");
      if (!go) return;
      location.hash = go;
    });
  });
}
