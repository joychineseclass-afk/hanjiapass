/**
 * Step4：自 expansion + l10n 生成 idioms-basic-002.json，扩展 index 至 50 条，并回写 candidate 的 published* 状态。
 * 仅维护期使用；不替代运行时加载逻辑。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const d = (...p) => path.join(root, "data", "culture", "idioms", ...p);

const exp = JSON.parse(fs.readFileSync(d("idioms-expansion-candidates-050.json"), "utf8"));
const a = JSON.parse(fs.readFileSync(d("idioms-40-l10n-a.json"), "utf8"));
const b = JSON.parse(fs.readFileSync(d("idioms-40-l10n-b.json"), "utf8"));
const L = { ...a, ...b };

if (Object.keys(L).length !== 40) {
  throw new Error(`Expected 40 l10n keys, got ${Object.keys(L).length}`);
}

const fable = {
  storySource: {
    cn: "多出自古代寓言，后人常引用为日常比喻。",
    kr: "고대 우화·비유에 자주 이어집니다.",
    en: "Often traced to classical fables and later everyday metaphors.",
    jp: "古代の寓話に根ざし、日常の比喩として用います。",
  },
  story: {
    cn: "课堂可配合绘本或简短视频讲解典故；页面正文不直接展示。",
    kr: "수업에서 짧은 이야기·영상으로 맥락을 넣을 수 있으며, 본화면에는 본문을 길게 넣지 않습니다.",
    en: "Teachers may add a very short fable version in class; the app page keeps the idiom read view without long story text.",
    jp: "授業で短い物語補足は可能。アプリ本画面は長文の物語表示はしません。",
  },
};

const study = {
  storySource: {
    cn: "多来自典籍、俗语或现代表达中的固定结构。",
    kr: "사서·숙어·현대 한어의 고정 표현에서 자주 쓰입니다.",
    en: "From classical sayings, proverbs, or set phrases in modern Chinese.",
    jp: "文献・常套句・現代定着表現に由来します。",
  },
  story: fable.story,
};

const mood = {
  storySource: {
    cn: "描写情绪、感觉或 AABB 结构时的常用语。",
    kr: "감정·상태·AABB 형식에 자주 쓰입니다.",
    en: "Common for feelings, states, and AABB-style adjectives in casual speech or writing.",
    jp: "感情・様子。AABB 型などの生き生きとした表現。",
  },
  story: fable.story,
};

const scene = {
  storySource: {
    cn: "描写数量、场面、天气的夸张与固定搭配。",
    kr: "수·장면·날씨를 쓰는 과장·정형 표현이 많습니다.",
    en: "Used for quantity, big scenes, and weather, often in vivid, fixed sayings.",
    jp: "数・情景・天候。誇張や定型の描写に。",
  },
  story: fable.story,
};

const actionGaze = {
  storySource: {
    cn: "描写目光与左右打量的常用表达。",
    kr: "시선·시야를 이리저리 옮기는 말이 자주 쓰입니다.",
    en: "Common set phrases for how someone looks around or scans a place.",
    jp: "視線や見回しの定着表現。",
  },
  story: fable.story,
};

function pack(idx) {
  if (idx < 10) return fable;
  if (idx < 20) return study;
  if (idx < 30) return mood;
  if (idx >= 38) return actionGaze;
  return scene;
}

const data = exp.map((c, i) => {
  const t = L[c.idiom];
  if (!t) throw new Error("Missing l10n for: " + c.idiom);
  const id = `idiom_${String(11 + i).padStart(4, "0")}`;
  const p = pack(i);
  return {
    id,
    idiom: c.idiom,
    pinyin: c.pinyin,
    chineseExplanation: t.zh,
    chineseExplanationPinyin: t.zhp,
    meaning: { cn: t.mcn, kr: t.mkr, en: t.men, jp: t.mjp },
    example: { cn: t.excn, kr: t.ekr, en: t.een, jp: t.ejp },
    examplePinyin: t.expy,
    storySource: { ...p.storySource },
    story: { ...p.story },
  };
});

fs.writeFileSync(d("idioms-basic-002.json"), JSON.stringify(data, null, 2) + "\n", "utf8");

const indexPath = d("idioms-index.json");
const oldIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
if (oldIndex.length !== 10) {
  throw new Error(`Expected existing index to have 10 entries, got ${oldIndex.length}`);
}

const newRows = data.map((row, i) => {
  const c = exp[i];
  const th = Array.isArray(c.theme) ? c.theme : [];
  const theme = th.length > 3 ? th.slice(0, 3) : th;
  return {
    id: row.id,
    idiom: row.idiom,
    pinyin: row.pinyin,
    file: "idioms-basic-002.json",
    theme,
    difficulty: c.difficulty,
  };
});

fs.writeFileSync(indexPath, JSON.stringify([...oldIndex, ...newRows], null, 2) + "\n", "utf8");

const updated = exp.map((row, i) => ({
  ...row,
  status: "published",
  publishedId: data[i].id,
  publishedFile: "idioms-basic-002.json",
}));
fs.writeFileSync(d("idioms-expansion-candidates-050.json"), JSON.stringify(updated, null, 2) + "\n", "utf8");

console.log("Wrote idioms-basic-002.json, updated idioms-index.json (50) and candidates (published*).");
