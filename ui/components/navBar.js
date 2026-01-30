// ui/components/navBar.js
(function () {
  function renderNav() {
    const wrap = document.getElementById("siteNav");
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="nav">
        <div class="nav-left">
          <a class="nav-brand" href="/index.html">Joy Chinese</a>
        </div>

        <div class="nav-links">
          <a class="nav-link" href="/index.html" data-i18n="nav_home"></a>
          <a class="nav-link" href="/pages/hsk.html" data-i18n="nav_hsk"></a>
          <a class="nav-link" href="/pages/stroke.html" data-i18n="nav_stroke"></a>
          <a class="nav-link" href="/pages/hanja.html" data-i18n="nav_hanja"></a>
          <a class="nav-link" href="/pages/convo.html" data-i18n="nav_convo"></a>
          <a class="nav-link" href="/pages/travel.html" data-i18n="nav_travel"></a>
          <a class="nav-link" href="/pages/culture.html" data-i18n="nav_culture"></a>
          <a class="nav-link" href="/pages/review.html" data-i18n="nav_review"></a>
          <a class="nav-link" href="/pages/resources.html" data-i18n="nav_resources"></a>
          <a class="nav-link" href="/pages/teacher.html" data-i18n="nav_teacher"></a>
          <a class="nav-link" href="/pages/me.html" data-i18n="nav_me"></a>
        </div>

        <div class="nav-right">
          <button class="lang-btn" type="button" data-lang="ko">KR</button>
          <button class="lang-btn" type="button" data-lang="zh">CN</button>
        </div>
      </div>
    `;

    // 绑定语言切换
    wrap.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.I18N?.setLang?.(btn.getAttribute("data-lang"));
      });
    });

    // 立即应用一次（防止 nav 先空）
    window.I18N?.apply?.(window.I18N?.getLang?.());
  }

  document.addEventListener("DOMContentLoaded", renderNav);
})();
