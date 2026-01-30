// ui/i18n.js (ultimate, stable)
(function () {
  const STORE_KEY = "site_lang"; // "ko" | "zh"
  const DEFAULT_LANG = "ko";

  // ✅ 全站文案字典：持续往里加 key 就行
  // 规则：页面上写 data-i18n="xxx" -> 여기에서 xxx 키로 번역
  const DICT = {
    ko: {
      // ===== nav =====
      nav_home: "홈",
      nav_hsk: "HSK 학습",
      nav_stroke: "한자 필순",
      nav_hanja: "한자공부",
      nav_convo: "회화",
      nav_travel: "여행 중국어",
      nav_culture: "문화",
      nav_review: "복습",
      nav_resources: "자료",
      nav_teacher: "교사",
      nav_me: "내 학습",

      // ===== home =====
      home_title: "AI 한자 · 중국어 학습 플랫폼",
      home_line1: "HSK 학습 · 한자 필순 · 한자공부 · 회화 · 여행 중국어 · 문화",
      home_line2: "아이부터 성인까지 사용할 수 있는 종합 중국어 학습 사이트입니다.",

      // ✅ Home cards (首页九宫格卡片)
      card_hsk: "HSK 학습",
      card_stroke: "한자 필순",
      card_hanja: "한자공부",
      card_convo: "회화",
      card_travel: "여행 중국어",
      card_culture: "문화",
      card_review: "복습",
      card_resources: "자료",
      card_teacher: "교사",
      card_me: "내 학습",

      // ===== common =====
      lang_ko: "KR",
      lang_zh: "CN",
    },

    zh: {
      // ===== nav =====
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

      // ===== home =====
      home_title: "AI 汉字 · 中文学习平台",
      home_line1: "HSK学习 · 汉字笔顺 · 한자공부 · 会话 · 旅游中文 · 文化",
      home_line2: "适合儿童到成人使用的综合中文学习网站。",

      // ✅ Home cards
      card_hsk: "HSK学习",
      card_stroke: "汉字笔顺",
      card_hanja: "한자공부",
      card_convo: "会话",
      card_travel: "旅游中文",
      card_culture: "文化",
      card_review: "复习区",
      card_resources: "资源",
      card_teacher: "教师专区",
      card_me: "我的学习",

      // ===== common =====
      lang_ko: "KR",
      lang_zh: "CN",
    }
  };

  // ---------- helpers ----------
  function safeText(x) {
    return String(x ?? "").trim();
  }

  function normalizeLang(lang) {
    const v = safeText(lang).toLowerCase();
    return v === "zh" ? "zh" : "ko";
  }

  function getLang() {
    // ✅ URL 优先：?lang=zh
    try {
      const urlLang = new URLSearchParams(location.search).get("lang");
      if (urlLang) return normalizeLang(urlLang);
    } catch {}

    // ✅ localStorage
    try {
      return normalizeLang(localStorage.getItem(STORE_KEY) || DEFAULT_LANG);
    } catch {
      return DEFAULT_LANG;
    }
  }

  function setLang(lang) {
    const v = normalizeLang(lang);
    try { localStorage.setItem(STORE_KEY, v); } catch {}
    apply(v);
  }

  function t(key, lang = getLang()) {
    const k = safeText(key);
    if (!k) return "";
    return (DICT[lang] && DICT[lang][k]) || (DICT.ko && DICT.ko[k]) || k;
  }

  // ✅ 核心：把页面上所有 data-i18n 的元素替换掉
  function apply(lang = getLang()) {
    const L = normalizeLang(lang);

    // <html lang="ko"> / <html lang="zh-CN">
    document.documentElement.setAttribute("lang", L === "zh" ? "zh-CN" : "ko");

    // 1) 普通文本：data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key, L);
    });

    // 2) placeholder：data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key, L));
    });

    // 3) innerHTML：data-i18n-html（需要时才用，默认不用）
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = t(key, L);
    });

    // 4) 语言按钮高亮 + 文案
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      const bLang = normalizeLang(btn.getAttribute("data-lang"));
      btn.classList.toggle("lang-on", bLang === L);

      // 如果按钮上也写了 data-i18n，就会自动变；这里额外兜底
      // 例如：<button data-lang="ko" data-i18n="lang_ko"></button>
      const key = btn.getAttribute("data-i18n");
      if (key) btn.textContent = t(key, L);
    });

    // 5) 给 body 打标（方便 CSS）
    document.body?.setAttribute("data-lang", L);
  }

  // ✅ 自动绑定语言按钮点击（你只要写 data-lang="ko/zh" 就行）
  function bindLangButtons() {
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      if (btn.__langBound) return;
      btn.__langBound = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLang(btn.getAttribute("data-lang"));
      });
    });
  }

  // ✅ 暴露给全站
  window.I18N = { getLang, setLang, t, apply, DICT };

  // DOM ready：先绑按钮，再应用
  document.addEventListener("DOMContentLoaded", () => {
    bindLangButtons();
    apply(getLang());
  });
})();
