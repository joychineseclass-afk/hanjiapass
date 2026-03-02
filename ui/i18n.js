// /ui/i18n.js (ES Module) — STABLE FULL (compat kr/cn + ko/zh/en)
// ✅ DICT + t() + apply(root) + onChange/eventbus
// ✅ No DOM creation / No MutationObserver (safe for your dynamic layout)
// ✅ Backward compatible with old lang codes (kr/cn) + new (ko/zh/en)
// ✅ Emits standard window events on lang change: joy:lang, languageChanged, i18n:changed

const DICT = {
  // ===== Korean =====
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

    // ===== Stroke =====
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
    common_back: "목록으로",
hsk_tab_words: "단어",
hsk_tab_dialogue: "회화",
hsk_tab_grammar: "문법",
hsk_tab_ai: "AI 학습",
hsk_ai_tip: "오늘 배운 단어/회화를 가지고 AI에게 질문해 보세요.",
hsk_ai_placeholder: "예: ‘你好’랑 ‘您好’ 차이가 뭐예요?",
hsk_ai_send: "보내기",
hsk_ai_copy: "수업내용 복사",
hsk_ai_empty: "질문을 입력해 주세요.",
hsk_ai_prompt_preview: "AI에게 보낼 프롬프트 미리보기",
hsk_ai_next_tip: "다음 단계: AI API 연결(또는 StepRunner 연동)하면 실제 답변이 나오게 됩니다.",
hsk_empty_dialogue: "회화 콘텐츠가 아직 없습니다.",
hsk_empty_grammar: "문법 콘텐츠가 아직 없습니다.",

    hanja_title: "한자공부",
    hanja_section_vocab: "📖 자주 쓰는 한자",
    coming_soon_detail: "한자 어휘 학습 콘텐츠가 곧 추가될 예정입니다.",
    hanja_section_compare: "🔄 중한 한자 비교",
    hanja_compare_placeholder: "간체자·번체자·한국 한자 비교 기능이 추가될 예정입니다.",

    // ===== HSK common (avoid raw keys on HSK page) =====
    hsk_title: "HSK 학습",
    hsk_header: "HSK {lv} · {version}",
    hsk_level: "레벨",
    hsk_tip: "레벨을 선택하고 수업을 시작해요.",
    hsk_search_placeholder: "단어/병음/뜻 검색",
    hsk_loading_lessons: "수업 목록 불러오는 중...",
    hsk_lesson_status: "Lesson {label} ({got}/{total})",
    hsk_back_to_list: "← 목록으로",
    hsk_words_tab: "단어",
    hsk_dialogue_tab: "회화",
    hsk_grammar_tab: "문법",
    hsk_quiz_tab: "퀴즈",
    hsk_ai_tab: "AI 학습",
  },

  // ===== Chinese =====
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

    // ===== Stroke =====
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
    common_back: "返回目录",
hsk_tab_words: "单词",
hsk_tab_dialogue: "会话",
hsk_tab_grammar: "语法",
hsk_tab_ai: "AI学习",
hsk_ai_tip: "用本课单词/会话向AI提问吧。",
hsk_ai_placeholder: "例如：‘你好’和‘您好’有什么区别？",
hsk_ai_send: "发送",
hsk_ai_copy: "复制本课内容",
hsk_ai_empty: "请先输入你的问题。",
hsk_ai_prompt_preview: "发送给AI的提示词预览",
hsk_ai_next_tip: "下一步：接入AI接口（或对接 StepRunner）即可输出真实回答。",
hsk_empty_dialogue: "暂无会话内容。",
hsk_empty_grammar: "暂无语法内容。",

    hanja_title: "韩语汉字学习",
    hanja_section_vocab: "📖 常用韩语汉字",
    coming_soon_detail: "汉字词汇学习内容即将上线。",
    hanja_section_compare: "🔄 中韩汉字对比",
    hanja_compare_placeholder: "未来将加入简体、繁体与韩字对照功能。",

    // ===== HSK common =====
    hsk_title: "HSK 学习",
    hsk_header: "HSK {lv} · {version}",
    hsk_level: "级别",
    hsk_tip: "请选择级别开始学习。",
    hsk_search_placeholder: "搜索：词/拼音/释义",
    hsk_loading_lessons: "正在加载课程…",
    hsk_lesson_status: "第{label}课（{got}/{total}）",
    hsk_back_to_list: "← 返回目录",
    hsk_words_tab: "单词",
    hsk_dialogue_tab: "会话",
    hsk_grammar_tab: "语法",
    hsk_quiz_tab: "练习",
    hsk_ai_tab: "AI 学习",
  },

  // ===== English (optional) =====
  en: {
    brand: "Joy Chinese",
    subtitle: "AI Hanzi · Chinese Learning Platform",

    nav_home: "Home",
    nav_hsk: "HSK",
    nav_stroke: "Stroke Order",
    nav_hanjagongfu: "Hanzi Study",
    nav_speaking: "Speaking",
    nav_travel: "Travel Chinese",
    nav_culture: "Culture",
    nav_review: "Review",
    nav_resources: "Resources",
    nav_teacher: "Teacher",
    nav_my: "My Learning",

    common_loading: "Loading...",
    common_retry: "Retry",
    common_close: "Close",

    hsk_title: "HSK",
    hsk_header: "HSK {lv} · {version}",
    hsk_level: "Level",
    hsk_tip: "Select a level to start.",
    hsk_search_placeholder: "Search word/pinyin/meaning",
    hsk_loading_lessons: "Loading lessons...",
    hsk_lesson_status: "Lesson {label} ({got}/{total})",
    hsk_back_to_list: "← Back to list",
    hsk_words_tab: "Words",
    hsk_dialogue_tab: "Dialogue",
    hsk_grammar_tab: "Grammar",
    hsk_quiz_tab: "Quiz",
    hsk_ai_tab: "AI Learn",
  },
};

// ---------- safe storage ----------
function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

// ---------- normalize lang codes (compat) ----------
// accepts: kr/cn/ko/zh/en, also "zh-cn", "zh-hans", "kr-KR" etc.
function normalizeLang(input, fallback = "ko") {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return fallback;

  // old codes
  if (raw === "kr") return "ko";
  if (raw === "cn") return "zh";

  // common variants
  if (raw === "ko" || raw.startsWith("ko-")) return "ko";
  if (raw === "zh" || raw.startsWith("zh")) return "zh";
  if (raw === "en" || raw.startsWith("en-")) return "en";

  // tolerate your older "site_lang" values
  if (raw === "korean") return "ko";
  if (raw === "chinese") return "zh";

  return fallback;
}

function canonToDictKey(canon) {
  // our DICT keys: kr/cn/en
  if (canon === "ko") return "kr";
  if (canon === "zh") return "cn";
  return canon === "en" ? "en" : "kr";
}

// {name} interpolation
function interpolate(str, params) {
  if (!params) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return (v === 0 || v) ? String(v) : "";
  });
}

class I18N {
  constructor() {
    // canonical: ko|zh|en
    this._lang = "ko";

    // storage
    this._storageKey = "joy_lang";

    // subscribers (legacy)
    this._handlers = new Set();

    // internal event bus
    this._bus = new Map();
  }

  init({ defaultLang = "ko", storageKey = "joy_lang" } = {}) {
    this._storageKey = storageKey || "joy_lang";

    const saved =
      safeGetLS(this._storageKey) ||
      safeGetLS("site_lang") ||
      safeGetLS("lang");

    this._lang = normalizeLang(saved || defaultLang, normalizeLang(defaultLang, "ko"));

    // keep storage consistent
    safeSetLS(this._storageKey, this._lang);
  }

  // canonical getter
  getLang() {
    return this._lang; // ko|zh|en
  }

  // legacy getter (some old code expects kr/cn)
  getLangLegacy() {
    return canonToDictKey(this._lang); // kr|cn|en
  }

  // Accepts kr/cn/ko/zh/en; emits change events
  setLang(lang) {
    const next = normalizeLang(lang, "ko");
    if (next === this._lang) return this._lang;

    this._lang = next;
    safeSetLS(this._storageKey, next);

    // legacy handlers
    for (const fn of this._handlers) {
      try { fn(this._lang); } catch {}
    }

    // internal bus
    this.emit("change", this._lang);

    // global events (pages can listen)
    this._emitWindowEvents(this._lang);

    return this._lang;
  }

  // Force without equality check (rare use)
  forceLang(lang) {
    const next = normalizeLang(lang, "ko");
    this._lang = next;
    safeSetLS(this._storageKey, next);

    for (const fn of this._handlers) {
      try { fn(this._lang); } catch {}
    }
    this.emit("change", this._lang);
    this._emitWindowEvents(this._lang);

    return this._lang;
  }

  t(key, params) {
    const dictKey = canonToDictKey(this._lang); // kr/cn/en
    const pack = DICT[dictKey] || DICT.kr;

    const raw =
      (pack && key in pack) ? pack[key]
      : (DICT.kr && key in DICT.kr) ? DICT.kr[key]
      : (DICT.cn && key in DICT.cn) ? DICT.cn[key]
      : (DICT.en && key in DICT.en) ? DICT.en[key]
      : key;

    return interpolate(raw, params);
  }

  onChange(fn) {
    if (typeof fn !== "function") return () => {};
    this._handlers.add(fn);
    return () => this._handlers.delete(fn);
  }

  // internal event bus
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

  // Apply translations to specific root (or document)
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

  _emitWindowEvents(langCanon) {
    // langCanon is ko|zh|en
    try {
      window.dispatchEvent(new CustomEvent("joy:lang", { detail: { lang: langCanon } }));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang: langCanon } }));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: langCanon } }));
    } catch {}
  }
}

export const i18n = new I18N();

// Optional auto-init if you want (safe):
// i18n.init({ defaultLang: "ko", storageKey: "joy_lang" });
