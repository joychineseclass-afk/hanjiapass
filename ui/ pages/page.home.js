// /ui/pages/page.home.js
export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <div>
          <h2 class="title">적합한 어린이~성인 종합 중국어 학습 사이트</h2>
          <p class="desc">
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

      <div class="page-wrap" style="padding:0; margin-top:14px;">
        <div class="home-grid">

          <button class="home-card" type="button" data-go="#hsk" style="--dop:#3b82f6">📘 HSK 시스템 코스</button>
          <button class="home-card" type="button" data-go="#stroke" style="--dop:#f97316">✍️ 한자 필순 연습</button>
          <button class="home-card" type="button" data-go="#hanja" style="--dop:#22c55e">🇰🇷 한국식 한자 공부</button>
          <button class="home-card" type="button" data-go="#speaking" style="--dop:#a855f7">💬 일상 회화</button>
          <button class="home-card" type="button" data-go="#travel" style="--dop:#ef4444">✈️ 여행 중국어</button>
          <button class="home-card" type="button" data-go="#culture" style="--dop:#eab308">🏮 중국 문화</button>

        </div>
      </div>
    </div>
  `;

  app.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = btn.getAttribute("data-go");
    });
  });
}
