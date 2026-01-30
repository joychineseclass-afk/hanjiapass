// /ui/components/navBar.js
(function () {
  const NAV_ID = "siteNav";

  const items = [
    { label: "首页", href: "../index.html" },
    { label: "HSK学习", href: "./hsk.html" },
    { label: "汉字笔顺", href: "./stroke.html" },
    { label: "한자공부", href: "./hanja.html" },
    { label: "会话", href: "./convo.html" },
    { label: "旅游中文", href: "./travel.html" },
    { label: "文化", href: "./culture.html" },
    { label: "复习区", href: "./review.html" },
    { label: "资源", href: "./resources.html" },
    { label: "教师", href: "./teacher.html" },
    { label: "我的", href: "./me.html" },
  ];

  function normalizePath(p) {
    return (p || "").split("?")[0].split("#")[0];
  }

  function isActive(current, targetHref) {
    // current: /hanjapass/pages/hsk.html
    // target:  ./hsk.html  or ../index.html
    const cur = normalizePath(current);
    const t = normalizePath(targetHref);

    // 取文件名比较最稳（hsk.html）
    const curFile = cur.split("/").pop();
    const tarFile = t.split("/").pop();
    return curFile && tarFile && curFile === tarFile;
  }

  function render() {
    const mount = document.getElementById(NAV_ID);
    if (!mount) return;

    const curPath = location.pathname || "";

    const linksHtml = items
      .map((it) => {
        const active = isActive(curPath, it.href) ? "active" : "";
        return `<a class="nav-link ${active}" href="${it.href}">${it.label}</a>`;
      })
      .join("");

    mount.innerHTML = `
      <div class="site-nav">
        <div class="nav-inner">
          ${linksHtml}
        </div>
      </div>
    `;
  }

  // DOM 준비 후 실행
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
