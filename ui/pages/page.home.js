// ui/pages/page.home.js
// ✅ Home page content only (NO extra topbar) — uses global navbar
// ✅ Fully language-consistent (ko/zh)
// ✅ Removed HSK ladder section (move to HSK page)
// ✅ "교사专区" -> "학부모/선생님"
// ✅ Site name: 中文学习中心

import { i18n } from "../i18n.js";

const STYLE_ID = "joy-home-style-v2";

function getLang() {
  // your project uses joy_lang; normalize to 'ko' | 'zh'
  const v = (localStorage.getItem("joy_lang") || "ko").toLowerCase();
  if (v.startsWith("zh") || v === "cn") return "zh";
  return "ko";
}

const TEXT = {
  ko: {
    kicker: "✨ 오늘도 한 걸음",
    h1: "오늘은 3분만, 중국어 해볼까요?",
    p1: "아이는 즐겁게 배우고, 부모님과 선생님은 커리큘럼을 쉽게 찾을 수 있는",
    p1b: "학습 플랫폼",
    cta1: "시작 학습",
    cta2: "커리큘럼 보기",
    tags: ["HSK 2.0/3.0", "중·한·병음", "따라쓰기", "AI 말하기"],
    visualTitle: "(여기에 메인 일러스트/캐릭터)",
    visualDesc1: '예: "판다 + 책" / “오늘의 미션” 이미지',
    visualDesc2: "※ 나중에 이미지 넣어도 레이아웃이 무너지지 않게 설계됨",

    quickTitle: "빠른 시작",
    quickSub: "아이/학부모/선생님 모두 편하게",

    card1Badge: "아이용",
    card1Title: "오늘의 학습",
    card1Desc: "마지막으로 하던 수업을 이어서, 짧게라도 꾸준히!",
    card1Btn: "바로가기",
    card1Meta: "이번 주 3/7 완료",

    card2Badge: "학부모/선생님",
    card2Title: "课程目录（可查找）", // (원문 유지)
    card2Desc: "按级别/主题/技能筛选与搜索，快速找到需要的学习内容。",
    card2Btn: "查看",
    card2Chips: ["搜索", "筛选", "排序"],

    card3Badge: "관리",
    card3Title: "학부모/선생님",
    card3Desc: "学习进度、作业建议、预约与通知，在这里集中查看。",
    card3Btn: "进入",
    card3Chips: ["进度报告", "作业", "预约"],

    twoLeftBadge: "공지/업데이트",
    twoLeftTitle: "最近更新",
    more: "更多",

    upd1: "新增：HSK1 第1课「打招呼」",
    upd2: "优化：课程目录支持语言同步",
    upd3: "预告：描红“写对发光/太棒了”",

    twoRightBadge: "为什么适合孩子",
    twoRightTitle: "学习体验",
    twoRightDesc: "每节课按“词汇 → 会话 → 描红 → 测验”闯关式完成，孩子更有成就感。",
    feat1: "AI 口语陪练",
    feat1s: "开口更自然",
    feat2: "中韩对照 + 拼音",
    feat2s: "家长也能陪学",
    feat3: "学习报告",
    feat3s: "老师可追踪",

    footerBrand: "中文学习中心",
    footerLine: "아이도 즐겁고, 학부모/선생님도 찾기 쉬운 중국어 학습 플랫폼",
    contact: "문의",
    email: "이메일",
    privacy: "개인정보처리방침",
    terms: "이용약관",
    copy: "© 2026 中文学习中心",
  },

  zh: {
    kicker: "✨ 今天也前进一步",
    h1: "今天只要3分钟，要不要学点中文？",
    p1: "孩子学得开心，家长和老师也能轻松找到课程内容的",
    p1b: "中文学习平台",
    cta1: "开始学习",
    cta2: "查看课程目录",
    tags: ["HSK 2.0/3.0", "中·韩·拼音", "描红", "AI口语"],

    visualTitle: "(这里放主视觉/角色插画)",
    visualDesc1: "例如：熊猫+书 / “今日任务”图片",
    visualDesc2: "※ 以后加图也不会破坏版式",

    quickTitle: "快速开始",
    quickSub: "孩子 / 家长 / 老师都好用",

    card1Badge: "给孩子",
    card1Title: "今天的学习",
    card1Desc: "继续上次的课程，短短几分钟也能坚持！",
    card1Btn: "立即进入",
    card1Meta: "本周完成 3/7",

    card2Badge: "家长/老师",
    card2Title: "课程目录（可查找）",
    card2Desc: "按级别/主题/技能筛选与搜索，快速找到需要的学习内容。",
    card2Btn: "查看",
    card2Chips: ["搜索", "筛选", "排序"],

    card3Badge: "管理",
    card3Title: "家长/老师专区",
    card3Desc: "学习进度、作业建议、预约与通知，在这里集中查看。",
    card3Btn: "进入",
    card3Chips: ["进度报告", "作业", "预约"],

    twoLeftBadge: "公告/更新",
    twoLeftTitle: "最近更新",
    more: "更多",

    upd1: "新增：HSK1 第1课「打招呼」",
    upd2: "优化：课程目录支持语言同步",
    upd3: "预告：描红“写对发光/太棒了”",

    twoRightBadge: "为什么适合孩子",
    twoRightTitle: "学习体验",
    twoRightDesc: "每节课按“词汇 → 会话 → 描红 → 测验”闯关式完成，孩子更有成就感。",
    feat1: "AI 口语陪练",
    feat1s: "开口更自然",
    feat2: "中韩对照 + 拼音",
    feat2s: "家长也能陪学",
    feat3: "学习报告",
    feat3s: "老师可追踪",

    footerBrand: "中文学习中心",
    footerLine: "孩子学得开心，家长/老师也更容易找到课程内容的中文学习平台",
    contact: "联系方式",
    email: "邮箱",
    privacy: "隐私政策",
    terms: "使用条款",
    copy: "© 2026 中文学习中心",
  },
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root{
      --bg:#fff;--text:#0f172a;--muted:#475569;--line:#e2e8f0;--card:#fff;
      --shadow:0 10px 30px rgba(2,6,23,.08);
      --brand:#2563eb;--brand-2:#1d4ed8;--soft:#f8fafc;--radius:18px;--max:1120px;
    }
    .joy-home{ background:var(--soft); color:var(--text); font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; }
    .joy-home .wrap{ max-width:var(--max); margin:0 auto; padding:0 16px; }
    .joy-home a{ color:inherit; text-decoration:none; }
    .joy-home .btn{ border:1px solid var(--line); background:#fff; color:var(--text); padding:10px 12px; border-radius:14px; cursor:pointer; transition:.15s ease;
      display:inline-flex; align-items:center; gap:8px; white-space:nowrap; }
    .joy-home .btn:hover{ transform:translateY(-1px); box-shadow:0 10px 22px rgba(2,6,23,.06); }
    .joy-home .btn--primary{ border-color:transparent; background:var(--brand); color:#fff; }
    .joy-home .btn--primary:hover{ background:var(--brand-2); }

    .joy-home .hero{ padding:22px 0 18px; }
    .joy-home .hero__grid{ display:grid; grid-template-columns:1fr; gap:14px; }
    .joy-home .hero__card{ background:var(--bg); border:1px solid var(--line); border-radius:calc(var(--radius) + 8px); box-shadow:var(--shadow); overflow:hidden; }
    .joy-home .hero__inner{ padding:22px; display:grid; gap:14px; }
    .joy-home .kicker{ display:inline-flex; align-items:center; gap:8px; font-weight:800; font-size:12px; color:var(--brand); background:rgba(37,99,235,.08);
      padding:8px 10px; border-radius:999px; width:fit-content; }
    .joy-home h1{ margin:0; font-size:28px; letter-spacing:-0.6px; }
    .joy-home p{ margin:0; color:var(--muted); line-height:1.6; font-size:15px; }
    .joy-home .hero__cta{ display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; }
    .joy-home .badge{ font-size:12px; font-weight:800; color:var(--brand); background:rgba(37,99,235,.08);
      padding:6px 10px; border-radius:999px; width:fit-content; }
    .joy-home .hero__visual{ min-height:180px; background:
      radial-gradient(900px 250px at 20% 30%, rgba(37,99,235,.22), transparent 55%),
      radial-gradient(700px 240px at 75% 40%, rgba(96,165,250,.25), transparent 55%),
      linear-gradient(180deg,#fff,#f8fafc);
      border-top:1px solid var(--line); display:flex; align-items:center; justify-content:center; padding:18px; }
    .joy-home .visual__box{ width:100%; max-width:520px; border:1px dashed rgba(71,85,105,.35); border-radius:20px; padding:16px;
      color:var(--muted); text-align:center; background:rgba(255,255,255,.7); }
    .joy-home .visual__box b{ color:var(--text); }

    .joy-home .section{ padding:10px 0 18px; }
    .joy-home .section__title{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin:10px 0 10px; }
    .joy-home .section__title h2{ margin:0; font-size:18px; letter-spacing:-.3px; }
    .joy-home .section__title span{ color:var(--muted); font-size:13px; }

    .joy-home .grid3{ display:grid; grid-template-columns:1fr; gap:12px; }
    .joy-home .card{ background:var(--card); border:1px solid var(--line); border-radius:var(--radius); box-shadow:0 12px 26px rgba(2,6,23,.06);
      padding:16px; display:grid; gap:10px; }
    .joy-home .card__top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .joy-home .card h3{ margin:0; font-size:16px; letter-spacing:-.2px; }
    .joy-home .card p{ margin:0; color:var(--muted); line-height:1.55; font-size:14px; }
    .joy-home .card__bottom{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:2px; }
    .joy-home .progress{ flex:1; min-width:160px; height:10px; background:#f1f5f9; border-radius:999px; overflow:hidden; border:1px solid var(--line); }
    .joy-home .progress>i{ display:block; height:100%; width:45%; background:var(--brand); border-radius:999px; }

    .joy-home .tick{ font-size:12px; border:1px solid var(--line); border-radius:999px; padding:6px 8px; color:var(--muted); background:#fff; }
    .joy-home .tick.on{ color:#0b3; border-color:rgba(0,187,85,.35); background:rgba(0,187,85,.06); font-weight:700; }

    .joy-home .two{ display:grid; grid-template-columns:1fr; gap:12px; }
    .joy-home .list{ display:grid; gap:8px; margin-top:4px; }
    .joy-home .li{ border:1px solid var(--line); border-radius:14px; padding:12px; background:#fff;
      display:flex; justify-content:space-between; gap:10px; }
    .joy-home .li span{ color:var(--muted); font-size:13px; }
    .joy-home .li b{ font-size:14px; }

    .joy-home footer{ margin-top:24px; padding:22px 0 30px; border-top:1px solid var(--line); background:#fff; }
    .joy-home .footer__grid{ display:grid; grid-template-columns:1fr; gap:12px; color:var(--muted); font-size:13px; line-height:1.6; }
    .joy-home .footer__grid b{ color:var(--text); }

    @media (min-width: 860px){
      .joy-home .hero__grid{ grid-template-columns:1.15fr .85fr; align-items:stretch; }
      .joy-home .hero__card{ height:100%; }
      .joy-home .hero__visual{ min-height:100%; border-top:none; border-left:1px solid var(--line); }
      .joy-home .grid3{ grid-template-columns:repeat(3, 1fr); }
      .joy-home .two{ grid-template-columns:1.15fr .85fr; }
      .joy-home .footer__grid{ grid-template-columns:1.2fr .8fr; }
    }
  `;
  document.head.appendChild(style);
}

function renderHome(root) {
  ensureStyles();
  const lang = getLang();
  const T = TEXT[lang];

  root.innerHTML = `
    <div class="joy-home">
      <main>
        <section class="hero">
          <div class="wrap hero__grid">
            <div class="hero__card">
              <div class="hero__inner">
                <div class="kicker">${T.kicker}</div>
                <h1>${T.h1}</h1>
                <p>${T.p1} <b>${T.p1b}</b>${lang === "ko" ? "입니다." : "。"}</p>
                <div class="hero__cta">
                  <a class="btn btn--primary" href="#hsk">${T.cta1}</a>
                  <a class="btn" href="#catalog">${T.cta2}</a>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
                  ${T.tags.map(x => `<span class="badge">${x}</span>`).join("")}
                </div>
              </div>
            </div>

            <div class="hero__card">
              <div class="hero__visual">
                <div class="visual__box">
                  <div style="font-size:14px; margin-bottom:6px;">${T.visualTitle}</div>
                  <div style="font-size:12px;">
                    ${T.visualDesc1}<br/>
                    ${T.visualDesc2}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="wrap">
            <div class="section__title">
              <h2>${T.quickTitle}</h2>
              <span>${T.quickSub}</span>
            </div>

            <div class="grid3">
              <article class="card">
                <div class="card__top">
                  <div>
                    <div class="badge">${T.card1Badge}</div>
                    <h3>${T.card1Title}</h3>
                  </div>
                  <a class="btn btn--primary" href="#hsk">${T.card1Btn}</a>
                </div>
                <p>${T.card1Desc}</p>
                <div class="card__bottom">
                  <div class="progress" aria-label="progress"><i></i></div>
                  <span style="color:var(--muted); font-size:13px;">${T.card1Meta}</span>
                </div>
              </article>

              <article class="card">
                <div class="card__top">
                  <div>
                    <div class="badge">${T.card2Badge}</div>
                    <h3>${T.card2Title}</h3>
                  </div>
                  <a class="btn" href="#catalog">${T.card2Btn}</a>
                </div>
                <p>${T.card2Desc}</p>
                <div class="card__bottom">
                  ${T.card2Chips.map(x => `<span class="tick on">${x}</span>`).join("")}
                </div>
              </article>

              <article class="card">
                <div class="card__top">
                  <div>
                    <div class="badge">${T.card3Badge}</div>
                    <h3>${T.card3Title}</h3>
                  </div>
                  <a class="btn" href="#teacher">${T.card3Btn}</a>
                </div>
                <p>${T.card3Desc}</p>
                <div class="card__bottom">
                  ${T.card3Chips.map((x,i) => `<span class="tick ${i<2 ? "on":""}">${x}</span>`).join("")}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="wrap two">
            <div class="card">
              <div class="card__top">
                <div>
                  <div class="badge">${T.twoLeftBadge}</div>
                  <h3>${T.twoLeftTitle}</h3>
                </div>
                <a class="btn" href="#resources">${T.more}</a>
              </div>
              <div class="list">
                <div class="li"><b>${T.upd1}</b><span>2026-03-03</span></div>
                <div class="li"><b>${T.upd2}</b><span>2026-03-02</span></div>
                <div class="li"><b>${T.upd3}</b><span>${lang === "ko" ? "规划中" : "规划中"}</span></div>
              </div>
            </div>

            <div class="card">
              <div class="card__top">
                <div>
                  <div class="badge">${T.twoRightBadge}</div>
                  <h3>${T.twoRightTitle}</h3>
                </div>
              </div>
              <p>${T.twoRightDesc}</p>
              <div class="list">
                <div class="li"><b>${T.feat1}</b><span>${T.feat1s}</span></div>
                <div class="li"><b>${T.feat2}</b><span>${T.feat2s}</span></div>
                <div class="li"><b>${T.feat3}</b><span>${T.feat3s}</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div class="wrap footer__grid">
          <div>
            <b>${T.footerBrand}</b><br/>
            ${T.footerLine}
          </div>
          <div>
            ${T.contact}: 010-0000-0000<br/>
            ${T.email}: hello@joychinese.kr<br/>
            <a href="#my" style="text-decoration:underline;">${T.privacy}</a>
            ·
            <a href="#my" style="text-decoration:underline;">${T.terms}</a><br/>
            ${T.copy}
          </div>
        </div>
      </footer>
    </div>
  `;

  // If you have data-i18n system, this will still work, but here we already rendered strings.
  try { i18n.apply(root); } catch {}
}

/** router: default(ctx) */
export default function pageHome(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");

  if (!root) return;
  renderHome(root);
}
export function mount(ctxOrRoot) { return pageHome(ctxOrRoot); }
export function render(ctxOrRoot) { return pageHome(ctxOrRoot); }
