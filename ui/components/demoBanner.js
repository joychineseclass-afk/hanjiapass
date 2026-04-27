// 全站统一「演示 / Demo」提示条，用于未接真实支付、审核、发布等链路的页面
import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-demo-banner-style";

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

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** @param {string} k */
function extraKeyForVariant(k) {
  const m = {
    publishing: "demo.banner.extra_publishing",
    review: "demo.banner.extra_review",
    listing: "demo.banner.extra_listing",
    materials: "demo.banner.extra_materials",
    courses: "demo.banner.extra_courses",
    stage0: "demo.banner.extra_stage0",
    resources: "demo.banner.extra_resources",
  };
  return m[k] || "";
}

export function ensureDemoBannerStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .lumina-demo-banner {
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, #f59e0b 35%, #e2e8f0);
      background: linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, #fff8f0 100%);
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
      margin: 0 0 16px;
    }
    .lumina-demo-banner__inner {
      padding: 12px 14px 12px 16px;
    }
    .lumina-demo-banner__badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #b45309;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 999px;
      padding: 4px 10px;
      margin: 0 0 8px;
    }
    .lumina-demo-banner__text,
    .lumina-demo-banner__extra,
    .lumina-demo-banner__foot {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: #5c3d1e;
    }
    .lumina-demo-banner__text { margin-bottom: 6px; }
    .lumina-demo-banner__extra {
      color: #78350f;
      font-weight: 600;
      margin-top: 6px;
    }
    .lumina-demo-banner__foot {
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
}

/**
 * @param {"publishing" | "review" | "listing" | "materials" | "courses" | "stage0" | "default"} variant
 * @param {{ className?: string }} [opts]
 */
export function demoBannerHtml(variant = "default", opts = {}) {
  ensureDemoBannerStyles();
  const title = t("demo.banner.title", "Demo mode");
  const body = t("demo.banner.body", "This page is for product demonstration.");
  const disclaimer = t("demo.banner.disclaimer", "Do not treat it as production.");
  const ek = extraKeyForVariant(String(variant));
  const extra = ek
    ? (() => {
        const line = t(ek, "");
        return line && line !== ek ? `<p class="lumina-demo-banner__extra" data-i18n="${esc(ek)}">${esc(line)}</p>` : "";
      })()
    : "";
  const mod = String(variant).replace(/[^a-z0-9_-]/gi, "");
  const moreCls = opts.className ? ` ${esc(opts.className)}` : "";
  return `<div class="lumina-demo-banner lumina-demo-banner--${esc(mod)}${moreCls}" data-lumina-demo-banner="1" role="status" aria-label="${esc(title)}">
    <div class="lumina-demo-banner__inner">
      <p class="lumina-demo-banner__badge" data-i18n="demo.banner.title">${esc(title)}</p>
      <p class="lumina-demo-banner__text" data-i18n="demo.banner.body">${esc(body)}</p>
      ${extra}
      <p class="lumina-demo-banner__foot" data-i18n="demo.banner.disclaimer">${esc(disclaimer)}</p>
    </div>
  </div>`;
}
