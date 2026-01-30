// /ui/components/navBar.js
(function () {
  function renderNavBar(activeKey = "") {
    const navItems = [
      { key: "home", label: "首页", href: "/index.html" },
      { key: "hsk", label: "HSK学习", href: "/pages/hsk.html" },
      { key: "stroke", label: "汉字笔顺", href: "/pages/stroke.html" },
      { key: "hanja", label: "한자공부", href: "/pages/hanja.html" },
      { key: "convo", label: "会话", href: "/pages/convo.html" },
      { key: "travel", label: "旅游中文", href: "/pages/travel.html" },
      { key: "culture", label: "文化", href: "/pages/culture.html" },
      { key: "review", label: "复习区", href: "/pages/review.html" },
      { key: "resources", label: "资源", href: "/pages/resources.html" },
      { key: "teacher", label: "教师专区", href: "/pages/teacher.html" },
      { key: "me", label: "我的学习", href: "/pages/me.html" },
    ];

    const links = navItems
      .map(
        (item) => `
        <a href="${item.href}" 
           class="nav-link ${activeKey === item.key ? "active" : ""}">
          ${item.label}
        </a>`
      )
      .join("");

    return `
      <header class="bg-white shadow-sm sticky top-0 z-50">
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="text-lg font-bold text-orange-500">
            AI 汉字学习平台
          </div>
          <nav class="flex flex-wrap gap-2 text-sm">
            ${links}
          </nav>
        </div>
      </header>
    `;
  }

  window.NavBar = { renderNavBar };
})();
