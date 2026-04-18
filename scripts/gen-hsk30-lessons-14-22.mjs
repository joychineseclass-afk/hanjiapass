/**
 * Generates data/courses/hsk3.0/hsk1/lesson14.json … lesson22.json
 * Run: node scripts/gen-hsk30-lessons-14-22.mjs
 */
import fs from "fs";
import path from "path";
import { L, tr, i4, line, card, opt4, pinOpts } from "./lib/hsk30-lesson-build.mjs";
import { lesson15, lesson16, lesson17, lesson18 } from "./hsk30-lessons-15-18.mjs";
import { lesson19, lesson20, lesson21, lesson22 } from "./hsk30-lessons-19-22.mjs";

const dir = path.join("data", "courses", "hsk3.0", "hsk1");

// ——— Lesson 14 ———
const lesson14 = L(14, {
  title: {
    zh: "第14课｜你怎么去学校？",
    cn: "第14课｜你怎么去学校？",
    kr: "제14과｜학교엔 어떻게 가요?",
    en: "Lesson 14 | How Do You Get to School?",
    jp: "第14課｜学校へはどう行きますか。",
  },
  summary: {
    zh: "学习用「怎么」问方式，用「坐、开车」说交通，认识连动句与提议语气的「吧」。",
    kr: "「怎么」로 방법을 묻고 「坐」「开车」로 이동을 말하며, 연동문장과 「吧」를 익힙니다.",
    en: "Ask how with 怎么; use 坐 and 开车; serial verbs; 吧 for suggestions.",
    jp: "「怎么」で方法、「坐」「开车」、連動文、「吧」を学びます。",
  },
  scene: {
    id: "hsk30_l14_scene",
    title: i4("上学路上", "통학·출퇴근", "Commuting", "通学・通勤"),
    summary: i4(
      "会话一：怎么去、出租车与开车送；会话二：上班与送哥哥；会话三：火车去北京与下周五回。",
      "회화1 택시·아빠 차 → 회화2 출근·형 학교 → 회화3 기차·비행기·귀국.",
      "Taxi & ride · work & school runs · train, plane, return.",
      "タクシー／送迎／電車・飛行機・帰り。"
    ),
  },
  objectives: [
    {
      zh: "能用「你怎么去学校？」「我坐出租车去」询问与说明出行方式",
      pinyin: "zěnme qù · zuò chūzūchē",
      kr: "「怎么去?」「坐出租车去」처럼 가는 방법을 묻고 말한다.",
      en: "Ask and say how you travel to school.",
      jp: "「怎么去」「坐出租车去」で行き方を尋ね、言える。",
    },
    {
      zh: "能理解「我开车送你吧」一类连动结构，并听懂「吧」表提议",
      pinyin: "kāichē sòng · ba",
      kr: "「开车送你吧」 같은 연속 동작과 「吧」 제안을 이해한다.",
      en: "Get serial verbs like 开车送你; 吧 as a suggestion.",
      jp: "「开车送你吧」の連動と「吧」の提案。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜去学校", kr: "회화 1｜학교 가기", en: "Dialogue 1 | To school", jp: "会話1｜学校へ" },
      i4("问怎么去学校，说到坐出租车和爸爸要开车送。", "택시로 가고 아빠가 데려다 주자고 합니다.", "Taxi, then Dad offers a ride.", "タクシーと父が送る話。"),
      [
        line("爸爸", "汤姆，你怎么去学校？", "Tāngmǔ, nǐ zěnme qù xuéxiào?", tr("탐, 학교엔 어떻게 가?", "Tom, how do you get to school?", "トム、学校へはどう行くの？")),
        line("汤姆", "有点儿晚了，我坐出租车去学校。", "Yǒudiǎnr wǎn le, wǒ zuò chūzūchē qù xuéxiào.", tr("좀 늦어서 택시 타고 학교 가요.", "It’s a bit late—I’m taking a taxi to school.", "ちょっと遅いのでタクシーで学校に行きます。")),
        line("爸爸", "我开车送你吧。", "Wǒ kāichē sòng nǐ ba.", tr("아빠가 차로 데려다 줄게.", "Let me drive you.", "パパが車で送るよ。")),
        line("汤姆", "你有时间吗？", "Nǐ yǒu shíjiān ma?", tr("시간 있어요?", "Do you have time?", "時間ある？")),
        line("爸爸", "我有时间，今天白天休息。", "Wǒ yǒu shíjiān, jīntiān báitiān xiūxi.", tr("있어, 오늘 낮엔 쉬거든.", "Yes—I’m off this daytime.", "あるよ。今日の昼は休みだ。")),
      ]
    ),
    card(
      { zh: "会话二｜说家人上班", kr: "회화 2｜가족 출근", en: "Dialogue 2 | Work", jp: "会話2｜仕事" },
      i4("问爸爸有没有去上班，说到爸爸开车送哥哥去学校。", "아빠 출근 여부, 형 학교까지 차로.", "Whether Dad’s at work; driving the brother.", "父の出勤と兄を送る。"),
      [
        line("妈妈", "你爸爸去上班了吗？", "Nǐ bàba qù shàngbān le ma?", tr("아빠 벌써 출근했어?", "Has Dad gone to work?", "お父さんはもう出勤した？")),
        line("安娜", "没有，今天爸爸休息。", "Méiyǒu, jīntiān bàba xiūxi.", tr("아니, 오늘 아빠 쉬는 날이야.", "No—Dad’s off today.", "いいえ、今日お父さんは休み。")),
        line("妈妈", "爸爸呢？", "Bàba ne?", tr("아빠는?", "What about Dad?", "お父さんは？")),
        line("安娜", "爸爸开车送哥哥去学校了。", "Bàba kāichē sòng gēge qù xuéxiào le.", tr("아빠가 형 학교까지 차로 데려다 줬어.", "Dad drove your brother to school.", "お父さんがお兄さんを学校まで車で送りに。")),
      ]
    ),
    card(
      { zh: "会话三｜说远行", kr: "회화 3｜먼 길", en: "Dialogue 3 | A long trip", jp: "会話3｜遠出" },
      i4("问怎么去北京，谈坐火车与下星期五回来。", "베이징 가는 법, 기차·비행기, 돌아올 때.", "How to Beijing; train vs plane; when back.", "北京へ、電車と飛行機、帰り。"),
      [
        line("李明", "你怎么去北京？", "Nǐ zěnme qù Běijīng?", tr("베이징엔 어떻게 가?", "How are you getting to Beijing?", "北京へはどう行くの？")),
        line("汤姆", "我坐火车去。", "Wǒ zuò huǒchē qù.", tr("기차로 가요.", "I’m going by train.", "電車で行きます。")),
        line("李明", "不坐飞机吗？", "Bù zuò fēijī ma?", tr("비행기 안 타?", "Not flying?", "飛行機じゃないの？")),
        line("汤姆", "是的，不坐飞机。", "Shì de, bù zuò fēijī.", tr("응, 비행기는 안 타.", "Right—I’m not taking a plane.", "ええ、飛行機は使いません。")),
        line("李明", "什么时候回来？", "Shénme shíhou huílái?", tr("언제 돌아와?", "When will you be back?", "いつ戻る？")),
        line("汤姆", "下个星期五回来。", "Xià ge Xīngqīwǔ huílái.", tr("다음 주 금요일에 돌아와요.", "Back next Friday.", "来週の金曜に戻ります。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "怎么问方式",
      pinyin: "zěnme wèn fāngshì",
      hint: { zh: "怎么去", kr: "어떻게", en: "how", jp: "どうやって" },
      explanation: {
        zh: "疑问代词「怎么」可询问动作的方式或办法，如「你怎么去学校？」「你怎么去北京？」。\n\n「怎么」\nzěnme",
        kr: "「怎么」로 방법·수단을 묻습니다.",
        en: "怎么 asks how you do something—怎么去学校?",
        jp: "「怎么」は方法を尋ねます。",
      },
      examples: [
        { zh: "你怎么去学校？", pinyin: "Nǐ zěnme qù xuéxiào?", translation: tr("학교엔 어떻게 가요?", "How do you get to school?", "学校へはどう行きますか。") },
        { zh: "你怎么去北京？", pinyin: "Nǐ zěnme qù Běijīng?", translation: tr("베이징엔 어떻게 가요?", "How will you get to Beijing?", "北京へはどう行きますか。") },
      ],
    },
    {
      pattern: "坐 / 开车",
      pinyin: "zuò / kāichē",
      hint: { zh: "交通方式", kr: "이동", en: "take / drive", jp: "乗る・運転" },
      explanation: {
        zh: "「坐」后接交通工具，如「坐出租车」「坐火车」；「开车」表示驾驶汽车，可接「送你」等宾语。\n\n「坐出租车」\nzuò chūzūchē",
        kr: "「坐」는 탈것,「开车」는 운전해서 데려다 줌.",
        en: "坐 + vehicle; 开车 = drive (a car).",
        jp: "「坐」は乗り物、「开车」は運転。",
      },
      examples: [
        { zh: "我坐出租车去学校。", pinyin: "Wǒ zuò chūzūchē qù xuéxiào.", translation: tr("택시 타고 학교 가요.", "I take a taxi to school.", "タクシーで学校に行きます。") },
        { zh: "我开车送你吧。", pinyin: "Wǒ kāichē sòng nǐ ba.", translation: tr("차로 데려다 줄게.", "I’ll drive you.", "車で送るよ。") },
      ],
    },
    {
      pattern: "连动句",
      pinyin: "liándòng jù",
      hint: { zh: "动词连用", kr: "연속 동작", en: "serial verbs", jp: "連動述語" },
      explanation: {
        zh: "两个或多个动词性成分按时间或方式先后连接，共用一个主语，如「开车送你」「坐火车去」。",
        kr: "동작이 이어지는 문장—「开车送你」처럼요.",
        en: "Serial verbs share one subject: 开车送你.",
        jp: "動詞が続く文：「开车送你」。",
      },
      examples: [
        { zh: "爸爸开车送哥哥去学校了。", pinyin: "Bàba kāichē sòng gēge qù xuéxiào le.", translation: tr("아빠가 형을 학교까지 차로 보냈어요.", "Dad drove your brother to school.", "お父さんがお兄さんを学校まで車で送りました。") },
      ],
    },
    {
      pattern: "吧表示提议",
      pinyin: "ba biǎoshì tíyì",
      hint: { zh: "商量", kr: "제안", en: "suggestion", jp: "提案" },
      explanation: {
        zh: "语气助词「吧」可使句子带有商量、提议色彩，如「我开车送你吧。」",
        kr: "「吧」는 부드럽게 제안할 때 씁니다.",
        en: "吧 softens to a suggestion.",
        jp: "「吧」は軽い提案。",
      },
      examples: [
        { zh: "我开车送你吧。", pinyin: "Wǒ kāichē sòng nǐ ba.", translation: tr("차로 데려다 줄게.", "Let me drive you.", "車で送るよ。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "我坐车去上学。", pinyin: "Wǒ zuò chē qù shàngxué.", translations: tr("차 타고 등교해요.", "I ride to school.", "車で学校に行きます。") },
        { zh: "爸爸开车上班。", pinyin: "Bàba kāichē shàngbān.", translations: tr("아빠는 차 타고 출근해요.", "Dad drives to work.", "お父さんは車で出勤します。") },
        { zh: "我晚上回家。", pinyin: "Wǒ wǎnshang huí jiā.", translations: tr("저녁에 집에 가요.", "I go home in the evening.", "夜、家に帰ります。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜出行方式卡", kr: "읽기｜이동 카드", en: "Reading | How we go", jp: "読み物｜行き方カード" },
      sentences: [
        { zh: "李明坐出租车去学校。", pinyin: "Lǐ Míng zuò chūzūchē qù xuéxiào.", translations: tr("리밍은 택시로 학교에 간다.", "Li Ming takes a taxi to school.", "李明はタクシーで学校へ行く。") },
        { zh: "李爸爸开车去上班。", pinyin: "Lǐ bàba kāichē qù shàngbān.", translations: tr("리 아빠는 차로 출근한다.", "Li’s dad drives to work.", "李のお父さんは車で出勤する。") },
        { zh: "王老师坐火车去北京。", pinyin: "Wáng lǎoshī zuò huǒchē qù Běijīng.", translations: tr("왕 선생님은 기차로 베이징에 간다.", "Teacher Wang takes the train to Beijing.", "王先生は電車で北京へ行く。") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l14_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: {
        cn: "下面哪一句在问「用什么方式去学校」？",
        kr: "「어떻게 학교에 가?」를 묻는 말은?",
        en: "Which line asks how someone gets to school?",
        jp: "「どうやって学校へ行くか」を聞いているのは？",
      },
      options: opt4(
        ["你怎么去学校？", "학교엔 어떻게 가요?", "How do you get to school?", "学校へはどう行きますか。"],
        ["你住在哪里？", "어디 살아요?", "Where do you live?", "どこに住んでいますか。"],
        ["这个多少钱？", "얼마예요?", "How much is this?", "いくらですか。"],
        ["今天天气怎么样？", "날씨 어때요?", "How’s the weather?", "今日の天気はどう？"]
      ),
      answer: "A",
      explanation: {
        cn: "「怎么去」询问方式，与本课一致。",
        kr: "「怎么去」로 방법을 묻습니다.",
        en: "怎么去 asks the way or means—that’s this lesson.",
        jp: "「怎么去」は方法を尋ねます。",
      },
    },
    {
      id: "hsk30_l14_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「出租车」的拼音是？", kr: "「出租车」의 병음은?", en: "What’s the pinyin for 出租车?", jp: "「出租车」のピンインは？" },
      options: pinOpts("chūzūchē", "chūzhūchē", "cūzūchē", "chūzūché"),
      answer: "A",
      explanation: { cn: "「出租车」读作 chūzūchē。", kr: "「出租车」는 chūzūchē입니다.", en: "Say chūzūchē.", jp: "読みは chūzūchē です。" },
    },
    {
      id: "hsk30_l14_p3",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "爸爸提议送你时，哪一句最合适？",
        kr: "아빠가 데려다 주겠다고 할 때 맞는 말은?",
        en: "Which line is Dad offering you a ride?",
        jp: "パパが送ると言っているのはどれ？",
      },
      options: opt4(
        ["我开车送你吧。", "차로 데려다 줄게.", "Let me drive you.", "車で送るよ。"],
        ["你怎么去学校？", "학교 어떻게 가?", "How do you get to school?", "学校へどう行く？"],
        ["我有时间。", "시간 있어.", "I have time.", "時間がある。"],
        ["今天白天休息。", "오늘 낮엔 쉬어.", "I'm off this daytime.", "今日の昼は休み。"]
      ),
      answer: "A",
      explanation: {
        cn: "「我开车送你吧。」是提议开车送你。",
        kr: "「我开车送你吧。」는 차로 데려다 주자는 제안입니다.",
        en: "我开车送你吧 offers a ride.",
        jp: "「我开车送你吧」は送るという提案です。",
      },
    },
    {
      id: "hsk30_l14_p4",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「坐」在「坐火车」中读作？",
        kr: "「坐火车」의 「坐」 병음은?",
        en: "In 坐火车, the pinyin of 坐 is?",
        jp: "「坐火车」の「坐」のピンインは？",
      },
      options: pinOpts("zuò", "zhuò", "zuō", "zuó"),
      answer: "A",
      explanation: {
        cn: "「坐」读 zuò。",
        kr: "「坐」는 zuò입니다.",
        en: "坐 is read zuò.",
        jp: "「坐」は zuò と読みます。",
      },
    },
  ],
  aiPractice: {
    speaking: [
      "你怎么去学校？",
      "我坐出租车去学校。",
      "我开车送你吧。",
      "你有时间吗？",
      "爸爸开车送哥哥去学校了。",
      "你怎么去北京？",
      "我坐火车去。",
      "下个星期五回来。",
    ],
    chatPrompt: "请只用本课「怎么、坐、开车、送、出租车、火车、飞机、上学、上班、吧」等词语练习出行方式；不要写成问天气或问价钱。",
    prompt: {
      zh: "请只用本课「怎么、坐、开车、送、出租车、火车、飞机、上学、上班、吧」等词语练习出行方式；不要写成问天气或问价钱。",
      kr: "「怎么·坐·开车·送·出租车·火车·飞机·上学·上班·吧」만 써서 이동 방법을 연습하세요. 날씨·가격 이야기는 빼 주세요.",
      en: "Practice how you travel with 怎么, 坐, 开车, 送, 出租车, 火车—no weather or price talk.",
      jp: "「怎么」「坐」「开车」などだけ。天気や値段は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l14_how_school",
          situation: { zh: "会话一：怎么去学校", kr: "회화1 · 학교 가는 법", en: "Dialogue 1 — to school", jp: "会話1：学校へ" },
          aiRole: { zh: "爸爸", kr: "아빠", en: "Dad", jp: "父" },
          studentRole: { zh: "汤姆", kr: "탐", en: "Tom", jp: "トム" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "你怎么去学校？", pinyin: "Nǐ zěnme qù xuéxiào?", kr: "학교엔 어떻게 가?", en: "How do you get to school?", jp: "学校へはどう行くの？" },
            { zh: "我坐出租车去学校。", pinyin: "Wǒ zuò chūzūchē qù xuéxiào.", kr: "택시 타고 학교 가요.", en: "I take a taxi to school.", jp: "タクシーで学校に行きます。" },
            { zh: "我开车送你吧。", pinyin: "Wǒ kāichē sòng nǐ ba.", kr: "차로 데려다 줄게.", en: "Let me drive you.", jp: "車で送るよ。" },
          ],
          rounds: [
            { aiLine: "快走吧！", studentRefs: ["你怎么去学校？"], acceptable: ["你怎么去学校？"], closeAnswers: ["怎么去", "学校"] },
          ],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      {
        zh: "会用「怎么」问出行或做事的方式。",
        pinyin: "zěnme",
        kr: "「怎么」로 방법을 묻는다.",
        en: "Ask how with 怎么.",
        jp: "「怎么」で方法を聞く。",
      },
      {
        zh: "能区分「坐」接交通工具与「开车」表示驾驶。",
        pinyin: "zuò · kāichē",
        kr: "「坐」는 타기,「开车」는 운전.",
        en: "坐 + vehicle vs 开车 to drive.",
        jp: "「坐」と「开车」の違い。",
      },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [
        {
          zh: "本课讲交通与方式，不是问住哪儿或问日期。",
          pinyin: "jiāotōng",
          kr: "이 과는 이동 수단·방법이에요. 주소·날짜가 아닙니다.",
          en: "This lesson is transport—not address or dates.",
          jp: "移動と方法の课。住所や日付ではない。",
        },
      ],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：出租车与开车送。会话二：上班与送哥哥。会话三：火车去北京与下周五回。",
        kr: "택시·운전 → 출근·형 → 기차·귀국.",
        en: "Taxi & ride · work & brother · train & return.",
        jp: "タクシー／出勤／電車と帰り。",
      },
      scenarioSummaryLines: [
        {
          zh: "「白天」指一天中的上午、下午时段，常对比「晚上」。",
          pinyin: "báitiān",
          kr: "「白天」는 낮 시간대.",
          en: "白天 = daytime.",
          jp: "「白天」は昼の時間帯。",
        },
      ],
      confusionPoints: [],
    },
    freeAskPlaceholder: {
      zh: "例如：「吧」和「吗」在提议句里怎么选？",
      kr: "예: 「吧」와 「吗」?",
      en: "e.g. 吧 vs 吗 for offers?",
      jp: "例:「吧」と「吗」？",
    },
    freeAskExamples: {
      zh: ["「有点儿晚了」可以不说「了」吗？", "「送」和「去」能换位置吗？"],
      kr: ["「有点儿晚」?", "「送」자리?"],
      en: ["Drop 了 in 有点儿晚了?", "送 vs 去 order?"],
      jp: ["「有点儿晚了」の「了」は？", "「送」の位置は？"],
    },
    coreExpressions: [
      {
        expr: "你怎么去学校？ / 我坐出租车去学校。",
        pinyin: "Nǐ zěnme qù xuéxiào? / Wǒ zuò chūzūchē qù xuéxiào.",
        usage: {
          zh: "询问与说明上学路上的交通方式。",
          kr: "등교하는 방법을 묻고 답한다.",
          en: "Ask and answer how you get to school.",
          jp: "通学の行き方を聞き、答える。",
        },
      },
    ],
  },
});

const out = [lesson14, lesson15, lesson16, lesson17, lesson18, lesson19, lesson20, lesson21, lesson22];
for (const lesson of out) {
  fs.writeFileSync(path.join(dir, `lesson${lesson.lessonNo}.json`), JSON.stringify(lesson, null, 2) + "\n", "utf8");
  console.log("wrote lesson" + lesson.lessonNo + ".json");
}
