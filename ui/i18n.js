// ui/i18n.js
(function () {
  const STORE_KEY = "site_lang"; // "ko" | "zh"
  const DEFAULT_LANG = "ko";

  // ✅ 全站文案字典：你后续慢慢加 key 就行
  const DICT = {
    ko: {
      nav_home: "홈",
      nav_hsk: "HSK 학습",
      nav_stroke: "汉字笔순",
      nav_hanja: "한자공부",
      nav_convo: "회화",
      nav_travel: "여행 중국어",
      nav_culture: "문화",
      nav_review: "복습",
      nav_resources: "자료",
      nav_teacher: "교사",
      nav_me: "내 학습",

      home_title: "AI 한자 · 중국어 학습 플랫폼",
      home_line1: "HSK 학습 · 한자 필순 · 한자공부 · 회화 · 여행 중국어 · 문화",
      home_line2: "아이부터 성인까지 사용할 수 있는 종합 중국어 학습 사이트입니다."
    },

    zh: {
      nav_home: "首页",
      nav_hsk: "HSK学习",
      nav_stroke: "汉字笔顺",
      nav_hanja: "韩语汉字学习",
      nav_convo: "会话",
      nav_travel: "旅游中文",
      nav_culture: "文化",
      nav_review: "复习区",
      nav_resources: "资源",
      nav_teacher: "教师专区",
      nav_me: "我的学习",

      home_title: "AI 汉字 · 中文学习平台",
      home_line1: "HSK学习 · 汉字笔顺 · 한자공부 · 会话 · 旅游中文 · 文化",
      home_line2: "适合儿童到成人使用的综合中文学习网站。"
    }
  };

  function getLang() {
    return localStorage.getItem(STORE_KEY) || DEFAULT_LANG;
  }

  function setLang(lang) {
    const v = lang === "zh" ? "zh" : "ko";
    localStorage.setItem(STORE_KEY, v);
    apply(v);
  }

  function t(key, lang = getLang()) {
    return (DICT[lang] && DICT[lang][key]) || (DICT.ko && DICT.ko[key]) || key;
  }

  function apply(lang = getLang()) {
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "ko");

    // ✅ 替换所有标注 data-i18n 的文本
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key, lang);
    });

    // ✅ 给语言按钮高亮（可选）
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.classList.toggle("lang-on", btn.getAttribute("data-lang") === lang);
    });
  }

  // 暴露给全站
  window.I18N = { getLang, setLang, t, apply, DICT };

  // DOM ready 后自动应用
  document.addEventListener("DOMContentLoaded", () => apply(getLang()));
})();
