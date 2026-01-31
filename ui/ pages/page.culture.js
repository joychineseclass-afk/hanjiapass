// /ui/pages/page.culture.js
import { i18n } from "../i18n.js";

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <h2 class="title" data-i18n="culture_title">문화</h2>
        <p class="desc" data-i18n="coming_soon">
          준비 중입니다. 곧 콘텐츠를 추가할게요.
        </p>
      </section>
    </div>
  `;

  i18n.apply?.(app);
}
