// /ui/pages/page.review.js
import { i18n } from "../i18n.js";

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <h2 class="title" data-i18n="review_title">복습</h2>
        <p class="desc" data-i18n="coming_soon">
          복습 콘텐츠를 준비 중입니다.
        </p>
      </section>
    </div>
  `;

  i18n.apply?.(app);
}
