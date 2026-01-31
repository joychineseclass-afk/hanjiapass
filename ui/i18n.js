// /ui/i18n.js (ES Module) — STABLE++
// - KR/CN
// - localStorage remember
// - apply(): data-i18n + placeholder/title/aria-label
// - t(key, params) supports {x} interpolation
// - setLang/forceLang can auto apply (autoApplyRoot)
// - onChange + on/emit event bus (navBar / router)
// - optional: MutationObserver auto-apply for newly added nodes

const DICT = {
  kr: {
    brand: "Joy Chinese",
    subtitle: "AI 한자 · 중국어 학습 플랫폼",

    nav_home: "홈",
    nav_hsk: "HSK 학습",
    nav_stroke: "한자 필순",
    nav_hanjagongfu: "한자공부",
    nav_speaking: "회화",
    nav_travel: "여행중국어",
    nav_culture: "문화",
    nav_review: "복습",
    nav_resources: "자료",
    nav_teacher: "교사专区",
    nav_my: "내 학습",

    heroTitle: "아이부터 성인까지 사용하는 종합 중국어 학습 사이트입니다.",
    heroDesc: "HSK 학습 · 한자 필순 · 한자공부 · 회화 · 여행중국어 · 문화",

    b1: "HSK 학습",
    b2: "한자 필순",
    b3: "회화",
    b4: "여행중국어",
    b5: "문화",

    footerNote: "차근차근 완성 중: 먼저 구조를 만들고, 콘텐츠를 하나씩 채워갑니다.",

    // ✅ 常用通用文案（以后你慢慢加）
    common_loading: "불러오는 중...",
    common_retry: "다시 시도",
    common_close: "닫기",
     
    // ===== Hanja Page =====
  hanja_title: "한자공부",
  hanja_section_vocab: "📖 자주 쓰는 한자",
  coming_soon_detail: "한자 어휘 학습 콘텐츠가 곧 추가될 예정입니다.",
  hanja_section_compare: "🔄 중한 한자 비교",
  hanja_compare_placeholder: "간체자·번체자·한국 한자 비교 기능이 추가될 예정입니다.",

  },

  cn: {
    brand: "Joy Chinese",
    subtitle: "AI 汉字・中文学习平台",

    nav_home: "首页",
    nav_hsk: "HSK学习",
    nav_stroke: "汉字笔顺",
    nav_hanjagongfu: "汉字功夫",
    nav_speaking: "会话",
    nav_travel: "旅游中文",
    nav_culture: "文化",
    nav_review: "复习区",
    nav_resources: "资源",
    nav_teacher: "教师专区",
    nav_my: "我的学习",

    heroTitle: "适合儿童到成人使用的综合中文学习网站。",
    heroDesc: "HSK学习・汉字笔顺・汉字功夫・会话・旅游中文・文化",

    b1: "HSK 学习",
    b2: "汉字笔顺",
    b3: "会话",
    b4: "旅游中文",
    b5: "文化",

    footerNote: "逐步完善中：先把结构搭好，再把内容一块块补齐。",

    common_loading: "加载中...",
    common_retry: "重试",
    common_close: "关闭",
     
    // ===== Hanja Page =====
  hanja_title: "韩语汉字学习",
  hanja_section_vocab: "📖 常用韩语汉字",
  coming_soon_detail: "汉字词汇学习内容即将上线。",
  hanja_section_compare: "🔄 中韩汉字对比",
  hanja_compare_placeholder: "未来将加入简体、繁体与韩字对照功能。",

  }
};

function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function normalizeLang(lang) {
  return (lang === "cn" || lang === "kr") ? lang : "kr";
}

// {name} 형태 치환
function interpolate(str, params) {
  if (!params) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return (v === 0 || v) ? String(v) : "";
  });
}

class I18N {
  constructor() {
    this._lang = "kr";
    this._storageKey = "joy_lang";

    // onChange subscribers
    this._handlers = new Set();

    // event bus
    this._bus = new Map(); // event -> Set(handlers)

    // auto apply root
    this._autoApplyRoot = null;

    // optional: auto apply new DOM nodes
    this._observer = null;
    this._observeEnabled = false;
  }

  /**
   * @param {Object} opts
   * @param {"kr"|"cn"} [opts.defaultLang="kr"]
   * @param {string} [opts.storageKey="joy_lang"]
   * @param {Document|HTMLElement|null} [opts.autoApplyRoot=null]
   * @param {boolean} [opts.observe=false]  // ✅ 자동 번역(신규 DOM)
   */
  init({ defaultLang = "kr", storageKey = "joy_lang", autoApplyRoot = null, observe = false } = {}) {
    this._storageKey = storageKey || "joy_lang";
    const saved = safeGetLS(this._storageKey);
    this._lang = (saved === "cn" || saved === "kr") ? saved : normalizeLang(defaultLang);

    this._autoApplyRoot = autoApplyRoot;
    this.setObserve(observe);
  }

  // ✅ 翻译（带变量）
  t(key, params) {
    const lang = this._lang;
    const pack = DICT[lang] || DICT.kr;

    // 缺词回退：当前语言 -> kr -> key
    const raw = (pack && key in pack) ? pack[key]
      : (DICT.kr && key in DICT.kr) ? DICT.kr[key]
      : key;

    return interpolate(raw, params);
  }

  getLang() {
    return this._lang;
  }

  // ✅ 切换语言（如果相同就不重复触发）
  setLang(lang, opts = {}) {
    const next = normalizeLang(lang);
    if (next === this._lang) return;

    this._lang = next;
    safeSetLS(this._storageKey, next);

    this._afterLangChange(opts);
  }

  // ✅ 强制切换（无视是否相同）
  forceLang(lang, opts = {}) {
    const next = normalizeLang(lang);
    this._lang = next;
    safeSetLS(this._storageKey, next);

    this._afterLangChange(opts);
  }

  _afterLangChange(opts = {}) {
    const root = ("applyRoot" in opts) ? opts.applyRoot : this._autoApplyRoot;
    if (root) this.apply(root);

    for (const fn of this._handlers) {
      try { fn(this._lang); } catch {}
    }
    this.emit("change", this._lang);
  }

  // ✅ 订阅语言变化
  onChange(fn) {
    this._handlers.add(fn);
    return () => this._handlers.delete(fn);
  }

  /**
   * ✅ 核心：把 data-i18n 写进 DOM
   * 支持：
   * - data-i18n="key" -> textContent
   * - data-i18n-html="key" -> innerHTML（慎用：你自己保证内容安全）
   * - data-i18n-placeholder="key" -> placeholder
   * - data-i18n-title="key" -> title
   * - data-i18n-aria-label="key" -> aria-label
   */
  apply(root = document) {
    const base = root || document;

    // 1) textContent
    base.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = this.t(key);
    });

    // 2) innerHTML (optional)
    base.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = this.t(key);
    });

    // 3) placeholder
    base.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", this.t(key));
    });

    // 4) title
    base.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      el.setAttribute("title", this.t(key));
    });

    // 5) aria-label
    base.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (!key) return;
      el.setAttribute("aria-label", this.t(key));
    });
  }

  // -------- event bus (navBar/router) --------
  on(event, fn) {
    if (!event || typeof fn !== "function") return () => {};
    if (!this._bus.has(event)) this._bus.set(event, new Set());
    this._bus.get(event).add(fn);
    return () => this._bus.get(event)?.delete(fn);
  }

  emit(event, payload) {
    const set = this._bus.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch {}
    }
  }

  // -------- optional: DOM observe --------
  setObserve(on) {
    const enable = !!on;
    this._observeEnabled = enable;

    if (!enable) {
      if (this._observer) {
        try { this._observer.disconnect(); } catch {}
      }
      this._observer = null;
      return;
    }

    // 已经开着就不重复开
    if (this._observer) return;

    const root = (this._autoApplyRoot && this._autoApplyRoot !== document)
      ? this._autoApplyRoot
      : document.body;

    if (!root) return;

    this._observer = new MutationObserver((mutations) => {
      // 只对新增节点局部 apply（性能稳定）
      for (const m of mutations) {
        m.addedNodes?.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          // node 自己或子树里有 data-i18n 的才处理
          if (
            node.matches?.("[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]") ||
            node.querySelector?.("[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]")
          ) {
            this.apply(node);
          }
        });
      }
    });

    try {
      this._observer.observe(root, { childList: true, subtree: true });
    } catch {
      // observe 실패해도 치명적이지 않음
      this._observer = null;
    }
  }
}

export const i18n = new I18N();
