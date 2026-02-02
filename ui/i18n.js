// /ui/i18n.js (ES Module) — STABLE (recommended)
// ✅ 只负责：DICT + t() + apply(root) + onChange/eventbus
// ✅ 默认不 observe（避免你页面结构变化时重复/乱套）
// ✅ 不会生成任何 DOM（所以不会造成重复标题栏）

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

    // ===== Stroke (笔顺页面) =====
    stroke_title: "한자 필순 연습",
    stroke_desc: "한 글자를 입력하면 필순 애니메이션과 따라쓰기 연습을 할 수 있어요.",
    stroke_input_label: "한자 입력",
    stroke_input_ph: "예: 你 / 学 / 人",
    stroke_load_btn: "불러오기",

    stroke_player_title: "필순 보기",
    stroke_meaning_title: "단어 뜻 (HSK)",
    stroke_meaning_hint: "HSK 단어장에서 뜻, 병음, 예문을 보여줘요.",
    stroke_not_found: "정보를 찾지 못했어요.",
    stroke_loading: "불러오는 중…",

    stroke_btn_speak: "발음",
    stroke_btn_replay: "다시",
    stroke_btn_reset: "초기화",
    stroke_btn_trace: "묘홍",

    heroTitle: "아이부터 성인까지 사용하는 종합 중국어 학습 사이트입니다.",
    heroDesc: "HSK 학습 · 한자 필순 · 한자공부 · 회화 · 여행중국어 · 문화",

    b1: "HSK 학습",
    b2: "한자 필순",
    b3: "회화",
    b4: "여행중국어",
    b5: "문화",

    footerNote: "차근차근 완성 중: 먼저 구조를 만들고, 콘텐츠를 하나씩 채워갑니다.",

    common_loading: "불러오는 중...",
    common_retry: "다시 시도",
    common_close: "닫기",

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

    stroke_title: "汉字笔顺练习",
    stroke_desc: "输入一个汉字，即可观看笔顺动画并进行描红练习。",
    stroke_input_label: "输入汉字",
    stroke_input_ph: "例如：你 / 学 / 人",
    stroke_load_btn: "加载",

    stroke_player_title: "笔顺演示",
    stroke_meaning_title: "词汇释义（HSK）",
    stroke_meaning_hint: "从HSK词库中显示拼音、韩语、例句等信息。",
    stroke_not_found: "未找到相关信息。",
    stroke_loading: "加载中…",

    stroke_btn_speak: "读音",
    stroke_btn_replay: "重播",
    stroke_btn_reset: "复位",
    stroke_btn_trace: "描红",

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

// {name} 치환
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

    // event bus (navBar/router)
    this._bus = new Map();
  }

  init({ defaultLang = "kr", storageKey = "joy_lang" } = {}) {
    this._storageKey = storageKey || "joy_lang";
    const saved = safeGetLS(this._storageKey);
    this._lang = (saved === "cn" || saved === "kr") ? saved : normalizeLang(defaultLang);
  }

  t(key, params) {
    const pack = DICT[this._lang] || DICT.kr;

    const raw =
      (pack && key in pack) ? pack[key]
      : (DICT.kr && key in DICT.kr) ? DICT.kr[key]
      : key;

    return interpolate(raw, params);
  }

  getLang() {
    return this._lang;
  }

  setLang(lang) {
    const next = normalizeLang(lang);
    if (next === this._lang) return;

    this._lang = next;
    safeSetLS(this._storageKey, next);

    for (const fn of this._handlers) {
      try { fn(this._lang); } catch {}
    }
    this.emit("change", this._lang);
  }

  forceLang(lang) {
    const next = normalizeLang(lang);
    this._lang = next;
    safeSetLS(this._storageKey, next);

    for (const fn of this._handlers) {
      try { fn(this._lang); } catch {}
    }
    this.emit("change", this._lang);
  }

  onChange(fn) {
    this._handlers.add(fn);
    return () => this._handlers.delete(fn);
  }

  // ✅ 只负责把 data-i18n 写进“指定 root”
  apply(root) {
    const base = root || document;

    base.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = this.t(key);
    });

    base.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = this.t(key);
    });

    base.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", this.t(key));
    });

    base.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      el.setAttribute("title", this.t(key));
    });

    base.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (!key) return;
      el.setAttribute("aria-label", this.t(key));
    });
  }

  // event bus
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
}

export const i18n = new I18N();
