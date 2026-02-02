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

        </div>
      </section>
      
    </div>
  `;

  app.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = btn.getAttribute("data-go");
    });
  });
}
