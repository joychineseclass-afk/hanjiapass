(function () {
  function render(container) {
    container.innerHTML = `
      <div class="page-wrap">
        <h1 class="page-title">한자 공부 (韩语汉字)</h1>

        <div class="section-box">
          <h2>📖 常用韩语汉字</h2>
          <div id="hanja-list">（以后加载汉字词汇）</div>
        </div>

        <div class="section-box">
          <h2>🔄 中韩对比</h2>
          <div id="hanja-compare">（以后做简体/繁体/韩字对照）</div>
        </div>
      </div>
    `;
  }

  function init() {
    const el = document.getElementById("app");
    if (!el) return;
    render(el);
  }

  window.PageHanja = { init };
})();
