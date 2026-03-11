// /ui/modules/games/gamesRegistry.js
// MVP: 课堂小游戏注册表（仅元数据，不含具体玩法逻辑）

export const games = [
  {
    id: "hello-ball",
    title: "Hello Ball",
    course: "kids1",
    type: "speaking"
  },
  {
    id: "polite-response",
    title: "礼貌用语",
    course: "kids1",
    type: "response"
  },
  {
    id: "color-race",
    title: "颜色接龙",
    course: "kids1",
    type: "vocab"
  },
  {
    id: "animal-guess",
    title: "猜一猜动物",
    course: "kids1",
    type: "guessing"
  }
];

export function getGameById(id) {
  if (!id) return null;
  return games.find((g) => g.id === id) || null;
}

