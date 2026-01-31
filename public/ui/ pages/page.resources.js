// /ui/pages/page.resources.js
import { i18n } from "../i18n.js";

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <h2 class="title" data-i18n="resources_title">학습 자료</h2>
        <p class="desc" data-i18n="coming_soon">
          다양한 학습 자료가 곧 추가됩니다.
        </p>
      </section>
    </div>
  `;

  i18n.apply?.(app);
}
