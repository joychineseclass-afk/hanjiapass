// ui/modules/hsk/hskHistory.js (ultimate, ESM, low rework)
// 역할:
// - HSK 상태(레벨/검색/레슨 선택 등)를 URL + localStorage로 동기화
// - 새로고침/공유 링크/뒤로가기에도 상태 복원
//
// 사용 예:
// const hist = createHSKHistory({ baseKey: "hsk" });
// const state = hist.getInitialState();
// hist.bind({
//   getState: () => ({ lv, q, lesson }),
//   applyState: (s) => { setLV(s.lv); setQ(s.q); setLesson(s.lesson); },
// });
// hist.commit({ lv, q, lesson }); // 상태 저장 + URL 업데이트

function safeText(v) {
  return String(v ?? "").trim();
}

function toInt(v, fallback = null) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// ---- storage (safe) ----
function canUseStorage() {
  try {
    const k = "__t__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readStorage(key) {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ---- url helpers ----
function parseQuery() {
  const sp = new URLSearchParams(location.search);
  const obj = {};
  for (const [k, v] of sp.entries()) obj[k] = v;
  return obj;
}

function buildQuery(state, allowedKeys) {
  const sp = new URLSearchParams();

  (allowedKeys || Object.keys(state || {})).forEach((k) => {
    const v = state?.[k];
    if (v == null) return;
    const t = safeText(v);
    if (!t) return;
    sp.set(k, t);
  });

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function sameState(a, b) {
  const ka = Object.keys(a || {}).sort();
  const kb = Object.keys(b || {}).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    const k = ka[i];
    if (safeText(a[k]) !== safeText(b[k])) return false;
  }
  return true;
}

/**
 * ✅ createHSKHistory
 * options:
 * - baseKey: storage key prefix (default: "hsk")
 * - defaults: { lv:"1", q:"", lesson:"" }
 * - allowed: query keys list (default: ["lv","q","lesson"])
 * - maxQueryLen: 防止太长 (default: 120)
 */
export function createHSKHistory(options = {}) {
  const baseKey = safeText(options.baseKey || "hsk");
  const storeKey = `${baseKey}:state`;
  const allowed = options.allowed || ["lv", "q", "lesson"];
  const maxQueryLen = options.maxQueryLen ?? 120;

  const defaults = {
    lv: safeText(options?.defaults?.lv || "1"),
    q: safeText(options?.defaults?.q || ""),
    lesson: safeText(options?.defaults?.lesson || ""), // 可为空
  };

  let _bound = false;
  let _getState = null;
  let _applyState = null;

  function normalize(input) {
    const out = { ...defaults };

    // lv: 1~9
    const lvRaw = input?.lv ?? input?.level;
    const lvNum = clamp(toInt(lvRaw, 1), 1, 9);
    out.lv = String(lvNum);

    // q: string, limited
    const q = safeText(input?.q ?? input?.query ?? input?.search ?? "");
    out.q = q.slice(0, maxQueryLen);

    // lesson: allow number or string, keep short
    const lessonRaw = input?.lesson ?? input?.ls ?? "";
    const lessonTxt = safeText(lessonRaw);
    // 允许 ""，允许数字/短字符串（例如 "2" 或 "A-1"）
    out.lesson = lessonTxt.slice(0, 32);

    return out;
  }

  function getInitialState() {
    const qs = parseQuery();         // URL 优先
    const saved = readStorage(storeKey); // 其次 localStorage
    const merged = { ...defaults, ...(saved || {}), ...(qs || {}) };
    return normalize(merged);
  }

  function commit(nextState, mode = "replace") {
    const s = normalize(nextState);

    // 1) storage
    writeStorage(storeKey, s);

    // 2) url (only allowed keys)
    const q = buildQuery(
      {
        lv: s.lv,
        q: s.q,
        lesson: s.lesson || "", // 空就不写
      },
      allowed
    );

    const newUrl = `${location.pathname}${q}${location.hash || ""}`;
    if (mode === "push") history.pushState({ [baseKey]: s }, "", newUrl);
    else history.replaceState({ [baseKey]: s }, "", newUrl);

    return s;
  }

  /**
   * ✅ bind:
   * - getState: () => ({lv,q,lesson})
   * - applyState: (state) => void
   * 绑定后会监听 popstate 事件（前进后退）
   */
  function bind({ getState, applyState } = {}) {
    if (_bound) return;
    _bound = true;

    _getState = typeof getState === "function" ? getState : null;
    _applyState = typeof applyState === "function" ? applyState : null;

    // 初始化：把 URL/Storage 的 state 应用到 UI（由外部调用更安全）
    // 这里不自动 apply，避免 DOM 未就绪。你在 initHSKUI 里手动用 getInitialState() apply 即可。

    window.addEventListener("popstate", () => {
      // 用户点击 后退/前进：从 URL 读
      const s = getInitialState();
      if (_applyState) _applyState(s);
      // 同步保存（replace）
      commit(s, "replace");
    });
  }

  function unbind() {
    // 简化：一般不会解绑；需要的话你可以扩展
    _bound = false;
    _getState = null;
    _applyState = null;
  }

  /**
   * ✅ syncFromUI:
   * 从 UI 读取状态 -> commit 到 URL/storage
   * 常用于：level change / search input change / lesson click
   */
  function syncFromUI(mode = "replace") {
    if (!_getState) return null;
    const s = normalize(_getState());
    return commit(s, mode);
  }

  return {
    defaults,
    normalize,
    getInitialState,
    commit,
    bind,
    unbind,
    syncFromUI,
  };
}

// ==== Global bridge (for legacy code) ====
try {
  const g = (window.HSK_HISTORY = window.HSK_HISTORY || {});

  // ✅ 不要引用 list/clear/add 这种可能不存在的变量
  // ✅ 给出安全兜底，保证页面不崩
  g.list = typeof g.list === "function" ? g.list : (() => []);
  g.clear = typeof g.clear === "function" ? g.clear : (() => {});
  g.add = typeof g.add === "function" ? g.add : (() => {});
} catch (e) {}
