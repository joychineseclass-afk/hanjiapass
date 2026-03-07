// ui/pages/page.home.js
// ✅ Home: Brand-level Hero (international) + Today learning + Updates only
// ✅ All strings via i18n.t (KR/CN) + live rerender
// ✅ No mixed language, no raw i18n keys shown
// ✅ Keep "공지/업데이트"
// ✅ IMPORTANT: Styles are scoped; DO NOT override global :root tokens here.

import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-home-style-v5";
let _bound = false;

function getLang() {
  const v =
    (i18n?.getLang?.() ||
      localStorage.getItem("joy_lang") ||
      localStorage.getItem("site_lang") ||
      "kr").toLowerCase();
  if (v.startsWith("zh") || v === "cn") return "cn";
  return "kr";
}

/** t() with safe fallback:
 * - if i18n misses and returns key itself => fallback
 * - if returns "[key]" => fallback
 */
function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return fallback;
    const s = String(v).trim();
    if (!s || s === key || s === `[${key}]`) return fallback;
    return s;
  } catch {
    return fallback;
  }
}

/** minimal fallback (only used if i18n key missing) */
const FB = {
  kr: {
    brand: "Lumina Chinese Learning Center",
    subtitle: "루미나 글로벌 중국어 교육 플랫폼",

    // ✅ International brand hero (3-layer)
    brand_line: "Where Language Meets Light.",
    slogan: "Light the Language. Shape the Future.",
    subline:
      "구조화된 HSK 코스, 상호작용형 한자 쓰기, 실전 말하기까지 — 전 세계 학습자를 위한 차세대 중국어 학습 경험.",

    // ✅ actions / trust tags
    cta1: "시작 학습",
    cta2: "커리큘럼 보기",
    // ✅ change tag2: 중·한·병음 -> 회화
    tags: ["HSK 2.0/3.0", "회화", "따라쓰기", "AI 말하기"],

    // ✅ today
    today_badge: "오늘의 학습",
    today_title: "지금 3분만 — 오늘의 학습을 이어가요",
    today_desc: "마지막으로 하던 수업을 이어서, 짧게라도 꾸준히!",
    today_meta: "이번 주 3/7 완료",

    // ✅ updates
    upd_badge: "공지/업데이트",
    upd_title: "최근 업데이트",
    more: "더보기",
    upd1: "신규: HSK1 1과 「인사하기」",
    upd2: "개선: 목차 언어 동기화",
    upd3: "예고: 따라쓰기 ‘정답 발광/너무 잘했어요’",
    planning: "기획 중",

    // ✅ footer
    footerLine: "아이도 즐겁고, 학부모/선생님도 찾기 쉬운 중국어 학습 플랫폼",
    contact: "문의",
    email: "이메일",
    privacy: "개인정보처리방침",
    terms: "이용약관",
    copy: "© 2026 Lumina Chinese Learning Center",
  },

  cn: {
    brand: "Lumina Chinese Learning Center",
    subtitle: "루미나 글로벌 중국어 교육 플랫폼",

    // ✅ International brand hero (3-layer)
    brand_line: "Where Language Meets Light.",
    slogan: "Light the Language. Shape the Future.",
    subline:
      "结构化HSK课程、互动汉字书写、真实场景口语训练——面向全球学习者的下一代中文学习体验。",

    cta1: "开始学习",
    cta2: "查看课程目录",
    // ✅ change tag2: 中·韩·拼音 -> 会话
    tags: ["HSK 2.0/3.0", "会话", "描红", "AI口语"],

    today_badge: "今天的学习",
    today_title: "现在开始，只要3分钟",
    today_desc: "继续上次的课程，短短几分钟也能坚持！",
    today_meta: "本周完成 3/7",

    upd_badge: "公告/更新",
    upd_title: "最近更新",
    more: "更多",
    upd1: "新增：HSK1 第1课「打招呼」",
    upd2: "优化：目录支持语言同步",
    upd3: "预告：描红“写对发光/太棒了”",
    planning: "规划中",

    footerLine: "孩子学得开心，家长/老师也更容易找到课程内容的中文学习平台",
    contact: "联系方式",
    email: "邮箱",
    privacy: "隐私政策",
    terms: "使用条款",
    copy: "© 2026 Lumina Chinese Learning Center",
  },
};

function copy() {
  const lang = getLang();
  const F = FB[lang];

  return {
    brand: t("brand", F.brand),
    subtitle: t("subtitle", F.subtitle),

    brand_line: t("home_brand_line", F.brand_line),
    slogan: t("home_slogan", F.slogan),
    subline: t("home_subline", F.subline),

    cta1: t("home_cta1", F.cta1),
    cta2: t("home_cta2", F.cta2),
    tags: [
      t("home_tag1", F.tags[0]),
      t("home_tag2", F.tags[1]), // ✅ 회화 / 会话
      t("home_tag3", F.tags[2]),
      t("home_tag4", F.tags[3]),
    ],

    today_badge: t("home_today_badge", F.today_badge),
    today_title: t("home_today_title", F.today_title),
    today_desc: t("home_today_desc", F.today_desc),
    today_meta: t("home_today_meta", F.today_meta),

    upd_badge: t("home_upd_badge", F.upd_badge),
    upd_title: t("home_upd_title", F.upd_title),
    more: t("home_more", F.more),
    upd1: t("home_upd1", F.upd1),
    upd2: t("home_upd2", F.upd2),
    upd3: t("home_upd3", F.upd3),
    planning: t("home_planning", F.planning),

    footerLine: t("home_footerLine", F.footerLine),
    contact: t("home_contact", F.contact),
    email: t("home_email", F.email),
    privacy: t("home_privacy", F.privacy),
    terms: t("home_terms", F.terms),
    copy: t("home_copy", F.copy),
  };
}

/**
 * ✅ IMPORTANT:
 * - DO NOT define :root tokens here (global tokens should be in base.css)
 * - Only scoped styles under .lumina-home
 * - Uses global tokens: --soft --bg --card --text --muted --line --brand --brand-2 --brand-soft --brand-soft-2 --shadow --shadow-sm --glow --max
 */
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;

  style.textContent = `
    .lumina-home{
      background: var(--soft, #f8fafc);
      color: var(--text, #0f172a);
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Noto Sans,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
    }
    .lumina-home .wrap{ max-width: var(--max, 1120px); margin:0 auto; padding: 0 16px; }
    .lumina-home a{ color: inherit; text-decoration:none; }

    /* Cards */
    .lumina-home .card{
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  border: 1px solid rgba(255,255,255,.45);
  border-radius: calc(var(--radius, 18px) + 8px);
  box-shadow: 0 20px 50px rgba(0,0,0,.08);
  overflow:hidden;
}
/* HERO card — fully transparent layer */
.lumina-home .heroFull .card{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
    .lumina-home .inner{
      padding: 18px;
      display:grid;
      gap: 12px;
    }

    /* Layout */
    .lumina-home .hero{ padding: 18px 0 12px; }
    .lumina-home .section{ padding: 10px 0 18px; }

    /* FULL-WIDTH brand hero card (your request) */
    .lumina-home .heroFull{
      display:grid;
      gap: 12px;
    }

    /* Brand line pill */
    .lumina-home .brandLine{
  display:inline-flex;
  align-items:center;
  gap:8px;

  font-weight: 900;
  font-size: 16px;   /* 再放大一点 */

  letter-spacing: .3px;

  color: var(--brand);
  background: rgba(255,255,255,.6);
  border: 1px solid rgba(255,255,255,.6);

  padding: 8px 14px;
  border-radius: 999px;
  width: fit-content;
}

    /* Hero headline */
   .lumina-home .heroTitle{
  margin:0;

  font-size: 38px;
  letter-spacing: -0.5px;
  line-height: 1.1;

  font-weight: 950;
  color: #0f172a;
  text-shadow: 0 1px 4px rgba(0,0,0,.06);
}

@media (min-width: 860px){
  .lumina-home .heroTitle{
    font-size: 44px;
  }
}

    /* Hero subline */
    .lumina-home .heroSub{
      margin:0;
      color: var(--muted, #475569);
      line-height: 1.65;
      font-size: 15px;
      max-width: 70ch;
    }

    /* Buttons */
    .lumina-home .cta{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top: 2px;
    }
    .lumina-home .btn{
      border: 1px solid var(--line, #e2e8f0);
      background: #fff;
      color: var(--text, #0f172a);
      padding: 10px 12px;
      border-radius: 14px;
      cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
      display:inline-flex;
      align-items:center;
      gap: 8px;
      white-space: nowrap;
      font-weight: 950;
    }
    .lumina-home .btn:hover{
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(2,6,23,.06);
      border-color: rgba(2,6,23,.10);
    }
    .lumina-home .btn.primary{
      border-color: transparent;
      background: var(--brand, #2563eb);
      color: #fff;
      box-shadow: var(--glow, 0 14px 40px rgba(37,99,235,.18));
    }
    .lumina-home .btn.primary:hover{
      background: var(--brand-2, #1d4ed8);
    }

    /* Trust tags */
    .lumina-home .tags{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top: 0;
    }
    .lumina-home .tag{
      font-size: 12px;
      font-weight: 950;
      color: var(--brand, #2563eb);
      background: var(--brand-soft, rgba(37,99,235,.10));
      border: 1px solid rgba(37,99,235,.14);
      padding: 6px 10px;
      border-radius: 999px;
    }

    /* Badge */
    .lumina-home .badge{
      font-size: 12px;
      font-weight: 950;
      color: var(--brand, #2563eb);
      background: var(--brand-soft, rgba(37,99,235,.10));
      border: 1px solid rgba(37,99,235,.14);
      padding: 6px 10px;
      border-radius: 999px;
      width: fit-content;
    }

    /* Today card (moved below hero, and contains buttons+tags) */
    .lumina-home .todayTitle{
      margin: 0;
      font-weight: 950;
      font-size: 16px;
      color: var(--text, #0f172a);
      letter-spacing: -0.2px;
      line-height: 1.25;
    }
    .lumina-home .todayDesc{
      margin: 0;
      color: var(--muted, #475569);
      font-size: 14px;
      line-height: 1.55;
    }
    .lumina-home .progress{
      height: 10px;
      background: #f1f5f9;
      border-radius: 999px;
      overflow:hidden;
      border: 1px solid var(--line, #e2e8f0);
    }
    .lumina-home .progress i{
      display:block;
      height: 100%;
      width: 45%;
      background: var(--brand, #2563eb);
      border-radius: 999px;
    }
    .lumina-home .todayMeta{
      color: var(--muted, #475569);
      font-size: 13px;
      white-space: nowrap;
    }

    /* Updates */
    .lumina-home .headRow{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap: 10px;
    }
    .lumina-home h2{ margin:0; font-size: 18px; letter-spacing:-.3px; }
    .lumina-home .list{ display:grid; gap: 8px; margin-top: 10px; }
    .lumina-home .li{
      border: 1px solid var(--line, #e2e8f0);
      border-radius: 14px;
      padding: 12px;
      background:#fff;
      display:flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .lumina-home .li b{ font-size: 14px; }
    .lumina-home .li span{ color: var(--muted, #475569); font-size: 13px; white-space: nowrap; }

    /* Footer */
    .lumina-home footer{
      margin-top: 18px;
      padding: 20px 0 26px;
      border-top: 1px solid var(--line, #e2e8f0);
      background: #fff;
    }
    .lumina-home .foot{
      display:grid;
      gap: 10px;
      color: var(--muted, #475569);
      font-size: 13px;
      line-height: 1.6;
    }
    .lumina-home .foot b{ color: var(--text, #0f172a); }
  `;

  document.head.appendChild(style);
}

function renderHome(root) {
  ensureStyles();
  const T = copy();

  root.innerHTML = `
    <div class="lumina-home">
      <main>
        <!-- ✅ HERO: FULL-WIDTH brand card (no buttons/tags here) -->
        <section class="hero">
          <div class="wrap heroFull">
            <div class="card">
              <div class="inner">
                <div class="brandLine">${T.brand_line}</div>
                <h1 class="heroTitle">${T.slogan}</h1>
                <p class="heroSub">${T.subline}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ✅ TODAY: moved BELOW hero, and NOW contains the 2 rows (buttons + tags) -->
        <section class="section">
          <div class="wrap">
            <div class="card">
              <div class="inner">
                <div class="badge">${T.today_badge}</div>
                <p class="todayTitle">${T.today_title}</p>
                <p class="todayDesc">${T.today_desc}</p>

                <!-- Row 1: buttons -->
                <div class="cta">
                  <a class="btn primary" href="#hsk">${T.cta1}</a>
                  <a class="btn" href="#catalog">${T.cta2}</a>
                </div>

                <!-- Row 2: tags -->
                <div class="tags">
                  ${T.tags.map((x) => `<span class="tag">${x}</span>`).join("")}
                </div>

                <div class="progress" aria-label="progress"><i></i></div>
                <div class="todayMeta">${T.today_meta}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- ✅ UPDATES -->
        <section class="section">
          <div class="wrap">
            <div class="card">
              <div class="inner">
                <div class="headRow">
                  <div>
                    <div class="badge">${T.upd_badge}</div>
                    <h2>${T.upd_title}</h2>
                  </div>
                  <a class="btn" href="#resources">${T.more}</a>
                </div>

                <div class="list">
                  <div class="li"><b>${T.upd1}</b><span>2026-03-03</span></div>
                  <div class="li"><b>${T.upd2}</b><span>2026-03-02</span></div>
                  <div class="li"><b>${T.upd3}</b><span>${T.planning}</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div class="wrap foot">
          <div>
            <b>${T.brand}</b><br/>
            ${T.footerLine}
          </div>
          <div>
            ${T.contact}: 010-0000-0000<br/>
            ${T.email}: hello@lumina.example<br/>
            <a href="#my" style="text-decoration:underline;">${T.privacy}</a>
            ·
            <a href="#my" style="text-decoration:underline;">${T.terms}</a><br/>
            ${T.copy}
          </div>
        </div>
      </footer>
    </div>
  `;
}

function bindLiveRerender(root) {
  if (_bound) return;
  _bound = true;

  const rerender = () => {
    const el = root?.isConnected ? root : document.getElementById("app");
    if (!el) return;
    renderHome(el);
  };

  // ✅ Your app’s language switch event
  window.addEventListener("joy:langChanged", rerender);

  // ✅ i18n libs (optional)
  try { i18n?.on?.("change", rerender); } catch {}
  try { i18n?.onChange?.(rerender); } catch {}

  // ✅ storage change (multi-tab)
  window.addEventListener("storage", (e) => {
    if (e.key === "joy_lang" || e.key === "site_lang") rerender();
  });
}

export default function pageHome(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");

  if (!root) return;
  bindLiveRerender(root);
  renderHome(root);
}

export function mount(ctxOrRoot) { return pageHome(ctxOrRoot); }
export function render(ctxOrRoot) { return pageHome(ctxOrRoot); }
