(function () {
  function renderNavBar() {
    return `
      <nav class="w-full bg-white shadow-sm border-b">
        <div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-3 text-sm font-medium">

          <a href="../index.html" class="nav-link">🏠 首页</a>
          <a href="../pages/hsk.html" class="nav-link">📘 HSK学习</a>
          <a href="../pages/stroke.html" class="nav-link">✍️ 汉字笔顺</a>
          <a href="../pages/hanja.html" class="nav-link">🇰🇷 한자공부</a>
          <a href="../pages/convo.html" class="nav-link">💬 会话</a>
          <a href="../pages/travel.html" class="nav-link">✈️ 旅游中文</a>
          <a href="../pages/culture.html" class="nav-link">🏮 文化</a>
          <a href="../pages/review.html" class="nav-link">🧠 复习</a>
          <a href="../pages/resources.html" class="nav-link">📂 资料库</a>
          <a href="../pages/teacher.html" class="nav-link">👩‍🏫 教师</a>
          <a href="../pages/me.html" class="nav-link">⭐ 我的</a>

        </div>
      </nav>
    `;
  }

  function mountNavBar() {
    const host = document.getElementById("site-nav");
    if (host) host.innerHTML = renderNavBar();
  }

  window.NavBar = { mountNavBar };
})();
