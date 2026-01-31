// /ui/app.js
import { startRouter, registerRoute } from "./router.js";
import { mountNavBar } from "./components/navBar.js";
import { mountAIPanel } from "./components/aiPanel.js";
import { mountLearnPanel } from "./components/learnPanel.js";

// ✅ 注册页面（懒加载：切到哪个页面才加载哪个 js）
registerRoute("#home", () => import("./pages/page.home.js"));
registerRoute("#hsk", () => import("./pages/page.hsk.js"));
registerRoute("#stroke", () => import("./pages/page.stroke.js"));
registerRoute("#travel", () => import("./pages/page.travel.js"));

document.addEventListener("DOMContentLoaded", () => {
  // 全站固定组件：只 mount 一次
  mountNavBar(document.getElementById("siteNav"));
  mountAIPanel();
  mountLearnPanel();

  // Router 启动
  startRouter();
});
