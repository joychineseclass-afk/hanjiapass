(function () {
  function render(container) {
    container.innerHTML = `
      <div class="page-wrap">
        <h1 class="page-title">汉字笔顺练习</h1>

        <div class="section-box">
          <h2>🔤 输入汉字</h2>
          <input id="stroke-input" class="input-box" placeholder="输入一个汉字" />
        </div>

        <div class="section-box">
          <h2>▶️ 笔顺演示区</h2>
          <div id="stroke-demo-area">（这里将来放自动笔顺演示）</div>
        </div>

        <div class="section-box">
          <h2>✍️ 描红练习区</h2>
          <div id="stroke-trace-area">（这里将来放描红系统）</div>
        </div>

        <div class="section-box">
          <h2>📖 汉字释义</h2>
          <div id="stroke-meaning-area">（以后接字义/HSK等级）</div>
        </div>
      </div>
    `;
  }

  function init() {
    const el = document.getElementById("app");
    if (!el) return;
    render(el);
  }

  window.PageStroke = { init };
})();

