// /ui/pages/page.travel.js
import { i18n } from "../i18n.js";

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <h2 class="title" data-i18n="travel_title">여행중국어</h2>
        <p class="desc" data-i18n="travel_desc">
          준비 중입니다. 곧 공항/호텔/식당/교통 회화를 추가할게요.
        </p>

        <div class="badges">
          <span class="badge">공항</span>
          <span class="badge">호텔</span>
          <span class="badge">식당</span>
          <span class="badge">교통</span>
        </div>
      </section>
    </div>
  `;

  // 如果你有 i18n observe，这行可有可无；加了更保险
  i18n.apply?.(app);
}
