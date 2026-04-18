import { L, tr, i4, line, card, opt4, pinOpts } from "./lib/hsk30-lesson-build.mjs";

export const lesson19 = L(19, {
  title: {
    zh: "第19课｜你想吃什么？",
    cn: "第19课｜你想吃什么？",
    kr: "제19과｜뭐 먹고 싶어요?",
    en: "Lesson 19 | What Would You Like to Eat?",
    jp: "第19課｜何が食べたいですか。",
  },
  summary: {
    zh: "学习用「想、要」表达意愿，掌握一日三餐名称，会说「做饭」与「一些」。",
    kr: "「想/要」·아침·점심·저녁·「做饭」·「一些」.",
    en: "想/要; meals; 做饭; 一些.",
    jp: "「想」「要」、三餐、「做饭」「一些」。",
  },
  scene: {
    id: "hsk30_l19_scene",
    title: i4("吃饭与点餐", "밥·주문", "Meals & ordering", "食事と注文"),
    summary: i4(
      "会话一：早饭点餐、包子与茶；会话二：午饭米饭菜、晚饭饺子；会话三：晚饭面条、少做一些。",
      "회화1 아침·포자 → 회화2 점심·저녁 메뉴 → 회화3 면·적게.",
      "Breakfast order · lunch & dinner picks · noodles & less.",
      "朝食／昼夕／麺と量。",
    ),
  },
  objectives: [
    {
      zh: "能用「你想吃什么？」「我想吃饺子」表达想吃的食物",
      pinyin: "xiǎng · yào",
      kr: "「想」「要」로 먹고 싶은 것을 말한다.",
      en: "Say what you want with 想/要.",
      jp: "「想」「要」で食べたいものを言う。",
    },
    {
      zh: "能区分「早饭、午饭、晚饭」，并听懂「少做一些」",
      pinyin: "zǎofàn · wǔfàn · wǎnfàn",
      kr: "세 끼와 「少做一些」.",
      en: "Meal words; 少做一些.",
      jp: "三餐と「少做一些」。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜在饭店吃早饭", kr: "회화 1｜아침 식당", en: "Dialogue 1 | Breakfast out", jp: "会話1｜朝の店" },
      i4("问早饭有什么、看菜单，要包子与茶。", "아침 메뉴·책·포자·차.", "What’s for breakfast—menu—buns & tea.", "朝のメニュー、包子とお茶。"),
      [
        line("饭店", "你好，你想吃点什么？", "Nǐ hǎo, nǐ xiǎng chī diǎnr shénme?", tr("안녕하세요, 뭐 드실래요?", "Hi—what would you like?", "こんにちは、何になさいますか。")),
        line("李明", "这儿早饭有什么？", "Zhèr zǎofàn yǒu shénme?", tr("여기 아침 메뉴 뭐 있어요?", "What do you have for breakfast?", "こちらの朝食は何がありますか。")),
        line("饭店", "有面包、牛奶，鸡蛋和包子。", "Yǒu miànbāo, niúnǎi, jīdàn hé bāozi.", tr("빵, 우유, 계란, 만두 있어요.", "Bread, milk, eggs, and buns.", "パン、牛乳、卵、包子があります。")),
        line("李明", "有菜单吗？", "Yǒu càidān ma?", tr("메뉴 있어요?", "Do you have a menu?", "メニューはありますか。")),
        line("饭店", "这是菜单。", "Zhè shì càidān.", tr("여기 메뉴예요.", "Here’s the menu.", "メニューです。")),
        line("李明", "给我三个包子吧。", "Gěi wǒ sān ge bāozi ba.", tr("만두 세 개 주세요.", "Three buns, please.", "包子を三つください。")),
        line("饭店", "喝点儿什么吗？", "Hē diǎnr shénme ma?", tr("뭐 마실래요?", "Something to drink?", "お飲み物は？")),
        line("李明", "一杯茶。", "Yì bēi chá.", tr("차 한 잔이요.", "A cup of tea.", "お茶一杯。")),
        line("饭店", "好的。三个包子一杯茶", "Hǎo de. Sān ge bāozi yì bēi chá", tr("알겠습니다. 만두 세 개, 차 한 잔.", "Sure—three buns and a tea.", "はい。包子三つ、お茶一杯。")),
        line("李明", "谢谢。", "Xièxie.", tr("감사합니다.", "Thanks.", "ありがとう。")),
      ]
    ),
    card(
      { zh: "会话二｜午饭和晚饭", kr: "회화 2｜점심·저녁", en: "Dialogue 2 | Lunch & dinner", jp: "会話2｜昼と夜" },
      i4("妈妈问午饭想吃什么、晚饭想吃什么。", "점심·저녁 메뉴.", "Lunch and dinner wishes.", "昼と夜の希望。"),
      [
        line("妈妈", "你午饭想吃什么？", "Nǐ wǔfàn xiǎng chī shénme?", tr("점심에 뭐 먹고 싶어?", "What do you want for lunch?", "昼ごはんは何が食べたい？")),
        line("王美", "我想吃米饭和菜。", "Wǒ xiǎng chī mǐfàn hé cài.", tr("밥이랑 반찬 먹고 싶어요.", "I’d like rice and dishes.", "ご飯とおかずが食べたいです。")),
        line("妈妈", "晚饭呢？", "Wǎnfàn ne?", tr("저녁은?", "And dinner?", "夕ごはんは？")),
        line("王美", "晚饭我想吃饺子。", "Wǎnfàn wǒ xiǎng chī jiǎozi.", tr("저녁엔 만두 먹고 싶어요.", "For dinner I want dumplings.", "夕食は餃子が食べたいです。")),
      ]
    ),
    card(
      { zh: "会话三｜做饭", kr: "회화 3｜요리", en: "Dialogue 3 | Cooking", jp: "会話3｜料理" },
      i4("晚饭想吃面条，妈妈做面条和饺子，让少做一些。", "저녁 면·만두·덜 해 달라.", "Noodles & dumplings—make a bit less.", "麺と餃子、少なめに。"),
      [
        line("李明", "妈妈，晚饭我想吃面条儿。", "Māma, wǎnfàn wǒ xiǎng chī miàntiáor.", tr("엄마, 저녁엔 면 먹고 싶어요.", "Mom—I want noodles for dinner.", "ママ、夕食は麺が食べたい。")),
        line("妈妈", "好，我给你做面条儿和饺子吧。", "Hǎo, wǒ gěi nǐ zuò miàntiáor hé jiǎozi ba.", tr("좋아, 면이랑 만두 해 줄게.", "Okay—I’ll make noodles and dumplings.", "いいわ、麺と餃子を作るね。")),
        line("李明", "少做一些。", "Shǎo zuò yīxiē.", tr("적게 해 주세요.", "Not too much.", "少なめに。")),
        line("妈妈", "好的。", "Hǎo de.", tr("알겠어.", "Sure.", "いいわよ。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "想 / 要",
      pinyin: "xiǎng / yào",
      hint: { zh: "意愿", kr: "바라다", en: "want", jp: "欲しい" },
      explanation: {
        zh: "「想」后接动词或动词短语，表示希望、打算；「要」在餐饮语境中可表示点选、想要，语气较直接，如「我要一杯茶」。\n\n「想吃」\nxiǎng chī",
        kr: "「想」「要」로 먹고 싶음·주문.",
        en: "想/要 express what you’d like.",
        jp: "「想」「要」で希望や注文。",
      },
      examples: [
        { zh: "你想吃点什么？", pinyin: "Nǐ xiǎng chī diǎnr shénme?", translation: tr("뭐 드실래요?", "What would you like to eat?", "何か召し上がりますか。") },
        { zh: "晚饭我想吃饺子。", pinyin: "Wǎnfàn wǒ xiǎng chī jiǎozi.", translation: tr("저녁엔 만두 먹고 싶어요.", "I want dumplings for dinner.", "夕食は餃子が食べたいです。") },
      ],
    },
    {
      pattern: "一日三餐",
      pinyin: "yī rì sān cān",
      hint: { zh: "早午晚", kr: "아·점·저", en: "meals", jp: "三餐" },
      explanation: {
        zh: "「早饭、午饭、晚饭」分别指一天中的三餐，可与「想吃什么」等搭配询问或说明某一餐的安排。\n\n「午饭」\nwǔfàn",
        kr: "「早饭」「午饭」「晚饭」로 끼니를 말합니다.",
        en: "早饭/午饭/晚饭 = breakfast/lunch/dinner.",
        jp: "朝・昼・夕の食事。",
      },
      examples: [
        { zh: "你午饭想吃什么？", pinyin: "Nǐ wǔfàn xiǎng chī shénme?", translation: tr("점심에 뭐 먹고 싶어?", "What do you want for lunch?", "昼ごはんは何が食べたい？") },
      ],
    },
    {
      pattern: "做饭",
      pinyin: "zuò fàn",
      hint: { zh: "料理", kr: "요리", en: "cook", jp: "料理" },
      explanation: {
        zh: "离合词「做饭」表示制作饭菜，可带宾语说明为谁或配合什么菜，如「我给你做面条儿和饺子吧」。\n\n「做饭」\nzuò fàn",
        kr: "「做饭」는 밥을 짓다.",
        en: "做饭 = cook (a meal).",
        jp: "「做饭」は料理を作る。",
      },
      examples: [
        { zh: "我给你做面条儿和饺子吧。", pinyin: "Wǒ gěi nǐ zuò miàntiáor hé jiǎozi ba.", translation: tr("면이랑 만두 해 줄게.", "I’ll make noodles and dumplings for you.", "麺と餃子を作るね。") },
      ],
    },
    {
      pattern: "一些",
      pinyin: "yīxiē",
      hint: { zh: "少量", kr: "조금", en: "some / a bit", jp: "少し" },
      explanation: {
        zh: "数量词「一些」表示不定量的少量，可修饰动词或名词性成分；「少做一些」意为数量上少做一点。\n\n「一些」\nyīxiē",
        kr: "「一些」는 양이 많지 않음.",
        en: "一些 = some; 少做一些 = make less.",
        jp: "「一些」は少し、「少做一些」は量を減らす。",
      },
      examples: [
        { zh: "少做一些。", pinyin: "Shǎo zuò yīxiē.", translation: tr("적게 해 주세요.", "Make a smaller amount.", "少なめに。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "我想吃包子。", pinyin: "Wǒ xiǎng chī bāozi.", translations: tr("만두 먹고 싶어요.", "I want buns.", "包子が食べたい。") },
        { zh: "晚饭吃什么？", pinyin: "Wǎnfàn chī shénme?", translations: tr("저녁에 뭐 먹을까?", "What’s for dinner?", "夕食は何にする？") },
        { zh: "我喜欢喝茶。", pinyin: "Wǒ xǐhuan hē chá.", translations: tr("차 마시는 걸 좋아해요.", "I like drinking tea.", "お茶を飲むのが好きです。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜饭店菜单", kr: "읽기｜메뉴판", en: "Reading | Menu", jp: "読み物｜メニュー" },
      sentences: [
        { zh: "包子 6元", pinyin: "bāozi liù yuán", translations: tr("만두 6위안", "Buns 6 yuan", "包子 6元") },
        { zh: "饺子 12元", pinyin: "jiǎozi shí'èr yuán", translations: tr("만두 12위안", "Dumplings 12 yuan", "餃子 12元") },
        { zh: "面条儿 15元", pinyin: "miàntiáor shíwǔ yuán", translations: tr("면 15위안", "Noodles 15 yuan", "麺 15元") },
        { zh: "米饭 2元", pinyin: "mǐfàn èr yuán", translations: tr("밥 2위안", "Rice 2 yuan", "ご飯 2元") },
        { zh: "茶 3元", pinyin: "chá sān yuán", translations: tr("차 3위안", "Tea 3 yuan", "お茶 3元") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l19_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: { cn: "下面哪一句在问「想吃什么」？", kr: "먹고 싶은 걸 묻는 말은?", en: "Which asks what you’d like to eat?", jp: "何が食べたいか聞いているのは？" },
      options: opt4(
        ["你想吃点什么？", "뭐 드실래요?", "What would you like to eat?", "何か召し上がりますか。"],
        ["你怎么去学校？", "학교 어떻게 가?", "How do you get to school?", "学校へどう行く？"],
        ["今天冷吗？", "추워요?", "Is it cold?", "寒い？"],
        ["你学习几个小时？", "몇 시간 공부?", "How many hours do you study?", "何時間勉強する？"]
      ),
      answer: "A",
      explanation: { cn: "「想……吃」询问饮食意愿。", kr: "「想吃」.", en: "想吃 asks food wishes.", jp: "「想吃」は食べたいもの。" },
    },
    {
      id: "hsk30_l19_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「饺子」的拼音是？", kr: "「饺子」의 병음은?", en: "What’s the pinyin for 饺子?", jp: "「饺子」のピンインは？" },
      options: pinOpts("jiǎozi", "jiāozi", "jiǎozhi", "jiàozi"),
      answer: "A",
      explanation: { cn: "「饺子」读作 jiǎozi。", kr: "「饺子」는 jiǎozi입니다.", en: "Say jiǎozi.", jp: "読みは jiǎozi です。" },
    },
    {
      id: "hsk30_l19_p3",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「少」的拼音是？",
        kr: "「少」의 병음은?",
        en: "What is the pinyin of 少?",
        jp: "「少」のピンインは？",
      },
      options: pinOpts("shǎo", "shào", "sǎo", "shāo"),
      answer: "A",
      explanation: {
        cn: "「少」读 shǎo。",
        kr: "「少」는 shǎo입니다.",
        en: "少 is read shǎo.",
        jp: "「少」は shǎo と読みます。",
      },
    },
    {
      id: "hsk30_l19_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在问「午饭想吃什么」？",
        kr: "「점심에 뭐 먹고 싶니」를 묻는 말은?",
        en: "Which line asks what you want for lunch?",
        jp: "「昼ごはんに何が食べたいか」を聞いているのは？",
      },
      options: opt4(
        ["你午饭想吃什么？", "점심에 뭐 먹고 싶어?", "What do you want for lunch?", "昼ごはんは何が食べたい？"],
        ["晚饭呢？", "저녁은?", "What about dinner?", "夕食は？"],
        ["有菜单吗？", "메뉴 있어?", "Is there a menu?", "メニューはある？"],
        ["给我三个包子吧。", "만두 세 개 주세요.", "Three buns, please.", "包子を三つください。"]
      ),
      answer: "A",
      explanation: {
        cn: "「午饭想吃什么」问午餐想吃的食物。",
        kr: "「午饭想吃什么」는 점심 메뉴를 묻습니다.",
        en: "午饭想吃什么 asks about lunch.",
        jp: "「午饭想吃什么」は昼食を尋ねます。",
      },
    },
  ],
  aiPractice: {
    speaking: ["你想吃点什么？", "这儿早饭有什么？", "我想吃米饭和菜。", "晚饭我想吃饺子。", "晚饭我想吃面条儿。", "我给你做面条儿和饺子吧。", "少做一些。"],
    chatPrompt: "请只用本课「包子、饺子、面包、水、鸡蛋、菜、菜单、饭、早饭、午饭、晚饭、做、做饭、想、要、面条儿、少、一些」等词语谈吃喝与三餐；不要写成问怎么去学校。",
    prompt: {
      zh: "请只用本课「包子、饺子、面包、水、鸡蛋、菜、菜单、饭、早饭、午饭、晚饭、做、做饭、想、要、面条儿、少、一些」等词语谈吃喝与三餐；不要写成问怎么去学校。",
      kr: "음식·끼니만. 통학은 빼 주세요.",
      en: "Food & meals only—no commuting.",
      jp: "食事だけ。通学は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l19_order",
          situation: { zh: "会话一：饭店", kr: "회화1 · 식당", en: "Dialogue 1", jp: "会話1" },
          aiRole: { zh: "饭店", kr: "식당", en: "Restaurant", jp: "店" },
          studentRole: { zh: "李明", kr: "리밍", en: "Li Ming", jp: "李明" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "你好，你想吃点什么？", pinyin: "Nǐ hǎo, nǐ xiǎng chī diǎnr shénme?", kr: "뭐 드실래요?", en: "What would you like?", jp: "何になさいますか。" },
            { zh: "给我三个包子吧。", pinyin: "Gěi wǒ sān ge bāozi ba.", kr: "만두 세 개 주세요.", en: "Three buns, please.", jp: "包子を三つください。" },
          ],
          rounds: [{ aiLine: "欢迎光临！", studentRefs: ["你想吃点什么？"], acceptable: ["你想吃点什么？"], closeAnswers: ["想", "吃"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「想/要」说想吃的食物。", pinyin: "xiǎng", kr: "먹고 싶음.", en: "Want food with 想/要.", jp: "「想」「要」で食べたいもの。" },
      { zh: "能分清早饭、午饭、晚饭。", pinyin: "zǎofàn", kr: "세 끼.", en: "Three meals.", jp: "三餐の言い方。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "能用「想/要」说三餐想吃什么，并说「做饭、少、一些」等。", pinyin: "xiǎng · yào · zuòfàn", kr: "「想」「要」로 끼니별로 먹고 싶은 것을 말하고 「做饭」「少」「一些」도 쓴다.", en: "Say what you want to eat with 想/要; use 做饭, 少, 一些.", jp: "「想」「要」で食べたいものを言い、「做饭」「少」「一些」も使える。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：早饭点餐。会话二：午晚餐意愿。会话三：妈妈做饭、少做一些。",
        kr: "아침 주문 → 끼니 → 요리·양.",
        en: "Breakfast · meals · cooking & amount.",
        jp: "朝食／昼夕／料理の量。",
      },
      scenarioSummaryLines: [{ zh: "「菜单」列出菜名与价格。", pinyin: "càidān", kr: "메뉴.", en: "Menu lists dishes.", jp: "「菜单」はメニュー。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「想」和「要」在饭店里语气一样吗？", kr: "「想」?", en: "想 vs 要 in a café?", jp: "「想」と「要」？" },
    freeAskExamples: { zh: ["「少做一些」能对朋友说吗？", "午饭和中午有什么区别？"], kr: ["「少做一些」?", "午饭?"], en: ["少做一些 to friends?", "午饭 vs 中午?"], jp: ["「少做一些」は友だちに？", "午饭？"] },
    coreExpressions: [
      {
        expr: "你想吃什么？ / 我想吃饺子。",
        pinyin: "Nǐ xiǎng chī shénme? / Wǒ xiǎng chī jiǎozi.",
        usage: { zh: "询问并表达想吃的食物。", kr: "먹고 싶은 것 묻고 답하기.", en: "Ask and say what you want to eat.", jp: "食べたいものを聞き、言う。" },
      },
    ],
  },
});

export const lesson20 = L(20, {
  title: {
    zh: "第20课｜我想买两件衣服",
    cn: "第20课｜我想买两件衣服",
    kr: "제20과｜옷 두 벌 사고 싶어요",
    en: "Lesson 20 | I Want to Buy Two Pieces of Clothing",
    jp: "第20課｜服を二枚買いたいです",
  },
  summary: {
    zh: "学习用「件」说衣物，用「多少钱」问价，用「穿」说穿着效果，并认识「不要、便宜」。",
    kr: "「件」「多少钱」「穿」「不要」「便宜」.",
    en: "件; 多少钱; 穿; 不要; 便宜.",
    jp: "「件」「多少钱」「穿」「不要」「便宜」。",
  },
  scene: {
    id: "hsk30_l20_scene",
    title: i4("买衣服", "옷 사기", "Buying clothes", "服を買う"),
    summary: i4(
      "会话一：问价五十元、一百元；会话二：想买那件、这件不要、穿着好看；会话三：一共一百、便宜到九十、找十元。",
      "가격 → 고르기·핏 → 흥정·거스름.",
      "Prices · choosing & fit · bargain & change.",
      "値段／選ぶ・似合い／値切りとおつり。",
    ),
  },
  objectives: [
    {
      zh: "能用「这件衣服多少钱？」「五十元」询问与说明价格",
      pinyin: "duōshao qián · yuán",
      kr: "가격을 묻고 답한다.",
      en: "Ask and state prices.",
      jp: "値段を尋ね、言う。",
    },
    {
      zh: "能用「那件你穿很好看」描述穿着效果，并听懂「找你十元」",
      pinyin: "chuān · zhǎo qián",
      kr: "입었을 때 모습·거스름 돈.",
      en: "穿 for how it looks; change at checkout.",
      jp: "「穿」とおつり。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜买衣服", kr: "회화 1｜옷 가게", en: "Dialogue 1 | Shopping", jp: "会話1｜買い物" },
      i4("问这件、那件各多少钱。", "이거·저거 가격.", "This one & that one—prices.", "これとあれの値段。"),
      [
        line("王美", "这件衣服多少钱？", "Zhè jiàn yīfu duōshao qián?", tr("이 옷 얼마예요?", "How much is this piece?", "この服いくら？")),
        line("店员", "五十元。", "Wǔshí yuán.", tr("50위안.", "Fifty yuan.", "50元。")),
        line("王美", "那件呢？", "Nà jiàn ne?", tr("저건요?", "And that one?", "あれは？")),
        line("店员", "那件一百元。", "Nà jiàn yībǎi yuán.", tr("저건 100위안.", "That one’s one hundred yuan.", "あちらは100元。")),
      ]
    ),
    card(
      { zh: "会话二｜做选择", kr: "회화 2｜고르기", en: "Dialogue 2 | Choosing", jp: "会話2｜選ぶ" },
      i4("想买那件、不要这件，觉得有点儿大，对方说那件穿着好看。", "저걸로·이건 패스·큼·핏.", "Want that—not this—a bit big—looks good on you.", "あれがいい／これは違う／大きい／似合う。"),
      [
        line("王美", "我想买那件。", "Wǒ xiǎng mǎi nà jiàn.", tr("저거 살래요.", "I want to buy that one.", "あれを買いたいです。")),
        line("汤姆", "这件不要吗？", "Zhè jiàn bù yào ma?", tr("이건 안 살 거예요?", "Not this one?", "これはいらない？")),
        line("王美", "不要，我觉得有一点儿大。", "Bù yào, wǒ juéde yǒu yìdiǎnr dà.", tr("아니요, 좀 큰 것 같아요.", "No—I think it’s a bit big.", "いいえ、少し大きい気がします。")),
        line("汤姆", "那件你穿很好看。", "Nà jiàn nǐ chuān hěn hǎokàn.", tr("저건 입으면 잘 어울려요.", "That one looks great on you.", "あれは似合いそう。")),
      ]
    ),
    card(
      { zh: "会话三｜付款找钱", kr: "회화 3｜결제", en: "Dialogue 3 | Paying", jp: "会話3｜会計" },
      i4("一共一百、还价到九十、付一百找十块。", "총액·깎기·거스름.", "Total—deal—change.", "合計・値切り・おつり。"),
      [
        line("店员", "一共一百元。", "Yīgòng yībǎi yuán.", tr("합계 100위안.", "One hundred yuan altogether.", "合計100元。")),
        line("王美", "能便宜一点儿吗？", "Néng piányi yìdiǎnr ma?", tr("좀 깎아 주실 수 있어요?", "Could you make it a bit cheaper?", "もう少し安くできますか。")),
        line("店员", "九十元吧。", "Jiǔshí yuán ba.", tr("90위안이요.", "Ninety yuan, then.", "90元にしましょう。")),
        line("王美", "给你一百元。", "Gěi nǐ yībǎi yuán.", tr("100위안 드릴게요.", "Here’s one hundred.", "100元どうぞ。")),
        line("店员", "找你十元。", "Zhǎo nǐ shí yuán.", tr("10위안 거스름.", "Ten yuan back.", "おつり10元。")),
        line("王美", "谢谢", "Xièxie", tr("감사합니다.", "Thanks.", "ありがとう。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "件",
      pinyin: "jiàn",
      hint: { zh: "衣物量词", kr: "벌", en: "piece (clothes)", jp: "枚・着" },
      explanation: {
        zh: "量词「件」常用于上衣、外套等衣物，如「这件衣服」「那件」。\n\n「这件」\nzhè jiàn",
        kr: "「件」는 옷을 세는 말.",
        en: "件 counts pieces of clothing.",
        jp: "「件」は服の数え方。",
      },
      examples: [
        { zh: "这件衣服多少钱？", pinyin: "Zhè jiàn yīfu duōshao qián?", translation: tr("이 옷 얼마예요?", "How much is this?", "この服いくら？") },
      ],
    },
    {
      pattern: "多少钱",
      pinyin: "duōshao qián",
      hint: { zh: "问价", kr: "가격", en: "how much", jp: "いくら" },
      explanation: {
        zh: "疑问短语「多少钱」用于询问价格，回答时常用「数词 + 元/块」等形式。\n\n「五十元」\nwǔshí yuán",
        kr: "「多少钱」로 가격을 묻습니다.",
        en: "多少钱? asks the price.",
        jp: "「多少钱」で値段を尋ねる。",
      },
      examples: [
        { zh: "这件衣服多少钱？", pinyin: "Zhè jiàn yīfu duōshao qián?", translation: tr("이 옷 얼마?", "How much is this piece?", "いくらですか。") },
      ],
    },
    {
      pattern: "不要",
      pinyin: "bù yào",
      hint: { zh: "否定选择", kr: "안 삼", en: "don’t want", jp: "いらない" },
      explanation: {
        zh: "否定副词「不」与「要」搭配，可表示拒绝、排除某一选项，如「这件不要吗？」「不要，我觉得有一点儿大。」\n\n「不要」\nbù yào",
        kr: "「不要」는 원하지 않음.",
        en: "不要 = don’t want / pass on this one.",
        jp: "「不要」はいらない。",
      },
      examples: [
        { zh: "这件不要吗？", pinyin: "Zhè jiàn bù yào ma?", translation: tr("이건 안 살 거예요?", "You don’t want this one?", "これはいらない？") },
      ],
    },
    {
      pattern: "穿",
      pinyin: "chuān",
      hint: { zh: "穿着", kr: "입다", en: "wear", jp: "着る" },
      explanation: {
        zh: "动词「穿」表示把衣物穿在身上，可用于评价穿着效果，如「那件你穿很好看」。\n\n「穿」\nchuān",
        kr: "「穿」는 입다·어울리다.",
        en: "穿 = wear; 穿很好看 = looks good on you.",
        jp: "「穿」は着る、似合う。",
      },
      examples: [
        { zh: "那件你穿很好看。", pinyin: "Nà jiàn nǐ chuān hěn hǎokàn.", translation: tr("저건 입으면 정말 잘 어울려요.", "That one looks great on you.", "あれはよく似合います。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "我想买两件衣服。", pinyin: "Wǒ xiǎng mǎi liǎng jiàn yīfu.", translations: tr("옷 두 벌 사고 싶어요.", "I want to buy two pieces.", "服を二枚買いたいです。") },
        { zh: "这件很便宜。", pinyin: "Zhè jiàn hěn piányi.", translations: tr("이건 아주 싸요.", "This one’s very cheap.", "これはとても安い。") },
        { zh: "那件我穿很好看。", pinyin: "Nà jiàn wǒ chuān hěn hǎokàn.", translations: tr("저건 제가 입으면 잘 어울려요.", "That one looks great on me.", "あれは私に似合います。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜服装店价签", kr: "읽기｜가격표", en: "Reading | Price tags", jp: "読み物｜値札" },
      sentences: [
        { zh: "这件衣服 90元", pinyin: "Zhè jiàn yīfu jiǔshí yuán", translations: tr("이 옷 90위안", "This one 90 yuan", "この服 90元") },
        { zh: "那件衣服 100元", pinyin: "Nà jiàn yīfu yībǎi yuán", translations: tr("저 옷 100위안", "That one 100 yuan", "あの服 100元") },
        { zh: "这件大", pinyin: "Zhè jiàn dà", translations: tr("이건 큼", "This one’s big", "これは大きい") },
        { zh: "那件小", pinyin: "Nà jiàn xiǎo", translations: tr("저건 작음", "That one’s small", "あれは小さい") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l20_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: { cn: "下面哪一句在问「衣服多少钱」？", kr: "옷값을 묻는 말은?", en: "Which asks the price of clothes?", jp: "服の値段を聞いているのは？" },
      options: opt4(
        ["这件衣服多少钱？", "이 옷 얼마?", "How much is this piece?", "この服いくら？"],
        ["今天天气怎么样？", "날씨?", "How’s the weather?", "天気は？"],
        ["你学习什么？", "뭐 공부?", "What do you study?", "何を勉強？"],
        ["你怎么去学校？", "학교 어떻게?", "How to school?", "学校へどう？"]
      ),
      answer: "A",
      explanation: { cn: "「多少钱」问价格。", kr: "가격 질문.", en: "多少钱 asks price.", jp: "値段の質問。" },
    },
    {
      id: "hsk30_l20_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「便宜」的拼音是？", kr: "「便宜」의 병음은?", en: "What’s the pinyin for 便宜?", jp: "「便宜」のピンインは？" },
      options: pinOpts("piányi", "piānyi", "piányí", "pianyí"),
      answer: "A",
      explanation: { cn: "「便宜」读作 piányi。", kr: "「便宜」는 piányi입니다.", en: "Say piányi.", jp: "読みは piányi です。" },
    },
    {
      id: "hsk30_l20_p3",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在说「穿起来好看」？",
        kr: "「입으면 잘 어울린다」를 말하는 문장은?",
        en: "Which line says it looks good on you when worn?",
        jp: "「着ると似合う」を言うのはどれ？",
      },
      options: opt4(
        ["那件你穿很好看。", "저건 입으면 잘 어울려요.", "That one looks great on you.", "あれはよく似合います。"],
        ["这件衣服多少钱？", "이 옷 얼마예요?", "How much is this?", "いくらですか。"],
        ["我想买那件。", "저거 살래요.", "I want to buy that one.", "あれを買いたい。"],
        ["不要，我觉得有一点儿大。", "안 살래요, 좀 커요.", "No—it’s a bit big.", "いいえ、少し大きいです。"]
      ),
      answer: "A",
      explanation: {
        cn: "「穿很好看」评价穿着效果。",
        kr: "「穿很好看」는 입었을 때 모습을 말합니다.",
        en: "穿很好看 comments on how it looks on you.",
        jp: "「穿很好看」は着たときの見え方です。",
      },
    },
    {
      id: "hsk30_l20_p4",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「找」（找你十元）中读作？",
        kr: "「找你十元」의 「找」 병음은?",
        en: "In 找你十元, the pinyin of 找 is?",
        jp: "「找你十元」の「找」は？",
      },
      options: pinOpts("zhǎo", "zhào", "zǎo", "zhāo"),
      answer: "A",
      explanation: {
        cn: "此处「找」读 zhǎo，表示找零。",
        kr: "여기서 「找」는 zhǎo로 거스름 돈을 뜻합니다.",
        en: "Here 找 is zhǎo (give change).",
        jp: "ここで「找」は zhǎo、おつりの意味です。",
      },
    },
  ],
  aiPractice: {
    speaking: ["这件衣服多少钱？", "五十元。", "我想买那件。", "这件不要吗？", "那件你穿很好看。", "能便宜一点儿吗？", "找你十元。"],
    chatPrompt: "请只用本课「件、衣服、多少、钱、元、块、卖、找、不要、便宜、百、千、穿」等词语谈买衣服与价格；不要写成问学习什么。",
    prompt: {
      zh: "请只用本课「件、衣服、多少、钱、元、块、卖、找、不要、便宜、百、千、穿」等词语谈买衣服与价格；不要写成问学习什么。",
      kr: "옷·가격만. 공부 이야기는 빼 주세요.",
      en: "Clothes & prices—no study talk.",
      jp: "服と値段だけ。勉強は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l20_shop",
          situation: { zh: "会话一：问价", kr: "회화1", en: "Dialogue 1", jp: "会話1" },
          aiRole: { zh: "店员", kr: "점원", en: "Clerk", jp: "店員" },
          studentRole: { zh: "王美", kr: "왕메이", en: "Wang Mei", jp: "王美" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "这件衣服多少钱？", pinyin: "Zhè jiàn yīfu duōshao qián?", kr: "이 옷 얼마?", en: "How much?", jp: "いくらですか。" },
            { zh: "五十元。", pinyin: "Wǔshí yuán.", kr: "50위안.", en: "Fifty yuan.", jp: "50元。" },
          ],
          rounds: [{ aiLine: "欢迎光临！", studentRefs: ["这件衣服多少钱？"], acceptable: ["这件衣服多少钱？"], closeAnswers: ["多少钱", "衣服"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「件」说衣服件数。", pinyin: "jiàn", kr: "옷 세기.", en: "件 for clothes.", jp: "「件」で服を数える。" },
      { zh: "能听懂「找你……元」是找零。", pinyin: "zhǎo", kr: "거스름.", en: "找你 = your change.", jp: "おつりの言い方。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "能问衣服价钱，说便宜贵、要不要，并理解「穿很好看」与找零用语。", pinyin: "duōshao qián · piányi · zhǎo", kr: "옷값을 묻고 싸다·비싸다·살지 말지를 말하며 「穿很好看」「找你…元」를 이해한다.", en: "Ask clothing prices; say cheap/expensive, want or not; get 穿很好看 and 找你…元.", jp: "服の値段を聞き、安い・高い・要る要らないを言い、「穿很好看」とおつりの言い方が分かる。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：问价。会话二：取舍与穿着。会话三：还价与找钱。",
        kr: "가격 → 선택·핏 → 흥정·거스름.",
        en: "Price · choose & fit · bargain & change.",
        jp: "値段／選ぶ／おつり。",
      },
      scenarioSummaryLines: [{ zh: "「百、千」可组成更大数目表示价格。", pinyin: "bǎi", kr: "큰 숫자.", en: "百/千 in prices.", jp: "「百」「千」。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「块」和「元」在口语里一样吗？", kr: "「块」?", en: "块 vs 元?", jp: "「块」と「元」？" },
    freeAskExamples: { zh: ["「不要」能单独回答问题吗？", "便宜一定是在讲价钱吗？"], kr: ["「不要」?", "便宜?"], en: ["Short 不要?", "Is 便宜 only about price?"], jp: ["「不要」だけで？", "「便宜」？"] },
    coreExpressions: [
      {
        expr: "这件衣服多少钱？ / 五十元。",
        pinyin: "Zhè jiàn yīfu duōshao qián? / Wǔshí yuán.",
        usage: { zh: "询问并回答衣物价格。", kr: "옷값 묻고 답하기.", en: "Ask and give clothing prices.", jp: "服の値段を聞き、答える。" },
      },
    ],
  },
});

export const lesson21 = L(21, {
  title: {
    zh: "第21课｜生病了",
    cn: "第21课｜生病了",
    kr: "제21과｜아파요",
    en: "Lesson 21 | Falling Ill",
    jp: "第21課｜病気になりました",
  },
  summary: {
    zh: "学习用「怎么了」关心状况，用「生病、看病」说就医，用「要、再、见」表达嘱咐与道别。",
    kr: "「怎么了」「生病」「看病」「要」「再」「见」.",
    en: "怎么了; 生病/看病; 要; 再; 见.",
    jp: "「怎么了」「生病」「看病」「要」「再」「见」。",
  },
  scene: {
    id: "hsk30_l21_scene",
    title: i4("生病与休息", "아픔·휴식", "Illness & rest", "病気と休息"),
    summary: i4(
      "会话一：不舒服、去医院；会话二：医生说要休息、好多了没事；会话三：睡一会儿、明天再来、再见。",
      "몸살·병원 → 진료·괜찮음 → 잠·내일.",
      "Feeling ill · hospital · better · rest & tomorrow.",
      "体調／病院／回復／休む。",
    ),
  },
  objectives: [
    {
      zh: "能用「你怎么了？」「我生病了」说明身体不适",
      pinyin: "zěnme le · shēngbìng",
      kr: "상태를 묻고 아프다고 말한다.",
      en: "Ask what’s wrong; say you’re ill.",
      jp: "「怎么了」「生病」で体調を言う。",
    },
    {
      zh: "能听懂「要多休息」「明天见」一类关心与道别",
      pinyin: "xiūxi · zàijiàn",
      kr: "휴식 권함·내일 봐.",
      en: "Rest advice; see you tomorrow.",
      jp: "休むよう言う／あいさつ。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜不舒服", kr: "회화 1｜몸이 안 좋을 때", en: "Dialogue 1 | Feeling ill", jp: "会話1｜具合が悪い" },
      i4("问怎么了，说生病了，提议一起去医院。", "어떻게 됐니·아픔·병원.", "What’s wrong—ill—hospital.", "どうした／病気／病院。"),
      [
        line("李明", "汤姆，你怎么了？", "Tāngmǔ, nǐ zěnme le?", tr("탐, 왜 그래?", "Tom, what’s wrong?", "トム、どうしたの？")),
        line("汤姆", "我生病了。", "Wǒ shēngbìng le.", tr("아파요.", "I’m sick.", "病気です。")),
        line("李明", "去医院看病了吗？", "Qù yīyuàn kànbìng le ma?", tr("병원 갔다 왔어?", "Have you been to the hospital?", "病院に行った？")),
        line("汤姆", "没有。", "Méiyǒu.", tr("아니요.", "No.", "いいえ。")),
        line("李明", "我和你去医院吧。", "Wǒ hé nǐ qù yīyuàn ba.", tr("같이 병원 가자.", "Let’s go together.", "一緒に病院に行こう。")),
        line("汤姆", "好的，谢谢。", "Hǎo de, xièxie.", tr("네, 고마워요.", "Okay—thanks.", "はい、ありがとう。")),
      ]
    ),
    card(
      { zh: "会话二｜询问病情", kr: "회화 2｜병문안", en: "Dialogue 2 | Checking in", jp: "会話2｜様子を聞く" },
      i4("问医生怎么说、现在怎么样，说好多了、没事。", "의사 말·괜찮음.", "Doctor said—feeling better.", "先生の話／大丈夫。"),
      [
        line("李明", "医生怎么说？", "Yīshēng zěnme shuō?", tr("의사는 뭐래?", "What did the doctor say?", "医者は何と？")),
        line("汤姆", "医生说要多休息。", "Yīshēng shuō yào duō xiūxi.", tr("푹 쉬래요.", "Rest more.", "たくさん休むようにと。")),
        line("李明", "你现在怎么样？", "Nǐ xiànzài zěnmeyàng?", tr("지금 좀 어때?", "How are you now?", "今どう？")),
        line("汤姆", "好多了，医生说没事。", "Hǎo duō le, yīshēng shuō méishì.", tr("많이 나았어요, 괜찮대요.", "Much better—the doctor says it’s fine.", "だいぶよくなりました、大丈夫だそうです。")),
      ]
    ),
    card(
      { zh: "会话三｜安慰病人", kr: "회화 3｜위로", en: "Dialogue 3 | Comfort", jp: "会話3｜見舞い" },
      i4("让多睡、说明天再来看、道别。", "잠·내일 다시·안녕.", "Sleep—come back tomorrow—bye.", "寝る／明日また／さようなら。"),
      [
        line("李明", "汤姆，你睡一会吧。", "Tāngmǔ, nǐ shuì yīhuìr ba.", tr("탐, 좀 자.", "Tom—get some sleep.", "トム、ちょっと寝な。")),
        line("汤姆", "我好多了。", "Wǒ hǎo duō le.", tr("많이 나았어요.", "I’m much better.", "だいぶよくなりました。")),
        line("李明", "要好好休息。我明天再来看你。", "Yào hǎohāo xiūxi. Wǒ míngtiān zài lái kàn nǐ.", tr("푹 쉬어. 내일 또 올게.", "Rest well—I’ll come again tomorrow.", "しっかり休んで。明日また来るね。")),
        line("汤姆", "好。谢谢。明天见。", "Hǎo. Xièxie. Míngtiān jiàn.", tr("네. 고마워요. 내일 봐요.", "Okay. Thanks. See you tomorrow.", "はい。ありがとう。明日ね。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "怎么了",
      pinyin: "zěnme le",
      hint: { zh: "问状况", kr: "왜", en: "what’s wrong", jp: "どうした" },
      explanation: {
        zh: "疑问短语「怎么了」用于询问对方身体、情绪或处境是否出现异常，如「你怎么了？」。\n\n「怎么了」\nzěnme le",
        kr: "「怎么了」로 이상 징후를 묻습니다.",
        en: "怎么了? = what’s wrong?",
        jp: "「怎么了」はどうしたか。",
      },
      examples: [
        { zh: "你怎么了？", pinyin: "Nǐ zěnme le?", translation: tr("왜 그래?", "What’s wrong?", "どうしたの？") },
      ],
    },
    {
      pattern: "生病 / 看病",
      pinyin: "shēngbìng / kànbìng",
      hint: { zh: "健康", kr: "아픔·진료", en: "ill / see a doctor", jp: "病気・診察" },
      explanation: {
        zh: "「生病」表示患病；「看病」为离合词，表示就医、看医生，如「去医院看病」。\n\n「生病」\nshēngbìng",
        kr: "「生病」는 아픔,「看病」는 진료받기.",
        en: "生病 = fall ill; 看病 = see a doctor.",
        jp: "「生病」は病気、「看病」は診てもらう。",
      },
      examples: [
        { zh: "我生病了。", pinyin: "Wǒ shēngbìng le.", translation: tr("아파요.", "I’m sick.", "病気です。") },
        { zh: "去医院看病了吗？", pinyin: "Qù yīyuàn kànbìng le ma?", translation: tr("병원 갔다 왔어?", "Did you go to the hospital?", "病院に行った？") },
      ],
    },
    {
      pattern: "要",
      pinyin: "yào",
      hint: { zh: "应当", kr: "~해야", en: "should / need to", jp: "必要" },
      explanation: {
        zh: "能愿动词「要」可表示应当、需要，如「要多休息」即建议或嘱咐多休息。\n\n「要多休息」\nyào duō xiūxi",
        kr: "「要」는 해야 할 것.",
        en: "要 = should / need to (here: rest more).",
        jp: "「要」はすべきこと。",
      },
      examples: [
        { zh: "医生说要多休息。", pinyin: "Yīshēng shuō yào duō xiūxi.", translation: tr("의사가 푹 쉬래요.", "The doctor said to rest more.", "医者はたくさん休むようにと言いました。") },
      ],
    },
    {
      pattern: "再",
      pinyin: "zài",
      hint: { zh: "又一次", kr: "다시", en: "again", jp: "また" },
      explanation: {
        zh: "副词「再」表示动作的重复或延续，如「我明天再来看你」意为来日再次探望。\n\n「再来」\nzài lái",
        kr: "「再」는 또, 다시.",
        en: "再 = again (come again tomorrow).",
        jp: "「再」はまた。",
      },
      examples: [
        { zh: "我明天再来看你。", pinyin: "Wǒ míngtiān zài lái kàn nǐ.", translation: tr("내일 또 보러 올게.", "I’ll come see you again tomorrow.", "明日また来るね。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "医生说要多睡觉。", pinyin: "Yīshēng shuō yào duō shuìjiào.", translations: tr("의사가 많이 자래요.", "The doctor said to sleep more.", "医者はよく寝るようにと言いました。") },
        { zh: "我现在没事了。", pinyin: "Wǒ xiànzài méishì le.", translations: tr("이제 괜찮아요.", "I’m fine now.", "もう大丈夫です。") },
        { zh: "明天见。", pinyin: "Míngtiān jiàn.", translations: tr("내일 봐요.", "See you tomorrow.", "また明日。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜医院提示", kr: "읽기｜병원 안내", en: "Reading | Hospital tips", jp: "読み物｜病院の注意" },
      sentences: [
        { zh: "多休息", pinyin: "duō xiūxi", translations: tr("푹 쉬기", "Rest more", "たくさん休む") },
        { zh: "多喝水", pinyin: "duō hē shuǐ", translations: tr("물 많이 마시기", "Drink plenty of water", "水をたくさん飲む") },
        { zh: "早点睡觉", pinyin: "zǎo diǎn shuìjiào", translations: tr("일찍 자기", "Sleep early", "早めに寝る") },
        { zh: "明天再来看病", pinyin: "míngtiān zài lái kànbìng", translations: tr("내일 다시 진료", "Come back to the clinic tomorrow", "明日また受診") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l21_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: { cn: "下面哪一句在问「身体出什么状况了」？", kr: "몸 상태를 묻는 말은?", en: "Which asks what’s wrong with someone?", jp: "体の様子を聞いているのは？" },
      options: opt4(
        ["你怎么了？", "왜 그래?", "What’s wrong?", "どうしたの？"],
        ["这件衣服多少钱？", "옷 얼마?", "How much is this?", "いくら？"],
        ["今天天气怎么样？", "날씨?", "How’s the weather?", "天気は？"],
        ["你想吃什么？", "뭐 먹을래?", "What do you want to eat?", "何が食べたい？"]
      ),
      answer: "A",
      explanation: { cn: "「怎么了」用于询问异常状况。", kr: "「怎么了」.", en: "怎么了 asks what happened.", jp: "「怎么了」は状況を尋ねる。" },
    },
    {
      id: "hsk30_l21_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「生病」的拼音是？", kr: "「生病」의 병음은?", en: "What’s the pinyin for 生病?", jp: "「生病」のピンインは？" },
      options: pinOpts("shēngbìng", "shēngbǐng", "shēnbìng", "shèngbìng"),
      answer: "A",
      explanation: { cn: "「生病」读作 shēngbìng。", kr: "「生病」는 shēngbìng입니다.", en: "Say shēngbìng.", jp: "読みは shēngbìng です。" },
    },
    {
      id: "hsk30_l21_p3",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「要」在「要多休息」中读作？",
        kr: "「要多休息」의 「要」 병음은?",
        en: "In 要多休息, the pinyin of 要 is?",
        jp: "「要多休息」の「要」は？",
      },
      options: pinOpts("yào", "yāo", "yǎo", "yáo"),
      answer: "A",
      explanation: {
        cn: "「要」读 yào。",
        kr: "「要」는 yào입니다.",
        en: "要 is read yào.",
        jp: "「要」は yào と読みます。",
      },
    },
    {
      id: "hsk30_l21_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句表示「明天再来探望」？",
        kr: "「내일 또 보러 온다」를 말하는 문장은?",
        en: "Which line says “I’ll come again tomorrow”?",
        jp: "「明日また来る」を言うのはどれ？",
      },
      options: opt4(
        ["我明天再来看你。", "내일 또 보러 올게.", "I’ll come see you again tomorrow.", "明日また来るね。"],
        ["你睡一会吧。", "좀 자.", "Get some sleep.", "ちょっと寝て。"],
        ["我和你去医院吧。", "병원 같이 가자.", "Let’s go to the hospital.", "一緒に病院に行こう。"],
        ["医生说要多休息。", "의사가 쉬래요.", "The doctor said to rest.", "医者は休めと言いました。"]
      ),
      answer: "A",
      explanation: {
        cn: "「明天再来」表示改日再来。",
        kr: "「明天再来」는 다음에 또 온다는 뜻입니다.",
        en: "明天再来 means coming again another time.",
        jp: "「明天再来」はまた来ることです。",
      },
    },
  ],
  aiPractice: {
    speaking: ["你怎么了？", "我生病了。", "去医院看病了吗？", "我和你去医院吧。", "医生怎么说？", "要多休息。", "好多了，医生说没事。", "你睡一会吧。", "明天见。"],
    chatPrompt: "请只用本课「病、生病、看病、医院、医生、睡、事、怎么、要、再、明天、见、没事」等词语谈生病与休息；不要写成买衣服问价。",
    prompt: {
      zh: "请只用本课「病、生病、看病、医院、医生、睡、事、怎么、要、再、明天、见、没事」等词语谈生病与休息；不要写成买衣服问价。",
      kr: "아픔·병원만. 쇼핑은 빼 주세요.",
      en: "Illness & rest—no shopping talk.",
      jp: "病気と休息だけ。買い物は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l21_ill",
          situation: { zh: "会话一：不舒服", kr: "회화1", en: "Dialogue 1", jp: "会話1" },
          aiRole: { zh: "李明", kr: "리밍", en: "Li Ming", jp: "李明" },
          studentRole: { zh: "汤姆", kr: "탐", en: "Tom", jp: "トム" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "你怎么了？", pinyin: "Nǐ zěnme le?", kr: "왜 그래?", en: "What’s wrong?", jp: "どうしたの？" },
            { zh: "我生病了。", pinyin: "Wǒ shēngbìng le.", kr: "아파요.", en: "I’m sick.", jp: "病気です。" },
          ],
          rounds: [{ aiLine: "我很担心你。", studentRefs: ["你怎么了？"], acceptable: ["你怎么了？"], closeAnswers: ["怎么", "了"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「怎么了」关心别人。", pinyin: "zěnme le", kr: "걱정 질문.", en: "Ask what’s wrong.", jp: "「怎么了」で気遣う。" },
      { zh: "能区分「生病」与「看病」。", pinyin: "shēngbìng", kr: "아픔 vs 진료.", en: "Be ill vs see a doctor.", jp: "病気と受診。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "能用「怎么了、生病、看病」说明身体不适，并听懂休息、明天见等嘱咐。", pinyin: "zěnme le · shēngbìng · xiūxi", kr: "「怎么了」「生病」「看病」로 몸 상태를 말하고 휴식·「明天见」 같은 당부를 듣고 이해한다.", en: "Say 怎么了, 生病, 看病; understand rest and 明天见.", jp: "「怎么了」「生病」「看病」で体調を言い、休む・「明天见」などの言葉が分かる。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：去医院。会话二：医嘱与好转。会话三：休息与明天见。",
        kr: "병원 → 진료 → 휴식·내일.",
        en: "Hospital · doctor · rest & goodbye.",
        jp: "病院／診察／休む。",
      },
      scenarioSummaryLines: [{ zh: "「没事」在此表示没有大碍。", pinyin: "méishì", kr: "괜찮음.", en: "没事 = it’s fine.", jp: "「没事」は大丈夫。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「看病」能拆开说「看了病」吗？", kr: "「看病」?", en: "Separating 看病?", jp: "「看病」は？" },
    freeAskExamples: { zh: ["「睡一会」的「一会」大概多长？", "「再见」和「明天见」语气一样吗？"], kr: ["「一会」?", "再见?"], en: ["How long is 一会?", "再见 vs 明天见?"], jp: ["「一会」は？", "「再见」？"] },
    coreExpressions: [
      {
        expr: "你怎么了？ / 我生病了。",
        pinyin: "Nǐ zěnme le? / Wǒ shēngbìng le.",
        usage: { zh: "关心并说明身体不适。", kr: "문제 묻고 아픔 말하기.", en: "Care and say you’re ill.", jp: "様子を聞き、病気と言う。" },
      },
    ],
  },
});

export const lesson22 = L(22, {
  title: {
    zh: "第22课｜工作与生活",
    cn: "第22课｜工作与生活",
    kr: "제22과｜일과 생활",
    en: "Lesson 22 | Work and Life",
    jp: "第22課｜仕事と生活",
  },
  summary: {
    zh: "学习用「去年、明年、第」说时间次序，用「工作、公司、忙」谈职场，并认识「先生、女士」等称呼。",
    kr: "시간 표현·직장·호칭.",
    en: "Time words; work; titles.",
    jp: "時の言い方、仕事、敬称。",
  },
  scene: {
    id: "hsk30_l22_scene",
    title: i4("上班与日常", "출근·일상", "Work & daily life", "出勤と日常"),
    summary: i4(
      "会话一：来中国多久、工作日与学汉语、想家与父母明年来看；会话二：在哪儿上班、忙不忙；会话三：公司问候、同事是不是男朋友。",
      "중국 체류·일·가족 → 직장·바쁨 → 동료·친구.",
      "China stay & family · office life · colleagues.",
      "滞在と家族／職場／同僚。",
    ),
  },
  objectives: [
    {
      zh: "能用「去年、明年」「第……年」说明来华时间与计划",
      pinyin: "qùnián · míngnián · dì",
      kr: "시간·차수 표현.",
      en: "Last/next year; which year.",
      jp: "去年・明年・第。",
    },
    {
      zh: "能用「在哪儿工作」「很忙」谈论工作，并得体使用「先生、女士」",
      pinyin: "gōngzuò · xiānsheng · nǚshì",
      kr: "직장·바쁨·호칭.",
      en: "Workplace; busy; Mr./Ms.",
      jp: "仕事と敬称。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜在中国工作", kr: "회화 1｜중국에서 일", en: "Dialogue 1 | Working in China", jp: "会話1｜中国で働く" },
      i4("什么时候来中国、第几年、上班与学汉语、想家与父母明年来看。", "언제·몇 년째·일정·가족.", "When—year count—schedule—family.", "いつ・何年目・予定・家族。"),
      [
        line("李明", "安娜，你什么时候来中国的？", "Ānnà, nǐ shénme shíhou lái Zhōngguó de?", tr("안나, 언제 중국 왔어?", "Anna, when did you come to China?", "アンナさん、いつ中国に来ましたか。")),
        line("安娜", "我去年来的。现在是第二年。", "Wǒ qùnián lái de. Xiànzài shì dì èr nián.", tr("작년에 왔어요. 지금 2년째예요.", "Last year—this is my second year.", "去年来ました。今が二年目です。")),
        line("李明", "你在中国工作吗？", "Nǐ zài Zhōngguó gōngzuò ma?", tr("중국에서 일해요?", "Do you work in China?", "中国でお仕事を？")),
        line("安娜", "是的，我星期一到星期六工作。", "Shì de, wǒ Xīngqī yī dào Xīngqīliù gōngzuò.", tr("네, 월~토에 일해요.", "Yes—Monday through Saturday.", "ええ、月曜から土曜まで働いています。")),
        line("李明", "星期天呢？", "Xīngqītiān ne?", tr("일요일은?", "And Sunday?", "日曜は？")),
        line("安娜", "星期天去学校学习汉语。", "Xīngqītiān qù xuéxiào xuéxí Hànyǔ.", tr("일요일엔 학교 가서 중국어 공부해요.", "Sundays I go to school for Chinese.", "日曜は学校で中国語を勉強します。")),
        line("李明", "你想家吗？", "Nǐ xiǎng jiā ma?", tr("가족 보고 싶어요?", "Do you miss home?", "ご家族が恋しい？")),
        line("安娜", "想，我很爱爸爸妈妈。", "Xiǎng, wǒ hěn ài bàba māma.", tr("보고 싶어요, 부모님 정말 사랑해요.", "Yes—I love my parents.", "ええ、両親のことが大好きです。")),
        line("李明", "你不回国看爸爸妈妈吗？", "Nǐ bù huí guó kàn bàba māma ma?", tr("본국에 안 가고 부모님 안 뵈러 가요?", "Won’t you go home to see them?", "ご両親に会いに帰りませんか。")),
        line("安娜", "明年爸爸妈妈来中国看我。", "Míngnián bàba māma lái Zhōngguó kàn wǒ.", tr("내년에 부모님이 중국으로 오셔요.", "Next year they’ll come to China to see me.", "来年、両親が中国に会いに来ます。")),
      ]
    ),
    card(
      { zh: "会话二｜工作情况", kr: "회화 2｜직장", en: "Dialogue 2 | The job", jp: "会話2｜仕事" },
      i4("在哪儿上班、忙不忙、喜不喜欢现在的工作。", "근무지·바쁨·만족.", "Where—busy—like it?", "どこ／忙しいか／好きか。"),
      [
        line("王美", "你在哪儿工作？", "Nǐ zài nǎr gōngzuò?", tr("어디서 일해요?", "Where do you work?", "どこで働いてますか。")),
        line("安娜", "我在公司上班。", "Wǒ zài gōngsī shàngbān.", tr("회사 다녀요.", "At a company.", "会社に勤めています。")),
        line("王美", "公司里忙吗？", "Gōngsī lǐ máng ma?", tr("회사 바빠요?", "Is it busy there?", "会社は忙しい？")),
        line("安娜", "很忙。", "Hěn máng.", tr("많이 바빠요.", "Very busy.", "とても忙しいです。")),
        line("王美", "你喜欢现在的工作吗？", "Nǐ xǐhuan xiànzài de gōngzuò ma?", tr("지금 일 좋아해요?", "Do you like your job?", "今の仕事は好き？")),
        line("安娜", "不太喜欢，太忙了。", "Bú tài xǐhuan, tài máng le.", tr("별로예요, 너무 바빠서요.", "Not really—it’s too busy.", "あまり好きじゃないです、忙しすぎて。")),
      ]
    ),
    card(
      { zh: "会话三｜认识同事", kr: "회화 3｜동료", en: "Dialogue 3 | Colleagues", jp: "会話3｜同僚" },
      i4("在公司问候新人，问认不认识说话的先生，是不是男朋友，说是大学同学、只是朋友。", "신입·아는 사이·남자 친구 아님.", "New colleague—know that man—not dating.", "新人／知り合い／友だち。"),
      [
        line("李明", "女士，你好，你是新来公司的吗？", "Nǚshì, nǐ hǎo, nǐ shì xīn lái gōngsī de ma?", tr("안녕하세요, 신입이세요?", "Hello—are you new here?", "こんにちは、新しく入られた方ですか。")),
        line("安娜", "是的，我是新来的。", "Shì de, wǒ shì xīn lái de.", tr("네, 신입이에요.", "Yes—I’m new.", "はい、新人です。")),
        line("李明", "你认识和你说话的先生吗？", "Nǐ rènshi hé nǐ shuōhuà de xiānsheng ma?", tr("아까 말씀하신 남자 분 아세요?", "Do you know the gentleman you were talking to?", "お話ししていた男性を知っていますか。")),
        line("安娜", "认识，他是我的大学同学。", "Rènshi, tā shì wǒ de dàxué tóngxué.", tr("알아요, 대학 동기예요.", "Yes—he’s a college classmate.", "ええ、大学の同学です。")),
        line("李明", "他是你男朋友吗？", "Tā shì nǐ nánpéngyou ma?", tr("남자 친구예요?", "Is he your boyfriend?", "彼氏ですか。")),
        line("安娜", "不是，我们只是朋友。", "Bù shì, wǒmen zhǐ shì péngyou.", tr("아니요, 그냥 친구예요.", "No—we’re just friends.", "いいえ、友だちです。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "去年 / 明年",
      pinyin: "qùnián / míngnián",
      hint: { zh: "相对年份", kr: "작년·내년", en: "last / next year", jp: "去年・来年" },
      explanation: {
        zh: "时间名词「去年」指说话时的上一年，「明年」指下一年，可与「来、去、看」等搭配说明行程，如「我去年来的」「明年爸爸妈妈来看我」。\n\n「去年」\nqùnián",
        kr: "「去年」「明年」로 시점을 말합니다.",
        en: "去年 = last year; 明年 = next year.",
        jp: "「去年」「明年」で時。",
      },
      examples: [
        { zh: "我去年来的。", pinyin: "Wǒ qùnián lái de.", translation: tr("작년에 왔어요.", "I came last year.", "去年来ました。") },
        { zh: "明年爸爸妈妈来中国看我。", pinyin: "Míngnián bàba māma lái Zhōngguó kàn wǒ.", translation: tr("내년에 부모님이 날 보러 오셔요.", "Next year my parents will visit me in China.", "来年、両親が会いに来ます。") },
      ],
    },
    {
      pattern: "第 + 数词",
      pinyin: "dì + shùcí",
      hint: { zh: "次序", kr: "번째", en: "ordinal", jp: "第～" },
      explanation: {
        zh: "前缀「第」与数词结合构成序数，用于排序或计时，如「第二年」表示第二个年份。\n\n「第二」\ndì èr",
        kr: "「第」는 서수.",
        en: "第 + number = ordinal (第二年 = second year).",
        jp: "「第」は順序。",
      },
      examples: [
        { zh: "现在是第二年。", pinyin: "Xiànzài shì dì èr nián.", translation: tr("지금 2년째예요.", "This is the second year.", "今が二年目です。") },
      ],
    },
    {
      pattern: "在 + 地点 + 工作",
      pinyin: "zài + dìdiǎn + gōngzuò",
      hint: { zh: "就职处所", kr: "근무지", en: "work at", jp: "勤務先" },
      explanation: {
        zh: "介词短语「在……」引出动作发生的处所，与「工作」「上班」搭配说明工作地点，如「我在公司上班」。\n\n「在公司」\nzài gōngsī",
        kr: "「在 … 工作/上班」로 근무지.",
        en: "在 + place + 工作/上班 = work at…",
        jp: "「在…工作／上班」。",
      },
      examples: [
        { zh: "我在公司上班。", pinyin: "Wǒ zài gōngsī shàngbān.", translation: tr("회사 다녀요.", "I work at a company.", "会社に勤めています。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "我很爱我的家人。", pinyin: "Wǒ hěn ài wǒ de jiārén.", translations: tr("가족을 정말 사랑해요.", "I love my family.", "家族をとても愛しています。") },
        { zh: "大家都很忙。", pinyin: "Dàjiā dōu hěn máng.", translations: tr("다들 바빠요.", "Everyone’s busy.", "みんな忙しいです。") },
        { zh: "先生，您好。", pinyin: "Xiānsheng, nín hǎo.", translations: tr("선생님, 안녕하세요.", "Hello, sir.", "先生、こんにちは。") },
        { zh: "女士，您好。", pinyin: "Nǚshì, nín hǎo.", translations: tr("아가씨, 안녕하세요.", "Hello, ma’am.", "女士、こんにちは。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜工作信息卡", kr: "읽기｜근무 카드", en: "Reading | Work card", jp: "読み物｜勤務カード" },
      sentences: [
        { zh: "姓名：安娜", pinyin: "Xìngmíng: Ānnà", translations: tr("이름: 안나", "Name: Anna", "氏名：アンナ") },
        { zh: "工作：公司职员", pinyin: "Gōngzuò: gōngsī zhíyuán", translations: tr("직업: 회사원", "Job: office staff", "職業：会社員") },
        { zh: "地点：中国", pinyin: "Dìdiǎn: Zhōngguó", translations: tr("근무지: 중국", "Location: China", "勤務地：中国") },
        { zh: "时间：白天上班", pinyin: "Shíjiān: báitiān shàngbān", translations: tr("시간: 낮 근무", "Hours: daytime work", "時間：昼間勤務") },
        { zh: "星期天学习汉语", pinyin: "Xīngqītiān xuéxí Hànyǔ", translations: tr("일요일: 중국어 공부", "Sunday: study Chinese", "日曜：中国語の勉強") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l22_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: { cn: "下面哪一句里的时间与「下一年」最接近？", kr: "「다음 해」에 가까운 말은?", en: "Which is closest to “next year”?", jp: "「来年」にいちばん近いのは？" },
      options: opt4(
        ["明年爸爸妈妈来中国看我。", "내년에 부모님이", "Next year my parents…", "来年、両親が…"],
        ["去年我来的。", "작년에 왔다", "I came last year", "去年来た"],
        ["今天很忙。", "오늘 바쁘다", "Busy today", "今日は忙しい"],
        ["下个星期五回来。", "다음 주 금요일", "Back next Friday", "来週の金曜に帰る"]
      ),
      answer: "A",
      explanation: { cn: "「明年」指即将到来的下一年。", kr: "「明年」.", en: "明年 = next year.", jp: "「明年」は来年。" },
    },
    {
      id: "hsk30_l22_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「工作」的拼音是？", kr: "「工作」의 병음은?", en: "What’s the pinyin for 工作?", jp: "「工作」のピンインは？" },
      options: pinOpts("gōngzuò", "gòngzuò", "gōngzhuò", "gōngzùo"),
      answer: "A",
      explanation: { cn: "「工作」读作 gōngzuò。", kr: "「工作」는 gōngzuò입니다.", en: "Say gōngzuò.", jp: "読みは gōngzuò です。" },
    },
    {
      id: "hsk30_l22_p3",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「第」的拼音是？",
        kr: "「第」의 병음은?",
        en: "What is the pinyin of 第?",
        jp: "「第」のピンインは？",
      },
      options: pinOpts("dì", "dí", "dī", "de"),
      answer: "A",
      explanation: {
        cn: "「第」读 dì。",
        kr: "「第」는 dì입니다.",
        en: "第 is read dì.",
        jp: "「第」は dì と読みます。",
      },
    },
    {
      id: "hsk30_l22_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句是礼貌称呼女性听者？",
        kr: "여성에게 공손하게 부를 때 맞는 말은?",
        en: "Which line is a polite way to address a woman?",
        jp: "女性に丁寧に呼びかけるのはどれ？",
      },
      options: opt4(
        ["女士，你好。", "아가씨, 안녕하세요.", "Hello, ma’am.", "女士、こんにちは。"],
        ["先生，你好。", "선생님, 안녕하세요.", "Hello, sir.", "先生、こんにちは。"],
        ["你是新来的吗？", "신입이에요?", "Are you new?", "新しい方ですか。"],
        ["你在哪儿工作？", "어디서 일해요?", "Where do you work?", "どこで働いてますか。"]
      ),
      answer: "A",
      explanation: {
        cn: "「女士」用于礼貌称呼女性。",
        kr: "「女士」는 여성에게 공손히 부를 때 씁니다.",
        en: "女士 politely addresses a woman.",
        jp: "「女士」は女性への敬称です。",
      },
    },
  ],
  aiPractice: {
    speaking: ["你什么时候来中国的？", "我去年来的。", "你在中国工作吗？", "我在公司上班。", "公司里忙吗？", "你想家吗？", "明年爸爸妈妈来中国看我。", "女士，你好。", "我们只是朋友。"],
    chatPrompt: "请只用本课「年、去年、明年、第、回、知道、工作、公司、忙、爱、男、女、女士、先生、说话、大家、家人、男朋友」等词语谈工作与日常；不要写成问生病吃药。",
    prompt: {
      zh: "请只用本课「年、去年、明年、第、回、知道、工作、公司、忙、爱、男、女、女士、先生、说话、大家、家人、男朋友」等词语谈工作与日常；不要写成问生病吃药。",
      kr: "직장·가족만. 병·약은 빼 주세요.",
      en: "Work & life—no illness talk.",
      jp: "仕事と日常だけ。病気は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l22_work",
          situation: { zh: "会话二：工作情况", kr: "회화2", en: "Dialogue 2", jp: "会話2" },
          aiRole: { zh: "王美", kr: "왕메이", en: "Wang Mei", jp: "王美" },
          studentRole: { zh: "安娜", kr: "안나", en: "Anna", jp: "安娜" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "你在哪儿工作？", pinyin: "Nǐ zài nǎr gōngzuò?", kr: "어디서 일해?", en: "Where do you work?", jp: "どこで働いてますか。" },
            { zh: "我在公司上班。", pinyin: "Wǒ zài gōngsī shàngbān.", kr: "회사 다녀요.", en: "At a company.", jp: "会社です。" },
          ],
          rounds: [{ aiLine: "最近好吗？", studentRefs: ["你在哪儿工作？"], acceptable: ["你在哪儿工作？"], closeAnswers: ["工作", "哪儿"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「去年、明年」说相对年份。", pinyin: "qùnián", kr: "상대적 연도.", en: "Last/next year.", jp: "去年・明年。" },
      { zh: "能在职场情景使用「先生、女士」。", pinyin: "xiānsheng", kr: "호칭.", en: "Polite titles.", jp: "「先生」「女士」。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "能说去年明年、工作公司与忙闲，并在职场情景用「先生、女士」问候。", pinyin: "qùnián · míngnián · gōngzuò", kr: "작년·내년·회사·바쁨을 말하고 직장에서 「先生」「女士」로 인사한다.", en: "Say last/next year, company work, busy; greet with 先生 and 女士 at work.", jp: "去年・来年・会社と忙しさを言い、職場で「先生」「女士」であいさつできる。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：来华时间与家庭。会话二：公司与忙闲。会话三：同事与朋友。",
        kr: "시간·가족 → 회사 → 동료.",
        en: "Timeline & family · office · colleagues.",
        jp: "来日／会社／同僚。",
      },
      scenarioSummaryLines: [{ zh: "「大家」可指在场或所说的所有人。", pinyin: "dàjiā", kr: "모두.", en: "大家 = everyone.", jp: "「大家」はみんな。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「男朋友」一定指恋爱对象吗？", kr: "「男朋友」?", en: "男朋友 always romantic?", jp: "「男朋友」は？" },
    freeAskExamples: { zh: ["「回国」的「回」和「再见」有关吗？", "忙可以说成很忙很忙吗？"], kr: ["回国?", "很忙?"], en: ["回国 vs 回?", "很忙 twice?"], jp: ["「回国」？", "很忙？"] },
    coreExpressions: [
      {
        expr: "你在哪儿工作？ / 我在公司上班。",
        pinyin: "Nǐ zài nǎr gōngzuò? / Wǒ zài gōngsī shàngbān.",
        usage: { zh: "询问并说明工作单位。", kr: "근무지 묻고 답하기.", en: "Ask and say where you work.", jp: "勤務先を聞き、言う。" },
      },
    ],
  },
});
