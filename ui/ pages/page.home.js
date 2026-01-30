(function () {
  function render(container) {
    container.innerHTML = `
      <div class="page-wrap">
        <h1 class="page-title">欢迎来到中文学习乐园</h1>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">

          <div class="home-card">📘 HSK系统课程</div>
          <div class="home-card">✍️ 汉字笔顺练习</div>
          <div class="home-card">🇰🇷 韩语汉字学习</div>
          <div class="home-card">💬 日常会话</div>
          <div class="home-card">✈️ 旅游中文</div>
          <div class="home-card">🏮 中国文化</div>

        </div>
      </div>
    `;
  }

  function init() {
    const el = document.getElementById("app");
    if (!el) return;
    render(el);
  }

  window.PageHome = { init };
})();
