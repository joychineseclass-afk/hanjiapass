(function () {
  function render(container) {
    container.innerHTML = `
      <div class="page-wrap">
        <h1 class="page-title">HSK 系统课程</h1>

        <div class="section-box">
          <h2>📚 词汇学习区</h2>
          <div id="hsk-vocab-area">（以后加载词库）</div>
        </div>

        <div class="section-box">
          <h2>📝 句子练习区</h2>
          <div id="hsk-sentence-area">（以后加载例句）</div>
        </div>

        <div class="section-box">
          <h2>🎧 听力 & 跟读</h2>
          <div id="hsk-audio-area">（以后加载音频）</div>
        </div>
      </div>
    `;
  }

  function init() {
    const el = document.getElementById("app");
    if (!el) return;
    render(el);
  }

  window.PageHSK = { init };
})();
