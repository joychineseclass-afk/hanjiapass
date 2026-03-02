// ui/pages/page.home.js
// ✅ Joy Chinese Home (Landing) — production-ready SPA version
// - Injects CSS once (no need to touch index.html)
// - Uses hash routes (no full page reload)
// - Language toggle integrates with localStorage + optional window.i18n + optional joy:langchanged
// - Compatible exports: default/mount/render

import { i18n } from "../i18n.js";

// Optional: if your router exports navigateTo, we use it for force rerender.
// If not available, we fallback to hash trick.
let _navigateTo = null;
(async () => {
  try {
    const mod = await import("../router.js");
    _navigateTo = mod?.navigateTo || null;
  } catch {}
})();

const STYLE_ID = "joy-home-style-v1";

function ensureHomeStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root{
      --bg: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --card: #ffffff;
      --shadow: 0 10px 30px rgba(2,6,23,.08);
      --brand: #2563eb;
      --brand-2: #1d4ed8;
      --soft: #f8fafc;
      --radius: 18px;
      --max: 1120px;
    }

    *{ box-sizing: border-box; }
    .joy-home{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      background: var(--soft);
      color: var(--text);
    }
    .joy-home a{ color: inherit; text-decoration: none; }
    .joy-home button{ font: inherit; }

    /* Layout */
    .joy-home .wrap{ max-width: var(--max); margin: 0 auto; padding: 0 16px; }

    /* Topbar */
    .joy-home .topbar{
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(255,255,255,.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line);
    }
    .joy-home .topbar__inner{
      display:flex;
      align-items:center;
      justify-content:space-between;
      height: 64px;
      gap: 12px;
    }
    .joy-home .brand{
      display:flex;
      align-items:center;
      gap: 10px;
      min-width: 170px;
    }
    .joy-home .logo{
      width: 34px; height: 34px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--brand), #60a5fa);
      box-shadow: 0 10px 22px rgba(37,99,235,.25);
      flex: 0 0 auto;
    }
    .joy-home .brand__txt{ line-height: 1.05; }
    .joy-home .brand__name{ font-weight: 800; letter-spacing: .2px; }
    .joy-home .brand__sub{ font-size: 12px; color: var(--muted); }

    .joy-home nav{
      display:none;
      gap: 18px;
      align-items:center;
      color: var(--muted);
      font-weight: 600;
      font-size: 14px;
    }
    .joy-home nav a{ padding: 8px 10px; border-radius: 12px; }
    .joy-home nav a:hover{ background: #f1f5f9; color: var(--text); }

    .joy-home .actions{
      display:flex;
      align-items:center;
      gap: 8px;
    }
    .joy-home .btn{
      border: 1px solid var(--line);
      background: #fff;
      color: var(--text);
      padding: 10px 12px;
      border-radius: 14px;
      cursor:pointer;
      transition: .15s ease;
      display:inline-flex;
      align-items:center;
      gap: 8px;
      white-space: nowrap;
    }
    .joy-home .btn:hover{ transform: translateY(-1px); box-shadow: 0 10px 22px rgba(2,6,23,.06); }
    .joy-home .btn--primary{
      border-color: transparent;
      background: var(--brand);
      color: #fff;
    }
    .joy-home .btn--primary:hover{ background: var(--brand-2); }
    .joy-home .btn--ghost{
      background: transparent;
      border-color: transparent;
      color: var(--muted);
    }
    .joy-home .burger{
      width: 42px;
      justify-content:center;
    }

    /* Mobile menu */
    .joy-home .drawer{
      display:none;
      position: fixed;
      inset: 0;
      background: rgba(2,6,23,.35);
      z-index: 100;
    }
    .joy-home .drawer__panel{
      width: min(92vw, 360px);
      height: 100%;
      background: #fff;
      border-right: 1px solid var(--line);
      box-shadow: var(--shadow);
      padding: 16px;
    }
    .joy-home .drawer__head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom: 10px;
    }
    .joy-home .drawer__links{
      display:flex;
      flex-direction:column;
      gap: 6px;
      margin-top: 10px;
    }
    .joy-home .drawer__links a{
      padding: 12px 10px;
      border-radius: 14px;
      color: var(--text);
      font-weight: 700;
    }
    .joy-home .drawer__links a:hover{ background:#f1f5f9; }

    /* Hero */
    .joy-home .hero{
      padding: 28px 0 18px;
    }
    .joy-home .hero__grid{
      display:grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .joy-home .hero__card{
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) + 8px);
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .joy-home .hero__inner{
      padding: 22px;
      display:grid;
      gap: 14px;
    }
    .joy-home .kicker{
      display:inline-flex;
      align-items:center;
      gap: 8px;
      font-weight: 800;
      font-size: 12px;
      color: var(--brand);
      background: rgba(37,99,235,.08);
      padding: 8px 10px;
      border-radius: 999px;
      width: fit-content;
    }
    .joy-home .hero h1{
      margin:0;
      font-size: 28px;
      letter-spacing: -0.6px;
    }
    .joy-home .hero p{
      margin:0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 15px;
    }
    .joy-home .hero__cta{
      display:flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 6px;
    }

    .joy-home .hero__visual{
      min-height: 180px;
      background:
        radial-gradient(900px 250px at 20% 30%, rgba(37,99,235,.22), transparent 55%),
        radial-gradient(700px 240px at 75% 40%, rgba(96,165,250,.25), transparent 55%),
        linear-gradient(180deg, #ffffff, #f8fafc);
      border-top: 1px solid var(--line);
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 18px;
    }
    .joy-home .visual__box{
      width: 100%;
      max-width: 520px;
      border: 1px dashed rgba(71,85,105,.35);
      border-radius: 20px;
      padding: 16px;
      color: var(--muted);
      text-align:center;
      background: rgba(255,255,255,.7);
    }
    .joy-home .visual__box b{ color: var(--text); }

    /* 3 entry cards */
    .joy-home .section{ padding: 10px 0 18px; }
    .joy-home .section__title{
      display:flex;
      align-items: baseline;
      justify-content:space-between;
      gap: 10px;
      margin: 10px 0 10px;
    }
    .joy-home .section__title h2{
      margin:0;
      font-size: 18px;
      letter-spacing:-.3px;
    }
    .joy-home .section__title span{
      color: var(--muted);
      font-size: 13px;
    }

    .joy-home .grid3{
      display:grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .joy-home .card{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 12px 26px rgba(2,6,23,.06);
      padding: 16px;
      display:grid;
      gap: 10px;
    }
    .joy-home .card__top{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 12px;
    }
    .joy-home .badge{
      font-size: 12px;
      font-weight: 800;
      color: var(--brand);
      background: rgba(37,99,235,.08);
      padding: 6px 10px;
      border-radius: 999px;
      width: fit-content;
    }
    .joy-home .card h3{ margin:0; font-size: 16px; letter-spacing:-.2px; }
    .joy-home .card p{ margin:0; color: var(--muted); line-height:1.55; font-size: 14px; }
    .joy-home .card__bottom{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 2px;
    }
    .joy-home .progress{
      flex: 1;
      min-width: 160px;
      height: 10px;
      background: #f1f5f9;
      border-radius: 999px;
      overflow:hidden;
      border: 1px solid var(--line);
    }
    .joy-home .progress > i{
      display:block;
      height:100%;
      width: 45%;
      background: var(--brand);
      border-radius: 999px;
    }

    /* Curriculum ladder */
    .joy-home .ladder{
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) + 8px);
      box-shadow: var(--shadow);
      padding: 16px;
    }
    .joy-home .ladder__row{
      display:flex;
      gap: 10px;
      overflow:auto;
      padding-bottom: 6px;
      -webkit-overflow-scrolling: touch;
    }
    .joy-home .lvl{
      min-width: 148px;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 16px;
      padding: 12px;
      display:grid;
      gap: 8px;
    }
    .joy-home .lvl b{ font-size: 14px; }
    .joy-home .lvl small{ color: var(--muted); }
    .joy-home .ticks{
      display:flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }
    .joy-home .tick{
      font-size: 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 8px;
      color: var(--muted);
      background: #fff;
    }
    .joy-home .tick.on{
      color: #0b3;
      border-color: rgba(0,187,85,.35);
      background: rgba(0,187,85,.06);
      font-weight: 700;
    }

    /* Notice + features */
    .joy-home .two{
      display:grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .joy-home .list{
      display:grid;
      gap: 8px;
      margin-top: 4px;
    }
    .joy-home .li{
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      background: #fff;
      display:flex;
      justify-content:space-between;
      gap: 10px;
    }
    .joy-home .li span{ color: var(--muted); font-size: 13px; }
    .joy-home .li b{ font-size: 14px; }

    /* Footer */
    .joy-home footer{
      margin-top: 24px;
      padding: 22px 0 30px;
      border-top: 1px solid var(--line);
      background: #fff;
    }
    .joy-home .footer__grid{
      display:grid;
      grid-template-columns: 1fr;
      gap: 12px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .joy-home .footer__grid b{ color: var(--text); }

    /* Desktop */
    @media (min-width: 860px){
      .joy-home nav{ display:flex; }
      .joy-home .burger{ display:none; }

      .joy-home .hero__grid{
        grid-template-columns: 1.15fr .85fr;
        align-items: stretch;
      }
      .joy-home .hero__card{ height: 100%; }
      .joy-home .hero__visual{ min-height: 100%; border-top: none; border-left: 1px solid var(--line); }

      .joy-home .grid3{ grid-template-columns: repeat(3, 1fr); }
      .joy-home .two{ grid-template-columns: 1.15fr .85fr; }
      .joy-home .footer__grid{ grid-template-columns: 1.2fr .8fr; }
    }
  `;
  document.head.appendChild(style);
}

function safeSetHash(hash, { force = false } = {}) {
  const h = String(hash || "").trim();
  if (!h) return;

  if (_navigateTo) {
    try {
      _navigateTo(h.startsWith("#") ? h : `#${h}`, { force });
      return;
    } catch {}
  }

  // fallback: hash trick for force rerender
  const target = h.startsWith("#") ? h : `#${h}`;
  if (!force) {
    location.hash = target;
    return;
  }
  const cur = location.hash;
  if (cur === target) {
    location.hash = "#__t";
    setTimeout(() => (location.hash = target), 30);
  } else {
    location.hash = target;
  }
}

function bindOnce(root, selector, event, handler) {
  const el = root.querySelector(selector);
  if (!el) return;
  const key = `__bound_${event}_${selector}`;
  if (el[key]) return;
  el.addEventListener(event, handler);
  el[key] = true;
}

function toggleLangAndRerenderHome() {
  const key = "joy_lang"; // keep consistent with your platform
  const cur = localStorage.getItem(key) || "ko";
  const next = cur === "ko" ? "zh" : "ko";
  localStorage.setItem(key, next);

  // If you have i18n module, apply it globally or emit a custom event:
  try { window.i18n?.setLang?.(next); } catch {}
  try { window.dispatchEvent(new CustomEvent("joy:langchanged", { detail: { lang: next } })); } catch {}

  // Re-render home without full reload
  safeSetHash("#home", { force: true });
}

function openDrawer(root) {
  const drawer = root.querySelector("#drawer");
  if (!drawer) return;
  drawer.style.display = "block";
  drawer.setAttribute("aria-hidden", "false");
}
function closeDrawer(root) {
  const drawer = root.querySelector("#drawer");
  if (!drawer) return;
  drawer.style.display = "none";
  drawer.setAttribute("aria-hidden", "true");
}

function renderHomeInto(root) {
  ensureHomeStyles();

  root.innerHTML = `
  <div class="joy-home">
    <!-- Topbar -->
    <header class="topbar">
      <div class="wrap topbar__inner">
        <a class="brand" href="#home" data-home-link aria-label="Joy Chinese Home">
          <div class="logo" aria-hidden="true"></div>
          <div class="brand__txt">
            <div class="brand__name">Joy Chinese</div>
            <div class="brand__sub">기쁨중국어 · HSK · 회화 · 따라쓰기</div>
          </div>
        </a>

        <nav aria-label="Primary">
          <a href="#home" data-nav="home">홈</a>
          <a href="#hsk" data-nav="learn">시작하기</a>
          <a href="#catalog" data-nav="curriculum">과정/커리큘럼</a>
          <a href="#teacher" data-nav="parent">학부모/선생님</a>
          <a href="#resources" data-nav="notice">공지</a>
          <a href="#my" data-nav="about">소개</a>
        </nav>

        <div class="actions">
          <button class="btn btn--ghost" id="btnLang" type="button" title="Language">
            KR/CN
          </button>
          <button class="btn" id="btnLogin" type="button">로그인</button>
          <button class="btn burger" id="btnMenu" type="button" aria-label="Menu">☰</button>
        </div>
      </div>
    </header>

    <!-- Mobile Drawer -->
    <div class="drawer" id="drawer" aria-hidden="true">
      <div class="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="drawer__head">
          <b>메뉴</b>
          <button class="btn" id="btnClose" type="button">닫기</button>
        </div>
        <div class="drawer__links">
          <a href="#home">홈</a>
          <a href="#hsk">시작하기</a>
          <a href="#catalog">과정/커리큘럼</a>
          <a href="#teacher">학부모/선생님</a>
          <a href="#resources">공지</a>
          <a href="#my">소개</a>
        </div>
        <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn" type="button" id="btnLang2">KR/CN</button>
          <button class="btn" type="button" id="btnLogin2">로그인</button>
        </div>
        <p style="margin-top:12px; color: var(--muted); font-size:12px;">
          학습은 <b>#hsk</b>, 커리큘럼 조회는 <b>#catalog</b>에서 할 수 있어요.
        </p>
      </div>
    </div>

    <!-- Hero -->
    <main>
      <section class="hero">
        <div class="wrap hero__grid">
          <div class="hero__card">
            <div class="hero__inner">
              <div class="kicker">✨ 오늘도 한 걸음</div>
              <h1>오늘은 3분만, 중국어 해볼까요?</h1>
              <p>
                아이는 즐겁게 배우고, 부모님과 선생님은 커리큘럼을 쉽게 찾을 수 있는
                <b>학습 플랫폼</b>입니다.
              </p>
              <div class="hero__cta">
                <a class="btn btn--primary" href="#hsk">시작 학습</a>
                <a class="btn" href="#catalog">커리큘럼 보기</a>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
                <span class="badge">HSK 2.0/3.0</span>
                <span class="badge">중·한·병음</span>
                <span class="badge">따라쓰기</span>
                <span class="badge">AI 말하기</span>
              </div>
            </div>
          </div>

          <div class="hero__card">
            <div class="hero__visual">
              <div class="visual__box">
                <div style="font-size:14px; margin-bottom:6px;">(여기에 메인 일러스트/캐릭터)</div>
                <div style="font-size:12px;">
                  예: <b>판다 + 책</b> / “오늘의 미션” 이미지<br/>
                  ※ 나중에 이미지 넣어도 레이아웃이 무너지지 않게 설계됨
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3 entry cards -->
      <section class="section">
        <div class="wrap">
          <div class="section__title">
            <h2>빠른 시작</h2>
            <span>아이/학부모/선생님 모두 편하게</span>
          </div>

          <div class="grid3">
            <!-- Today -->
            <article class="card">
              <div class="card__top">
                <div>
                  <div class="badge">아이용</div>
                  <h3>오늘의 학습</h3>
                </div>
                <a class="btn btn--primary" href="#hsk">바로가기</a>
              </div>
              <p>마지막으로 하던 수업을 이어서, 짧게라도 꾸준히!</p>
              <div class="card__bottom">
                <div class="progress" aria-label="progress"><i></i></div>
                <span style="color:var(--muted); font-size:13px;">이번 주 3/7 완료</span>
              </div>
            </article>

            <!-- Catalog -->
            <article class="card">
              <div class="card__top">
                <div>
                  <div class="badge">학부모/선생님</div>
                  <h3>课程目录（可查找）</h3>
                </div>
                <a class="btn" href="#catalog">查看</a>
              </div>
              <p>按级别/主题/技能筛选与搜索，快速找到需要的学习内容。</p>
              <div class="card__bottom">
                <span class="tick on">搜索</span>
                <span class="tick on">筛选</span>
                <span class="tick on">排序</span>
              </div>
            </article>

            <!-- Parent -->
            <article class="card">
              <div class="card__top">
                <div>
                  <div class="badge">관리</div>
                  <h3>家长/老师专区</h3>
                </div>
                <a class="btn" href="#teacher">进入</a>
              </div>
              <p>学习进度、作业建议、预约与通知，在这里集中查看。</p>
              <div class="card__bottom">
                <span class="tick on">进度报告</span>
                <span class="tick on">作业</span>
                <span class="tick">预约</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- Curriculum ladder -->
      <section class="section">
        <div class="wrap">
          <div class="section__title">
            <h2>课程体系（HSK 路径）</h2>
            <span>系统化、可追踪、可查找</span>
          </div>

          <div class="ladder">
            <div class="ladder__row" aria-label="HSK Ladder">
              <div class="lvl">
                <b>HSK 1</b>
                <small>基础入门</small>
                <div class="ticks">
                  <span class="tick on">词汇</span>
                  <span class="tick on">会话</span>
                  <span class="tick on">描红</span>
                  <span class="tick on">测验</span>
                </div>
              </div>
              <div class="lvl">
                <b>HSK 2</b>
                <small>日常表达</small>
                <div class="ticks">
                  <span class="tick on">词汇</span>
                  <span class="tick on">会话</span>
                  <span class="tick on">描红</span>
                  <span class="tick">测验</span>
                </div>
              </div>
              <div class="lvl">
                <b>HSK 3</b>
                <small>扩展主题</small>
                <div class="ticks">
                  <span class="tick on">词汇</span>
                  <span class="tick on">会话</span>
                  <span class="tick">描红</span>
                  <span class="tick">测验</span>
                </div>
              </div>
              <div class="lvl">
                <b>HSK 4</b>
                <small>进阶</small>
                <div class="ticks">
                  <span class="tick">词汇</span>
                  <span class="tick">会话</span>
                  <span class="tick">描红</span>
                  <span class="tick">测验</span>
                </div>
              </div>
              <div class="lvl">
                <b>HSK 5+</b>
                <small>高阶（规划中）</small>
                <div class="ticks">
                  <span class="tick">词汇</span>
                  <span class="tick">会话</span>
                  <span class="tick">描红</span>
                  <span class="tick">测验</span>
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:10px;">
              <p style="margin:0; color:var(--muted); font-size:13px;">
                ✔ 커리큘럼은 학부모/선생님이 쉽게 찾을 수 있도록 “목차형”으로 제공합니다.
              </p>
              <a class="btn" href="#catalog">课程目录（搜索/筛选）</a>
            </div>
          </div>
        </div>
      </section>

      <!-- Notice + Features -->
      <section class="section">
        <div class="wrap two">
          <div class="card">
            <div class="card__top">
              <div>
                <div class="badge">공지/업데이트</div>
                <h3>最近更新</h3>
              </div>
              <a class="btn" href="#resources">更多</a>
            </div>
            <div class="list">
              <div class="li">
                <b>新增：HSK1 第1课「打招呼」</b>
                <span>2026-03-03</span>
              </div>
              <div class="li">
                <b>优化：课程目录支持语言同步</b>
                <span>2026-03-02</span>
              </div>
              <div class="li">
                <b>预告：描红“写对发光/太棒了”</b>
                <span>规划中</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__top">
              <div>
                <div class="badge">为什么适合孩子</div>
                <h3>学习体验</h3>
              </div>
            </div>
            <p>每节课按“词汇 → 会话 → 描红 → 测验”闯关式完成，孩子更有成就感。</p>
            <div class="list">
              <div class="li"><b>AI 口语陪练</b><span>开口更自然</span></div>
              <div class="li"><b>中韩对照 + 拼音</b><span>家长也能陪学</span></div>
              <div class="li"><b>学习报告</b><span>老师可追踪</span></div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div class="wrap footer__grid">
        <div>
          <b>Joy Chinese · 기쁨중국어</b><br/>
          아이도 즐겁고, 학부모/선생님도 찾기 쉬운 중국어 학습 플랫폼
        </div>
        <div>
          문의: 010-0000-0000<br/>
          이메일: hello@joychinese.kr<br/>
          <a href="#my" style="text-decoration:underline;">개인정보처리방침</a>
          ·
          <a href="#my" style="text-decoration:underline;">이용약관</a><br/>
          © 2026 Joy Chinese
        </div>
      </div>
    </footer>
  </div>
  `;

  // ===== Bind UI (production-safe; no inline <script>) =====

  // Drawer
  bindOnce(root, "#btnMenu", "click", () => openDrawer(root));
  bindOnce(root, "#btnClose", "click", () => closeDrawer(root));
  // click outside panel closes
  bindOnce(root, "#drawer", "click", (e) => {
    const drawer = root.querySelector("#drawer");
    if (e.target === drawer) closeDrawer(root);
  });

  // Language toggle (no reload)
  bindOnce(root, "#btnLang", "click", () => toggleLangAndRerenderHome());
  bindOnce(root, "#btnLang2", "click", () => toggleLangAndRerenderHome());

  // Login placeholder -> route to #my (or create #login route later)
  const goLogin = () => safeSetHash("#my", { force: false });
  bindOnce(root, "#btnLogin", "click", goLogin);
  bindOnce(root, "#btnLogin2", "click", goLogin);

  // Make brand always go home with force rerender
  const brand = root.querySelector("[data-home-link]");
  if (brand && !brand.__bound_home) {
    brand.addEventListener("click", (e) => {
      e.preventDefault();
      safeSetHash("#home", { force: true });
    });
    brand.__bound_home = true;
  }

  // Apply i18n if you have any data-i18n nodes (kept)
  try { i18n.apply(root); } catch {}
}

/** ✅ Router compatibility: module.default(ctx) */
export default function pageHome(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");

  if (!root) {
    console.warn("[page.home] #app not found");
    return;
  }

  renderHomeInto(root);
}

/** ✅ Router compatibility: module.mount(ctx) */
export function mount(ctxOrRoot) {
  return pageHome(ctxOrRoot);
}

/** ✅ Router compatibility: module.render(ctx) */
export function render(ctxOrRoot) {
  return pageHome(ctxOrRoot);
}
