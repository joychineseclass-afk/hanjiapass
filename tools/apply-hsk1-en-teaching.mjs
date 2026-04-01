/**
 * 一次性/可重复运行：将 HSK1 词库 meaning.en 规范为简明教学释义。
 * 仅覆盖下方映射表中的词条；其它字段不动。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
/** 默认课程与可选词表版本均使用同一套 HSK1 简明英文义 */
const VOCAB_PATHS = [
  path.join(ROOT, "data", "vocab", "hsk2.0", "hsk1.json"),
  path.join(ROOT, "data", "vocab", "hsk3.0", "hsk1.json"),
];

/** HSK1 教学型简明英文义（优先 1～2 个核心义项） */
const TEACHING_EN = {
  爱: "to love; to like",
  本: "measure word (books); root; origin",
  不: "not; no",
  不客气: "you're welcome; don't mention it",
  菜: "dish; vegetable",
  吃: "to eat",
  大: "big; large",
  的: "possessive particle; of",
  点: "a little; o'clock; dot",
  对不起: "sorry; excuse me",
  多: "many; much; a lot",
  高兴: "happy; glad",
  工作: "job; work; to work",
  好: "good; well",
  后面: "behind; back; after",
  回: "to return; to go back",
  会: "can; to know how to",
  叫: "to be called; to call",
  开: "to open; to turn on; to start",
  块: "piece; (classifier)",
  来: "to come",
  了: "(aspect particle); completed action",
  零: "zero",
  呢: "(particle) and …?; how about …?",
  你: "you",
  请: "please",
  去: "to go",
  热: "hot",
  认识: "to know; to recognize",
  少: "few; little",
  是: "to be; yes",
  说话: "to speak; to talk",
  他: "he; him",
  太: "too; very",
  下: "down; below; next",
  先生: "Mr.; sir; teacher",
  想: "to think; to want",
  些: "some; a few",
  一: "one",
  有: "to have; there is",
  在: "at; in; to be (located)",
  这: "this; these",
  住: "to live; to stay",
  字: "character; word",
  做: "to do; to make",
  北京: "Beijing",
  看: "to look; to watch; to see",
  猫: "cat",
  没: "not have; there is not",
  现在: "now",
  前面: "in front; ahead",
  同学: "classmate",
  怎么样: "how; how about",
  谢谢: "thank you",
  那: "that; those",
  都: "all; both",
  和: "and; with",
  吗: "(question particle)",
  能: "can; be able to",
  冷: "cold",
  里: "inside; in",
  家: "home; family",
  几: "how many; several; a few",
  很: "very; quite",
  小姐: "Miss; young lady",
};

function applyToFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) throw new Error("expected array");
  let n = 0;
  for (const item of arr) {
    const h = item?.hanzi;
    if (!h || typeof h !== "string") continue;
    const next = TEACHING_EN[h];
    if (!next) continue;
    if (!item.meaning || typeof item.meaning !== "object") item.meaning = {};
    if (item.meaning.en === next) continue;
    item.meaning.en = next;
    n++;
  }
  fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2) + "\n", "utf8");
  console.log(`Updated ${n} entries in ${path.relative(ROOT, jsonPath)}`);
}

function main() {
  for (const p of VOCAB_PATHS) {
    if (!fs.existsSync(p)) {
      console.warn("Skip missing:", path.relative(ROOT, p));
      continue;
    }
    applyToFile(p);
  }
}

main();
