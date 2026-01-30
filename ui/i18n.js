// ui/i18n.js (ES Module)
// - 支持 KR/CN
// - localStorage 记住语言
// - apply() 自动替换 data-i18n 文案
// - onChange 订阅语言变化
// - on/emit 简单事件总线（给 navBar 用于 route 更新）
// ✅ 改进：setLang 后可自动 apply，避免“切换了但页面不变”

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

    footerNote: "차근차근 완성 중: 먼저 구조를 만들고, 콘텐츠를 하나씩 채워갑니다."
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

    footerNote: "逐步完善中：先把结构搭好，再把内容一块块补齐。"
  }
};

function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

class I18N {
  constructor() {
    this._lang = "kr";
    this._storageKey = "joy_lang";
    this._handlers = new Set();
    this._bus = new Map(); // event -> Set(handlers)

    // ✅ 新增：切语言后自动 apply 的目标范围
    this._autoApplyRoot = null; // null 表示不自动 apply（兼容旧行为）
  }

  /**
   * @param {Object} opts
   * @param {"kr"|"cn"} [opts.defaultLang="kr"]
   * @param {string} [opts.storageKey="joy_lang"]
   * @param {Document|HTMLElement|null} [opts.autoApplyRoot=null]
   *        - 传 document：setLang 后自动刷新整页
   *        - 传某个元素：只刷新该元素内的 data-i18n
   *        - null：不自动刷新（保持旧行为）
   */
  init({ defaultLang = "kr", storageKey = "joy_lang", autoApplyRoot = null } = {}) {
    this._storageKey = storageKey || "joy_lang";
    const saved = safeGetLS(this._storageKey);
    this._lang = (saved === "cn" || saved === "kr") ? saved : defaultLang;

    this._autoApplyRoot = autoApplyRoot; // ✅ 记住自动刷新范围
  }

  t(key) {
    const pack = DICT[this._lang] || DICT.kr;
    return pack[key] ?? key;
  }

  getLang() {
    return this._lang;
  }

  /**
   * ✅ setLang：切换语言
   * @param {"kr"|"cn"} lang
   * @param {Object} [opts]
   * @param {Document|HTMLElement|null} [opts.applyRoot]
   *        - 优先使用 opts.applyRoot
   *        - 否则使用 init 的 autoApplyRoot
   *        - 都没有则不自动 apply
   */
  setLang(lang, opts = {}) {
    const next = (lang === "cn" || lang === "kr") ? lang : "kr";
    if (next === this._lang) return;

    this._lang = next;
    safeSetLS(this._storageKey, next);

    // ✅ 自动刷新：避免“切换了但页面没变”
    const root = (opts && "applyRoot" in opts) ? opts.applyRoot : this._autoApplyRoot;
    if (root) this.apply(root);

    // 通知订阅者
    for (const fn of this._handlers) fn(next);
    // 也广播一个 change 事件
    this.emit("change", next);
  }

  /**
   * ✅ forceLang：强制设置语言（无视当前是否相同）
   * 用于“每次打开都默认韩语”这种需求
   */
  forceLang(lang, opts = {}) {
    const next = (lang === "cn" || lang === "kr") ? lang : "kr";
    this._lang = next;
    safeSetLS(this._storageKey, next);

    const root = (opts && "applyRoot" in opts) ? opts.applyRoot : this._autoApplyRoot;
    if (root) this.apply(root);

    for (const fn of this._handlers) fn(next);
    this.emit("change", next);
  }

  onChange(fn) {
    this._handlers.add(fn);
    return () => this._handlers.delete(fn);
  }

  apply(root = document) {
    const base = root || document;
    const nodes = base.querySelectorAll("[data-i18n]");
    nodes.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = this.t(key);
    });
  }

  // 简单事件总线（给 navBar 监听 hashchange / route 更新用）
  on(event, fn) {
    if (!this._bus.has(event)) this._bus.set(event, new Set());
    this._bus.get(event).add(fn);
    return () => this._bus.get(event)?.delete(fn);
  }

  emit(event, payload) {
    const set = this._bus.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
}

export const i18n = new I18N();
