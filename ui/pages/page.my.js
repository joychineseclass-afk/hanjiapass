// /ui/pages/page.my.js
import { i18n } from "../i18n.js";

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <h2 class="title" data-i18n="my_title">내 학습</h2>
        <p class="desc" data-i18n="coming_soon">
          개인 학습 기록 기능을 준비 중입니다.
        </p>
        <p class="learner-my-quicklinks">
          <a class="learner-my-link" href="#my-content" data-i18n="learner.nav.my_content">My content</a>
          <span class="learner-my-quicksep" aria-hidden="true">·</span>
          <a class="learner-my-link" href="#my-orders" data-i18n="learner.nav.my_orders">My orders</a>
        </p>
      </section>
    </div>
  `;

  i18n.apply?.(app);
}
