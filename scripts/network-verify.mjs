/**
 * Home → #hsk → HSK level 1 → open lesson 1 → back to list → rapid lesson switches.
 * BASE_URL default http://127.0.0.1:8765 (e.g. python -m http.server 8765).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765";

let phase = "boot";

function normUrl(u) {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return u;
  }
}

function isDataJson(u) {
  const p = normUrl(u).split("?")[0];
  return p.endsWith(".json") && (p.includes("/data/") || p.includes("data/"));
}

function isLangJson(u) {
  const p = normUrl(u).split("?")[0];
  return /\/lang\/[^/]+\.json$/i.test(p);
}

function isJsonLike(u) {
  return isDataJson(u) || isLangJson(u);
}

function byPhase(entries, p) {
  return entries.filter((e) => e.phase === p);
}

function countDupUrls(entries) {
  const m = new Map();
  for (const e of entries) {
    const k = `${e.method} ${normUrl(e.url)}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].filter(([, c]) => c > 1);
}

function statusSummary(arr) {
  const by = new Map();
  for (const r of arr) {
    by.set(r.status, (by.get(r.status) || 0) + 1);
  }
  return Object.fromEntries([...by.entries()].sort((a, b) => a[0] - b[0]));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const responses = [];

page.on("response", (response) => {
  const req = response.request();
  const url = response.url();
  if (url.startsWith("data:") || url.startsWith("blob:")) return;
  responses.push({
    phase,
    url,
    method: req.method(),
    resourceType: req.resourceType(),
    status: response.status(),
    fromServiceWorker: response.fromServiceWorker(),
  });
});

phase = "home";
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);

phase = "hsk_nav";
await page.goto(`${BASE}/#hsk`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(4000);

await page.waitForSelector("#hskLevel", { timeout: 60000 });
phase = "hsk_select_level1";
await page.selectOption("#hskLevel", "1");
await page.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3500);

await page.waitForSelector('button[data-open-lesson="1"]', { timeout: 60000 });
phase = "hsk_open_lesson1";
await page.locator('button[data-open-lesson="1"]').first().click();
await page.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3500);

await page.waitForSelector("#hskBackToList", { state: "visible", timeout: 30000 }).catch(() => {});
phase = "hsk_back_to_list";
await page.locator("#hskBackToList").click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(800);
await page.waitForSelector('button[data-open-lesson="1"]', { timeout: 30000 });

phase = "hsk_rapid_lesson_switch";
const btns = page.locator('button[data-open-lesson="1"]');
const n = await btns.count();
const sequence = [1, 2, 0, 2, 1].filter((i) => i < n);
for (const i of sequence) {
  await btns.nth(i).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);
}
await page.waitForTimeout(2500);

await browser.close();

function summarize(label, entries) {
  const jsonE = entries.filter((r) => isJsonLike(r.url));
  const cacheHints = jsonE.map((r) => ({
    url: normUrl(r.url),
    status: r.status,
  }));
  return {
    label,
    totalRequests: entries.length,
    jsonRequests: jsonE.length,
    statuses: statusSummary(entries),
    jsonStatusBreakdown: statusSummary(jsonE),
    duplicateSameUrl: countDupUrls(jsonE),
    jsonUrlsInPhase: [...new Set(jsonE.map((r) => normUrl(r.url)))],
    cacheHints304: jsonE.filter((r) => r.status === 304).length,
    fromServiceWorkerJson: jsonE.filter((r) => r.fromServiceWorker).length,
  };
}

const report = {
  base: BASE,
  note:
    "本地 python http.server 通常只返回 200，不会出现 304；生产环境（CDN/Vercel）才可能看到缓存命中。",
  home: summarize("首页 (#home 加载完成后)", byPhase(responses, "home")),
  hskNav: summarize("仅路由到 #hsk（phase=hsk_nav）", byPhase(responses, "hsk_nav")),
  selectLevel1: summarize("选择 HSK1（phase=hsk_select_level1）", byPhase(responses, "hsk_select_level1")),
  openLesson1: summarize("打开第 1 课（phase=hsk_open_lesson1）", byPhase(responses, "hsk_open_lesson1")),
  rapidSwitch: summarize("返回列表后快速切换课程（phase=hsk_rapid_lesson_switch）", byPhase(responses, "hsk_rapid_lesson_switch")),
  combinedHskStudy: summarize("HSK 页内与课程相关的累计（hsk_nav + select + open + back + rapid）", [
    ...byPhase(responses, "hsk_nav"),
    ...byPhase(responses, "hsk_select_level1"),
    ...byPhase(responses, "hsk_open_lesson1"),
    ...byPhase(responses, "hsk_back_to_list"),
    ...byPhase(responses, "hsk_rapid_lesson_switch"),
  ]),
};

console.log(JSON.stringify(report, null, 2));
