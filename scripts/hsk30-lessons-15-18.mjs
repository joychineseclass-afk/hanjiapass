import { L, tr, i4, line, card, opt4, pinOpts } from "./lib/hsk30-lesson-build.mjs";

export const lesson15 = L(15, {
  title: {
    zh: "第15课｜你给谁打电话？",
    cn: "第15课｜你给谁打电话？",
    kr: "제15과｜누구에게 전화해요?",
    en: "Lesson 15 | Who Are You Calling?",
    jp: "第15課｜だれに電話しますか。",
  },
  summary: {
    zh: "学习用「给……打电话」说明通话对象，用「看一下」表示短动作，掌握电话用语「喂」与询问号码。",
    kr: "「给 … 打电话」로 상대를 말하고 「看一下」로 잠깐 확인, 「喂」·번호 묻기.",
    en: "给…打电话 for who you ring; 看一下 for a quick check; 喂 on the phone.",
    jp: "「给…打电话」、「看一下」、「喂」、番号の尋ね方。",
  },
  scene: {
    id: "hsk30_l15_scene",
    title: i4("电话与号码", "전화·번호", "Calls & numbers", "電話と番号"),
    summary: i4(
      "会话一：喂、有没有时间、要老师号码；会话二：给谁打、问什么；会话三：看见老师了吗、打电话问号码。",
      "회화1 안부·시간·선생 번호 → 회화2 누구에게·무엇을 → 회화3 보였는지·전화.",
      "Greetings & time · who you’re calling · spotting the teacher & numbers.",
      "あいさつ／相手／先生を見たか・番号。"
    ),
  },
  objectives: [
    {
      zh: "能用「你给谁打电话？」「我给同学打电话」说明通话对象",
      pinyin: "gěi · dǎ diànhuà",
      kr: "「给谁」「给同学打电话」로 누구와 통화하는지 말한다.",
      en: "Say who you’re calling with 给…打电话.",
      jp: "「给谁」「给同学打电话」で相手を言える。",
    },
    {
      zh: "能听懂「我看一下」表示稍查一下，并询问、说出电话号码",
      pinyin: "yíxià · diànhuà hàomǎ",
      kr: "「看一下」로 잠깐 확인, 번호를 묻고 말한다.",
      en: "Get 看一下 as “let me check”; ask and give phone numbers.",
      jp: "「看一下」と電話番号のやり取り。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜打电话", kr: "회화 1｜전화", en: "Dialogue 1 | On the phone", jp: "会話1｜電話" },
      i4("自报姓名、问有没有时间，向对方要王老师的电话号码。", "이름·시간 확인 후 왕 선생 번호를 부탁.", "Name, time—then asking for Teacher Wang’s number.", "名前と時間、王先生の番号。"),
      [
        line("李明", "喂，你好！", "Wèi, nǐ hǎo!", tr("여보세요, 안녕하세요!", "Hello!", "もしもし、こんにちは！")),
        line("王美", "你好！", "Nǐ hǎo!", tr("안녕하세요!", "Hi!", "こんにちは！")),
        line("李明", "我是李明。你现在有时间吗？", "Wǒ shì Lǐ Míng. Nǐ xiànzài yǒu shíjiān ma?", tr("저 리밍이에요. 지금 시간 있어요?", "This is Li Ming. Do you have a moment?", "李明です。今お時間ありますか。")),
        line("王美", "有，你有什么事吗？", "Yǒu, nǐ yǒu shénme shì ma?", tr("있어요, 무슨 일이에요?", "Yes—what’s up?", "はい、どうしました？")),
        line("李明", "你有王老师的电话号码吗？", "Nǐ yǒu Wáng lǎoshī de diànhuà hàomǎ ma?", tr("왕 선생님 전화번호 알아요?", "Do you have Teacher Wang’s phone number?", "王先生の電話番号を知っていますか。")),
        line("王美", "有，我看一下。", "Yǒu, wǒ kàn yíxià.", tr("있어요, 잠깐 볼게요.", "Yes—hang on, let me check.", "あります、ちょっと見ます。")),
      ]
    ),
    card(
      { zh: "会话二｜问给谁打电话", kr: "회화 2｜누구에게", en: "Dialogue 2 | Who you’re calling", jp: "会話2｜だれに" },
      i4("妈妈问给谁打电话、问什么，李明说是问老师号码。", "엄마가 누구·무엇을 묻고, 선생 번호를 묻는다고 답함.", "Mom asks who and what; Li Ming explains.", "母が相手と用件、先生の番号を聞くと答える。"),
      [
        line("妈妈", "你给谁打电话？", "Nǐ gěi shéi dǎ diànhuà?", tr("누구한테 전화해?", "Who are you calling?", "だれに電話してるの？")),
        line("李明", "我给同学打电话。", "Wǒ gěi tóngxué dǎ diànhuà.", tr("동기한테 전화해요.", "I’m calling a classmate.", "同学に電話してます。")),
        line("妈妈", "你问什么？", "Nǐ wèn shénme?", tr("뭘 물어봐?", "What are you asking?", "何を聞いてるの？")),
        line("李明", "我问他老师的电话号码是多少。", "Wǒ wèn tā lǎoshī de diànhuà hàomǎ shì duōshao.", tr("선생님 전화번호가 몇 번인지 물어봐요.", "I’m asking what the teacher’s number is.", "先生の電話番号を聞いてます。")),
      ]
    ),
    card(
      { zh: "会话三｜找老师", kr: "회화 3｜선생님 찾기", en: "Dialogue 3 | Finding the teacher", jp: "会話3｜先生を探す" },
      i4("有没有看见王老师、有事、建议打电话并说出手机号码。", "본 적 있나·할 일·전화하라고 하고 번호를 말함.", "Seen Wang?—a question—call him—read the number.", "見たか・用件・電話を促し、番号。"),
      [
        line("汤姆", "你看见王老师了吗？", "Nǐ kànjiàn Wáng lǎoshī le ma?", tr("왕 선생님 봤어요?", "Have you seen Teacher Wang?", "王先生を見ましたか。")),
        line("李明", "没有。你有事吗？", "Méiyǒu. Nǐ yǒu shì ma?", tr("아니요. 무슨 일 있어요?", "No. Need something?", "いいえ。用件ですか。")),
        line("汤姆", "我有一个问题。", "Wǒ yǒu yí ge wèntí.", tr("질문이 하나 있어요.", "I have a question.", "質問があります。")),
        line("李明", "你给王老师打电话吧。", "Nǐ gěi Wáng lǎoshī dǎ diànhuà ba.", tr("왕 선생님께 전화해 보세요.", "Give Teacher Wang a call.", "王先生に電話してみてください。")),
        line("汤姆", "王老师的手机号码是多少？", "Wáng lǎoshī de shǒujī hàomǎ shì duōshao?", tr("왕 선생님 휴대폰 번호가 뭐예요?", "What’s Teacher Wang’s mobile number?", "王先生の携帯番号は？")),
        line("李明", "王老师的手机号码是123-1234-5678", "Wáng lǎoshī de shǒujī hàomǎ shì yāo èr sān yāo èr sān sì wǔ liù qī bā.", tr("왕 선생님 번호는 123-1234-5678이에요.", "It’s 123-1234-5678.", "123-1234-5678 です。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "给 + 人 + 打电话",
      pinyin: "gěi + rén + dǎ diànhuà",
      hint: { zh: "打给谁", kr: "통화 상대", en: "who you call", jp: "相手" },
      explanation: {
        zh: "介词「给」引出动作的接受者，与「打电话」搭配表示打电话给某人，如「我给同学打电话」「你给王老师打电话吧」。\n\n「给同学打电话」\ngěi tóngxué dǎ diànhuà",
        kr: "「给」는 받는 사람—「给 … 打电话」로 누구에게 전화한다고 말합니다.",
        en: "给 marks who receives the action—给…打电话 = call someone.",
        jp: "「给」は相手、「给…打电话」で電話する相手を示す。",
      },
      examples: [
        { zh: "我给同学打电话。", pinyin: "Wǒ gěi tóngxué dǎ diànhuà.", translation: tr("동기한테 전화해요.", "I’m calling a classmate.", "同学に電話します。") },
        { zh: "你给王老师打电话吧。", pinyin: "Nǐ gěi Wáng lǎoshī dǎ diànhuà ba.", translation: tr("왕 선생님께 전화해 보세요.", "Call Teacher Wang.", "王先生に電話してみて。") },
      ],
    },
    {
      pattern: "一下",
      pinyin: "yíxià",
      hint: { zh: "短时尝试", kr: "잠깐", en: "a quick bit", jp: "ちょっと" },
      explanation: {
        zh: "数量补语「一下」附在动词后，常表示动作短暂或尝试，如「我看一下」意为稍查看、确认。\n\n「看一下」\nkàn yíxià",
        kr: "「一下」는 잠깐—「看一下」는 잠깐 본다는 뜻이에요.",
        en: "一下 makes it quick—看一下 ≈ “let me take a look.”",
        jp: "「一下」は短い動作、「看一下」はちょっと見る。",
      },
      examples: [
        { zh: "有，我看一下。", pinyin: "Yǒu, wǒ kàn yíxià.", translation: tr("있어요, 잠깐 볼게요.", "Sure—let me check.", "あります、ちょっと見ます。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "喂，你好！", pinyin: "Wèi, nǐ hǎo!", translations: tr("여보세요!", "Hello! (on the phone)", "もしもし、こんにちは！") },
        { zh: "你现在有时间吗？", pinyin: "Nǐ xiànzài yǒu shíjiān ma?", translations: tr("지금 시간 있어요?", "Do you have time now?", "今お時間ありますか。") },
        { zh: "我有一个问题。", pinyin: "Wǒ yǒu yí ge wèntí.", translations: tr("질문이 하나 있어요.", "I have a question.", "質問があります。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜电话记录", kr: "읽기｜전화 목록", en: "Reading | Numbers on file", jp: "読み物｜電話メモ" },
      sentences: [
        { zh: "王老师：138-0123-4567", pinyin: "Wáng lǎoshī: yāo sān bā líng yāo èr sān sì wǔ liù qī", translations: tr("왕 선생님: 138-0123-4567", "Teacher Wang: 138-0123-4567", "王先生：138-0123-4567") },
        { zh: "李明：139-2345-6789", pinyin: "Lǐ Míng: yāo sān jiǔ èr sān sì wǔ liù qī bā jiǔ", translations: tr("리밍: 139-2345-6789", "Li Ming: 139-2345-6789", "李明：139-2345-6789") },
        { zh: "医院：020-1234-5678", pinyin: "Yīyuàn: líng èr líng yāo èr sān sì wǔ liù qī bā", translations: tr("병원: 020-1234-5678", "Hospital: 020-1234-5678", "病院：020-1234-5678") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l15_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: {
        cn: "下面哪一句在问「你在给谁打电话」？",
        kr: "「누구에게 전화하니?」에 가까운 말은?",
        en: "Which line is asking who you’re calling?",
        jp: "「だれに電話してるか」を聞いているのは？",
      },
      options: opt4(
        ["你给谁打电话？", "누구한테 전화해?", "Who are you calling?", "だれに電話してる？"],
        ["你怎么去学校？", "학교엔 어떻게 가?", "How do you get to school?", "学校へはどう行く？"],
        ["今天天气怎么样？", "날씨 어때?", "How’s the weather?", "今日の天気は？"],
        ["你想吃什么？", "뭐 먹고 싶어?", "What do you want to eat?", "何が食べたい？"]
      ),
      answer: "A",
      explanation: {
        cn: "「给谁」引出通话对象，与本课一致。",
        kr: "「给谁」로 전화 상대를 묻습니다.",
        en: "给谁 asks the person you’re calling.",
        jp: "「给谁」は電話の相手。",
      },
    },
    {
      id: "hsk30_l15_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「号码」的拼音是？", kr: "「号码」의 병음은?", en: "What’s the pinyin for 号码?", jp: "「号码」のピンインは？" },
      options: pinOpts("hàomǎ", "hǎomǎ", "hàomà", "hāomǎ"),
      answer: "A",
      explanation: { cn: "「号码」读作 hàomǎ。", kr: "「号码」는 hàomǎ입니다.", en: "Say hàomǎ.", jp: "読みは hàomǎ です。" },
    },
    {
      id: "hsk30_l15_p3",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "「有，我看一下。」里的「看一下」主要表示：",
        kr: "「看一下」는 주로?",
        en: "In 我看一下, 看一下 mainly means:",
        jp: "「看一下」は主に何を表す？",
      },
      options: opt4(
        ["稍查一下、确认信息", "잠깐 확인", "Check briefly", "ちょっと確かめる"],
        ["看一下午电视", "한 오후 내내 TV", "Watch TV all afternoon", "午後ずっとテレビ"],
        ["只看一眼就走", "한눈만 보고 감", "Glance and leave", "ちらっと見て帰る"],
        ["向别人问好", "안부 묻기", "Say hello", "あいさつする"]
      ),
      answer: "A",
      explanation: {
        cn: "「一下」附在动词后，常表短时动作，此处是查号码前先看一眼。",
        kr: "「看一下」는 잠깐 확인하는 말이에요.",
        en: "看一下 here is “let me check.”",
        jp: "「看一下」は短く確認する。",
      },
    },
    {
      id: "hsk30_l15_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "「我给同学打电话。」句中「给」的作用是：",
        kr: "「给同学打电话」의 「给」는?",
        en: "In 给同学打电话, 给 shows:",
        jp: "「给同学打电话」の「给」は？",
      },
      options: opt4(
        ["引出打电话的对象", "전화 받는 사람", "Who gets the call", "電話の相手を示す"],
        ["表示从同学那里借电话", "전화 빌림", "Borrowing a phone", "電話を借りる"],
        ["说明同学正在打", "동기가 걸고 있음", "Classmate is dialing", "同学がかけている"],
        ["表示打电话很贵", "전화비 비쌈", "Calls are expensive", "電話代が高い"]
      ),
      answer: "A",
      explanation: {
        cn: "「给」引出与事相关的对象，即通话的另一方。",
        kr: "「给」는 행위의 상대(받는 사람)를 나타냅니다.",
        en: "给 marks who you’re calling.",
        jp: "「给」は相手を示す。",
      },
    },
  ],
  aiPractice: {
    speaking: ["喂，你好！", "我是李明。", "你现在有时间吗？", "你给谁打电话？", "我给同学打电话。", "你有王老师的电话号码吗？", "有，我看一下。", "你给王老师打电话吧。"],
    chatPrompt: "请只用本课「打电话、电话、号码、喂、给、同学、看、一下、问、问题、见、看见、事、手机」等词语练习通话与问号码；不要写成问天气或问怎么去学校。",
    prompt: {
      zh: "请只用本课「打电话、电话、号码、喂、给、同学、看、一下、问、问题、见、看见、事、手机」等词语练习通话与问号码；不要写成问天气或问怎么去学校。",
      kr: "「打电话·号码·喂·给·同学·看一下·问题」만. 날씨·통학은 빼 주세요.",
      en: "Practice phone talk with 打电话, 号码, 给…打电话—no weather or commuting.",
      jp: "電話と番号の表現だけ。天気や行き方は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l15_who_call",
          situation: { zh: "会话二：给谁打电话", kr: "회화2 · 누구에게", en: "Dialogue 2 — who", jp: "会話2" },
          aiRole: { zh: "妈妈", kr: "엄마", en: "Mom", jp: "母" },
          studentRole: { zh: "李明", kr: "리밍", en: "Li Ming", jp: "李明" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "你给谁打电话？", pinyin: "Nǐ gěi shéi dǎ diànhuà?", kr: "누구한테 전화해?", en: "Who are you calling?", jp: "だれに電話してる？" },
            { zh: "我给同学打电话。", pinyin: "Wǒ gěi tóngxué dǎ diànhuà.", kr: "동기한테 전화해요.", en: "I’m calling a classmate.", jp: "同学に電話してます。" },
          ],
          rounds: [{ aiLine: "你在做什么呢？", studentRefs: ["你给谁打电话？"], acceptable: ["你给谁打电话？"], closeAnswers: ["给谁", "打电话"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「给……打电话」说明通话对象。", pinyin: "gěi", kr: "「给…打电话」로 상대를 말한다.", en: "Say who you call with 给…打电话.", jp: "「给…打电话」で相手を言う。" },
      { zh: "能体会「我看一下」表示先查一查、稍等。", pinyin: "kàn yíxià", kr: "「看一下」는 잠깐 확인.", en: "我看一下 ≈ let me check.", jp: "「看一下」は確認。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "本课聚焦电话与号码，不是问住址或交通。", pinyin: "diànhuà", kr: "전화·번호 과목. 주소·교통 아님.", en: "Phones & numbers—not address or transport.", jp: "電話と番号。住所や行き方ではない。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：要老师号码。会话二：给谁打、问什么。会话三：建议给老师打电话并读号码。",
        kr: "번호 요청 → 누구·무엇 → 전화 권함.",
        en: "Ask number · who/what · suggest calling.",
        jp: "番号／相手・用件／電話を勧める。",
      },
      scenarioSummaryLines: [{ zh: "「手机号码」常简说「手机号」。", pinyin: "shǒujī", kr: "휴대폰 번호.", en: "Mobile number.", jp: "携帯番号。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「喂」只在电话里用吗？", kr: "「喂」?", en: "喂 only on the phone?", jp: "「喂」は電話だけ？" },
    freeAskExamples: {
      zh: ["「看一下」还能说什么动词后面？", "「给」和「跟」有什么不同？"],
      kr: ["「看一下」?", "「给」?"],
      en: ["Another verb + 一下?", "给 vs 跟?"],
      jp: ["「一下」のほかの動詞は？", "「给」と「跟」？"],
    },
    coreExpressions: [
      {
        expr: "你给谁打电话？ / 我给同学打电话。",
        pinyin: "Nǐ gěi shéi dǎ diànhuà? / Wǒ gěi tóngxué dǎ diànhuà.",
        usage: { zh: "说明正在与谁通话。", kr: "누구와 통화하는지 말한다.", en: "Say who you’re on the phone with.", jp: "通話の相手を言う。" },
      },
    ],
  },
});

export const lesson16 = L(16, {
  title: {
    zh: "第16课｜今天天气真好",
    cn: "第16课｜今天天气真好",
    kr: "제16과｜오늘 날씨 참 좋네요",
    en: "Lesson 16 | Nice Weather Today",
    jp: "第16課｜今日はいい天気ですね",
  },
  summary: {
    zh: "学习用「天气怎么样」谈论天气，用「真、太、非常、有点儿」表程度，并会说「下雨、下雪」与「觉得」。",
    kr: "「天气怎么样」·程度 부사·「下雨/下雪」·「觉得」.",
    en: "天气怎么样; degree words; rain/snow; 觉得.",
    jp: "天気の聞き方、程度、「下雨」「下雪」、「觉得」。",
  },
  scene: {
    id: "hsk30_l16_scene",
    title: i4("晴雨与冷暖", "맑음·비·추위", "Sun, rain, cold", "晴れ雨・寒暖"),
    summary: i4(
      "会话一：今天天气、冷不冷；会话二：外边下雨、改天看电影；会话三：喜不喜欢下雪、冷不冷。",
      "회화1 날씨·더위 → 회화2 비·영화 → 회화3 눈·추위.",
      "Fine day & heat · rain & plans · snow & cold.",
      "天気／雨と予定／雪と寒さ。"
    ),
  },
  objectives: [
    {
      zh: "能用「今天天气怎么样？」「今天天气很好」谈论天气",
      pinyin: "tiānqì · zěnmeyàng",
      kr: "「天气怎么样」「天气很好」로 날씨를 묻고 말한다.",
      en: "Ask and describe the weather.",
      jp: "天気を尋ね、述べる。",
    },
    {
      zh: "能区分「真、太、非常、有点儿」的语气强弱，并用「觉得」表达感受",
      pinyin: "zhēn · tài · juéde",
      kr: "정도 부사와 「觉得」로 느낌을 말한다.",
      en: "Use degree adverbs and 觉得 for feelings.",
      jp: "程度副詞と「觉得」。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜问天气", kr: "회화 1｜날씨", en: "Dialogue 1 | Weather", jp: "会話1｜天気" },
      i4("问今天天气怎么样，说到有一点儿热。", "오늘 날씨·조금 더움.", "How’s the weather—a bit hot.", "今日の天気、少し暑い。"),
      [
        line("王美", "今天天气怎么样？", "Jīntiān tiānqì zěnmeyàng?", tr("오늘 날씨 어때요?", "How’s the weather today?", "今日の天気はどう？")),
        line("汤姆", "今天天气很好。", "Jīntiān tiānqì hěn hǎo.", tr("오늘 날씨 아주 좋아요.", "It’s really nice today.", "今日はとてもいい天気です。")),
        line("王美", "冷吗？", "Lěng ma?", tr("추워요?", "Is it cold?", "寒い？")),
        line("汤姆", "不冷，有一点儿热。", "Bù lěng, yǒu yìdiǎnr rè.", tr("안 추워요, 좀 더워요.", "Not cold—a little hot.", "寒くないです、少し暑いです。")),
      ]
    ),
    card(
      { zh: "会话二｜下雨天", kr: "회화 2｜비 오는 날", en: "Dialogue 2 | Rainy day", jp: "会話2｜雨の日" },
      i4("外边下大雨，商量还能不能看电影、在家看电视。", "밖에 비·영화 vs 집 TV.", "Heavy rain—cinema or TV at home.", "大雨、映画かテレビ。"),
      [
        line("安娜", "外边下雨了吗？", "Wàibian xià yǔ le ma?", tr("밖에 비 와요?", "Is it raining outside?", "外は雨？")),
        line("汤姆", "下雨了，外边雨非常大。", "Xià yǔ le, wàibian yǔ fēicháng dà.", tr("와요, 밖에 비가 엄청 커요.", "Yes—the rain’s really heavy.", "降ってる、外は雨がすごく強い。")),
        line("安娜", "今天还能去看电影吗？", "Jīntiān hái néng qù kàn diànyǐng ma?", tr("오늘도 영화 보러 갈 수 있어요?", "Can we still go to the movies today?", "今日映画に行ける？")),
        line("汤姆", "现在时间还早，看看再说吧。", "Xiànzài shíjiān hái zǎo, kànkan zài shuō ba.", tr("지금은 아직 이르니, 두고 봐요.", "It’s still early—we’ll see.", "まだ早いから、様子を見よう。")),
        line("安娜", "下雨天，我不想去了。", "Xià yǔ tiān, wǒ bù xiǎng qù le.", tr("비 오는 날엔 안 가고 싶어요.", "On a day like this I don’t want to go.", "雨の日は行きたくない。")),
        line("汤姆", "那我们在家看电视吧。", "Nà wǒmen zài jiā kàn diànshì ba.", tr("그럼 집에서 TV 봐요.", "Then let’s watch TV at home.", "じゃあ家でテレビを見よう。")),
      ]
    ),
    card(
      { zh: "会话三｜冬天的天气", kr: "회화 3｜겨울 날씨", en: "Dialogue 3 | Winter", jp: "会話3｜冬" },
      i4("聊喜不喜欢下雪、冷不冷，用「觉得」说感受。", "눈 좋아함·추위·느낌.", "Snow—cold—觉得.", "雪が好きか、寒さ、「觉得」。"),
      [
        line("李明", "你喜欢下雪吗？", "Nǐ xǐhuan xià xuě ma?", tr("눈 오는 거 좋아해요?", "Do you like snow?", "雪は好き？")),
        line("汤姆", "喜欢。下雪可以去玩雪。", "Xǐhuan. Xià xuě kěyǐ qù wán xuě.", tr("좋아요. 눈 오면 눈 놀이 가요.", "Yes—when it snows we can play in it.", "好き。雪が降ったら遊びに行ける。")),
        line("李明", "不冷吗？", "Bù lěng ma?", tr("안 추워요?", "Aren’t you cold?", "寒くない？")),
        line("汤姆", "不太冷。你喜欢下雪吗？", "Bú tài lěng. Nǐ xǐhuan xià xuě ma?", tr("별로 안 추워요. 님은요?", "Not very cold. How about you?", "あまり寒くない。君は？")),
        line("李明", "我不太喜欢，我觉得下雪很冷。", "Wǒ bú tài xǐhuan, wǒ juéde xià xuě hěn lěng.", tr("저는 별로예요. 눈 오면 춥다고 느껴요.", "Not really—I find snowy days cold.", "あまり好きじゃない。雪の日は寒いと思う。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "天气怎么样",
      pinyin: "tiānqì zěnmeyàng",
      hint: { zh: "问天气", kr: "날씨", en: "how’s weather", jp: "天気" },
      explanation: {
        zh: "常用提问框架「今天天气怎么样？」也可用「今天天气好吗？」等变体，回答可用形容词或短句描述冷暖、晴雨。\n\n「天气」\ntiānqì",
        kr: "「天气怎么样」로 날씨를 묻습니다.",
        en: "天气怎么样? opens a weather chat.",
        jp: "「天气怎么样」で天気を尋ねる。",
      },
      examples: [
        { zh: "今天天气怎么样？", pinyin: "Jīntiān tiānqì zěnmeyàng?", translation: tr("오늘 날씨 어때요?", "How’s the weather today?", "今日の天気はどう？") },
        { zh: "今天天气很好。", pinyin: "Jīntiān tiānqì hěn hǎo.", translation: tr("오늘 날씨 아주 좋아요.", "It’s lovely today.", "今日はとてもいい天気です。") },
      ],
    },
    {
      pattern: "程度副词：真、太、非常、有点儿",
      pinyin: "chéngdù fùcí",
      hint: { zh: "强弱", kr: "정도", en: "degree", jp: "程度" },
      explanation: {
        zh: "「真、太、非常」多加强语气；「有点儿」常表示程度不高或轻微，如「有一点儿热」「我不太喜欢」。\n\n「有点儿」\nyǒudiǎnr",
        kr: "강조와 완곡—「有点儿」는 약한 정도.",
        en: "真/太/非常 amp up; 有点儿 softens or “a bit.”",
        jp: "「有点儿」は「少し」。",
      },
      examples: [
        { zh: "外边雨非常大。", pinyin: "Wàibian yǔ fēicháng dà.", translation: tr("밖에 비가 엄청 세요.", "The rain outside is really heavy.", "外は雨がとても強い。") },
        { zh: "有一点儿热。", pinyin: "Yǒu yìdiǎnr rè.", translation: tr("좀 더워요.", "A little hot.", "少し暑い。") },
      ],
    },
    {
      pattern: "下雨 / 下雪",
      pinyin: "xià yǔ / xià xuě",
      hint: { zh: "自然现象", kr: "비·눈", en: "rain / snow", jp: "雨・雪" },
      explanation: {
        zh: "动词「下」与「雨」「雪」搭配表示降水，如「下雨了」「下雪可以去玩雪」。\n\n「下雨」\nxià yǔ",
        kr: "「下雨」「下雪」로 강수를 말합니다.",
        en: "下雨了 = it’s raining; 下雪 = snow falls.",
        jp: "「下雨」「下雪」で降水。",
      },
      examples: [
        { zh: "外边下雨了吗？", pinyin: "Wàibian xià yǔ le ma?", translation: tr("밖에 비 와요?", "Is it raining outside?", "外は雨？") },
        { zh: "下雪可以去玩雪。", pinyin: "Xià xuě kěyǐ qù wán xuě.", translation: tr("눈 오면 눈 놀이 가요.", "When it snows you can play in the snow.", "雪が降ったら遊べる。") },
      ],
    },
    {
      pattern: "觉得",
      pinyin: "juéde",
      hint: { zh: "主观感受", kr: "느끼다", en: "feel/think", jp: "～と思う" },
      explanation: {
        zh: "动词「觉得」引出主观感受或看法，如「我觉得下雪很冷」。\n\n「觉得」\njuéde",
        kr: "「觉得」는 주관적 느낌.",
        en: "觉得 = feel / think (subjectively).",
        jp: "「觉得」は感じ・思う。",
      },
      examples: [
        { zh: "我觉得下雪很冷。", pinyin: "Wǒ juéde xià xuě hěn lěng.", translation: tr("눈 오는 날은 춥다고 느껴요.", "I find snowy weather cold.", "雪の日は寒いと思う。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "今天天气很好。", pinyin: "Jīntiān tiānqì hěn hǎo.", translations: tr("오늘 날씨 정말 좋아요.", "Nice weather today.", "今日はいい天気です。") },
        { zh: "外边很冷。", pinyin: "Wàibian hěn lěng.", translations: tr("밖은 매우 추워요.", "It’s cold outside.", "外はとても寒い。") },
        { zh: "我喜欢下雪。", pinyin: "Wǒ xǐhuan xià xuě.", translations: tr("눈 오는 걸 좋아해요.", "I like snow.", "雪が降るのが好きです。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜天气卡", kr: "읽기｜날씨 카드", en: "Reading | Weather card", jp: "読み物｜天気カード" },
      sentences: [
        { zh: "北京：冷", pinyin: "Běijīng: lěng", translations: tr("베이징: 춥다", "Beijing: cold", "北京：寒い") },
        { zh: "上海：热", pinyin: "Shànghǎi: rè", translations: tr("상하이: 덥다", "Shanghai: hot", "上海：暑い") },
        { zh: "今天：下雨", pinyin: "Jīntiān: xià yǔ", translations: tr("오늘: 비", "Today: rain", "今日：雨") },
        { zh: "明天：下雪", pinyin: "Míngtiān: xià xuě", translations: tr("내일: 눈", "Tomorrow: snow", "明日：雪") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l16_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: {
        cn: "下面哪一句在问「今天天气如何」？",
        kr: "오늘 날씨를 묻는 말은?",
        en: "Which asks about today’s weather?",
        jp: "今日の天気を聞いているのは？",
      },
      options: opt4(
        ["今天天气怎么样？", "오늘 날씨 어때?", "How’s the weather today?", "今日の天気はどう？"],
        ["你给谁打电话？", "누구한테 전화?", "Who are you calling?", "だれに電話？"],
        ["你怎么去学校？", "학교 어떻게 가?", "How do you get to school?", "学校へどう行く？"],
        ["你想吃什么？", "뭐 먹고 싶어?", "What do you want to eat?", "何が食べたい？"]
      ),
      answer: "A",
      explanation: { cn: "「天气怎么样」用于询问天气。", kr: "「天气怎么样」로 날씨를 묻습니다.", en: "天气怎么样 asks about the weather.", jp: "「天气怎么样」は天気を尋ねる。" },
    },
    {
      id: "hsk30_l16_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「怎么样」的拼音是？", kr: "「怎么样」의 병음은?", en: "What’s the pinyin for 怎么样?", jp: "「怎么样」のピンインは？" },
      options: pinOpts("zěnmeyàng", "zěnmeyāng", "zhěnmeyàng", "zěnmeyang"),
      answer: "A",
      explanation: { cn: "「怎么样」读作 zěnmeyàng。", kr: "「怎么样」는 zěnmeyàng입니다.", en: "Say zěnmeyàng.", jp: "読みは zěnmeyàng です。" },
    },
    {
      id: "hsk30_l16_p3",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "「我觉得下雪很冷。」里的「觉得」表示：",
        kr: "「觉得」는?",
        en: "In 我觉得下雪很冷, 觉得 expresses:",
        jp: "「觉得」は何を表す？",
      },
      options: opt4(
        ["主观感受或看法", "주관적 느낌", "A personal feeling", "自分の感じ・考え"],
        ["向别人道歉", "사과", "Apologizing", "あやまる"],
        ["命令对方穿外套", "겉옷 입으라 함", "Ordering a coat", "上着を着ろと命じる"],
        ["说明下雪的时间", "눈 오는 시각", "When it snows", "雪が降る時刻"]
      ),
      answer: "A",
      explanation: { cn: "「觉得」引出说话人对天气的主观感受。", kr: "「觉得」는 느낌·생각.", en: "觉得 = feel/think.", jp: "「觉得」は感じ・思う。" },
    },
    {
      id: "hsk30_l16_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: {
        cn: "「下雨了，外边雨非常大。」句中「非常」 mainly 修饰：",
        kr: "「非常大」에서 「非常」는?",
        en: "In 雨非常大, 非常 mainly intensifies:",
        jp: "「非常大」の「非常」は何を強める？",
      },
      options: opt4(
        ["雨下得大、程度强", "비의 세기", "How heavy the rain is", "雨の強さ"],
        ["时间非常早", "시간이 이르다", "Very early", "とても早い"],
        ["路非常远", "길이 멀다", "Very far", "とても遠い"],
        ["人非常多", "사람이 많다", "Many people", "人が多い"]
      ),
      answer: "A",
      explanation: { cn: "「非常」在此说明雨势大。", kr: "「非常大」는 비가 세다는 뜻.", en: "非常 + 大 = very heavy (rain).", jp: "雨の強さを言う。" },
    },
  ],
  aiPractice: {
    speaking: ["今天天气怎么样？", "今天天气很好。", "外边下雨了吗？", "下雨了，外边雨非常大。", "那我们在家看电视吧。", "你喜欢下雪吗？", "我觉得下雪很冷。"],
    chatPrompt: "请只用本课「天气、怎么样、冷、热、雨、下雨、雪、下雪、外边、太、真、非常、有点儿、还、早、再、电视、觉得」等词语谈天气与感受；不要写成问电话号码。",
    prompt: {
      zh: "请只用本课「天气、怎么样、冷、热、雨、下雨、雪、下雪、外边、太、真、非常、有点儿、还、早、再、电视、觉得」等词语谈天气与感受；不要写成问电话号码。",
      kr: "날씨·비·눈·추위·느낌만. 전화번호는 빼 주세요.",
      en: "Weather and feelings only—no phone numbers.",
      jp: "天気と気持ちだけ。電話番号は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l16_weather",
          situation: { zh: "会话一：问天气", kr: "회화1 · 날씨", en: "Dialogue 1", jp: "会話1" },
          aiRole: { zh: "王美", kr: "왕메이", en: "Wang Mei", jp: "王美" },
          studentRole: { zh: "汤姆", kr: "탐", en: "Tom", jp: "トム" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "今天天气怎么样？", pinyin: "Jīntiān tiānqì zěnmeyàng?", kr: "오늘 날씨 어때?", en: "How’s the weather?", jp: "今日の天気は？" },
            { zh: "今天天气很好。", pinyin: "Jīntiān tiānqì hěn hǎo.", kr: "아주 좋아요.", en: "It’s great.", jp: "とてもいいです。" },
          ],
          rounds: [{ aiLine: "我们出去玩吧！", studentRefs: ["今天天气怎么样？"], acceptable: ["今天天气怎么样？"], closeAnswers: ["天气", "怎么样"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「天气怎么样」开启关于天气的对话。", pinyin: "tiānqì", kr: "날씨 질문.", en: "Open with 天气怎么样.", jp: "天気の話を始める。" },
      { zh: "能用「觉得」说出自己对冷热的感受。", pinyin: "juéde", kr: "느낌 말하기.", en: "Say how you feel with 觉得.", jp: "「觉得」で感じを言う。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "本课说天气与体感，不是说怎么去学校。", pinyin: "tiānqì", kr: "날씨 과목.", en: "Weather—not transport.", jp: "天気の课。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：冷暖。会话二：大雨与在家看电视。会话三：下雪与觉得冷。",
        kr: "날씨 → 비·TV → 눈·느낌.",
        en: "Fine / rainy & TV / snow & cold.",
        jp: "晴れ雨／テレビ／雪。",
      },
      scenarioSummaryLines: [{ zh: "「还早」的「还」表示尚、仍然。", pinyin: "hái", kr: "「还」는 아직.", en: "还 = still/yet.", jp: "「还」はまだ。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「有点儿」和「有一点儿」一样吗？", kr: "「有点儿」?", en: "有点儿 vs 有一点儿?", jp: "「有点儿」は？" },
    freeAskExamples: { zh: ["「太」一定是不满意吗？", "下雨和下雨天有什么不同？"], kr: ["「太」?", "下雨?"], en: ["Is 太 always bad?", "下雨 vs 下雨天?"], jp: ["「太」は文句？", "「下雨」？"] },
    coreExpressions: [
      {
        expr: "今天天气怎么样？ / 今天天气很好。",
        pinyin: "Jīntiān tiānqì zěnmeyàng? / Jīntiān tiānqì hěn hǎo.",
        usage: { zh: "询问并描述当天天气。", kr: "오늘 날씨 묻고 답하기.", en: "Ask and describe today’s weather.", jp: "その日の天気を聞き、答える。" },
      },
    ],
  },
});

export const lesson17 = L(17, {
  title: {
    zh: "第17课｜你学习什么？",
    cn: "第17课｜你学习什么？",
    kr: "제17과｜뭘 공부해요?",
    en: "Lesson 17 | What Are You Studying?",
    jp: "第17課｜何を勉強していますか。",
  },
  summary: {
    zh: "学习用「学、学习」说课业，用「正在……呢」表进行，用「什么」问内容，用「都」表总括。",
    kr: "「学/学习」「正在…呢」「什么」「都」.",
    en: "学/学习; 正在…呢; 什么; 都.",
    jp: "「学」「学习」「正在…呢」「什么」「都」。",
  },
  scene: {
    id: "hsk30_l17_scene",
    title: i4("读书与上课", "독서·수업", "Reading & class", "読書と授業"),
    summary: i4(
      "会话一：正在读书、中文书与汉字；会话二：学汉语、一天几小时；会话三：大中小学生的身份、会不会说汉语。",
      "회화1 독서·한자 → 회화2 한어·시간 → 회화3 신분·말하기.",
      "Reading · hours of Chinese · school level & speaking.",
      "読書／時間／学生の段階。"
    ),
  },
  objectives: [
    {
      zh: "能用「你在学什么呢？」「我正在学习汉语呢」描述正在进行的学业活动",
      pinyin: "zhèngzài · ne",
      kr: "「正在 … 呢」로 지금 하는 공부를 말한다.",
      en: "Describe ongoing study with 正在…呢.",
      jp: "「正在…呢」で勉強中のことを言う。",
    },
    {
      zh: "能用「你们都会说汉语吗？」一类问句，理解「都」概括全体",
      pinyin: "dōu",
      kr: "「都」로 모두 해당됨을 말한다.",
      en: "Use 都 for “all.”",
      jp: "「都」で全部。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜读书写字", kr: "회화 1｜읽고 쓰기", en: "Dialogue 1 | Read & write", jp: "会話1｜読み書き" },
      i4("问在做什么，说到正在读中文书、会写汉字。", "뭐 하는지·중국어 책·한자.", "What are you doing—Chinese books & characters.", "何をしているか、中国語の本と漢字。"),
      [
        line("汤姆", "你在做什么呢？", "Nǐ zài zuò shénme ne?", tr("뭐 하고 있어요?", "What are you doing?", "何してるの？")),
        line("琳达", "我正在读书呢。", "Wǒ zhèngzài dúshū ne.", tr("책 읽고 있어요.", "I’m reading.", "読書してます。")),
        line("汤姆", "你读的是中文书吗？", "Nǐ dú de shì Zhōngwén shū ma?", tr("중국어 책이에요?", "Is it a Chinese book?", "中国語の本？")),
        line("琳达", "是的，是中文书。", "Shì de, shì Zhōngwén shū.", tr("네, 중국어 책이에요.", "Yes—a Chinese book.", "ええ、中国語の本です。")),
        line("汤姆", "你也会写汉字吗？", "Nǐ yě huì xiě Hànzì ma?", tr("한자도 쓸 수 있어요?", "Can you write characters too?", "漢字も書ける？")),
        line("琳达", "是的，我会写很多汉字。", "Shì de, wǒ huì xiě hěn duō Hànzì.", tr("네, 한자 많이 써요.", "Yes—I can write a lot.", "ええ、たくさん書けます。")),
      ]
    ),
    card(
      { zh: "会话二｜说学习情况", kr: "회화 2｜공부 이야기", en: "Dialogue 2 | How you study", jp: "会話2｜学習の様子" },
      i4("问学什么、喜欢汉语课吗、一天学几小时。", "무엇을·좋아함·하루 몇 시간.", "What, liking class, hours a day.", "何を、好きか、一日何時間。"),
      [
        line("王老师", "汤姆，你在学什么呢？", "Tāngmǔ, nǐ zài xué shénme ne?", tr("탐, 뭐 배우고 있니?", "Tom, what are you studying?", "トム、何を勉強してる？")),
        line("汤姆", "我正在学习汉语呢。", "Wǒ zhèngzài xuéxí Hànyǔ ne.", tr("중국어 공부하고 있어요.", "I’m studying Chinese.", "中国語を勉強してます。")),
        line("王老师", "你喜欢汉语课吗？", "Nǐ xǐhuan Hànyǔ kè ma?", tr("중국어 수업 좋아해?", "Do you like Chinese class?", "中国語の授業は好き？")),
        line("汤姆", "喜欢。", "Xǐhuan.", tr("좋아요.", "Yes.", "好きです。")),
        line("王老师", "你一天学习几个小时汉语？", "Nǐ yī tiān xuéxí jǐ ge xiǎoshí Hànyǔ?", tr("하루에 중국어 몇 시간 해?", "How many hours of Chinese a day?", "一日何時間中国語を？")),
        line("汤姆", "我一天学习两个小时汉语。", "Wǒ yī tiān xuéxí liǎng ge xiǎoshí Hànyǔ.", tr("하루 두 시간이요.", "Two hours a day.", "一日二時間です。")),
      ]
    ),
    card(
      { zh: "会话三｜说学生身份", kr: "회화 3｜학생 신분", en: "Dialogue 3 | Student type", jp: "会話3｜学生の身分" },
      i4("问是不是大学生，琳达是小学生，大家会不会说汉语。", "대학생인지·초등·다 함께 말하기.", "College or not—primary—everyone speaks?", "大学生か、小学生、みんな話せるか。"),
      [
        line("李明", "你是大学生吗？", "Nǐ shì dàxuéshēng ma?", tr("대학생이에요?", "Are you a college student?", "大学生ですか。")),
        line("汤姆", "不是，我是中学生。", "Bù shì, wǒ shì zhōngxuéshēng.", tr("아니요, 중학생이에요.", "No—I’m a middle school student.", "いいえ、中学生です。")),
        line("李明", "那你呢，琳达？", "Nà nǐ ne, Líndá?", tr("린다는요?", "How about you, Linda?", "リンダさんは？")),
        line("琳达", "我是小学生。", "Wǒ shì xiǎoxuéshēng.", tr("저는 초등학생이에요.", "I’m an elementary student.", "小学生です。")),
        line("李明", "你们都会说汉语吗？", "Nǐmen dōu huì shuō Hànyǔ ma?", tr("둘 다 중국어 할 수 있어요?", "Can you both speak Chinese?", "二人とも中国語が話せますか。")),
        line("汤姆", "是的，我们都会说汉语。", "Shì de, wǒmen dōu huì shuō Hànyǔ.", tr("네, 둘 다 할 수 있어요.", "Yes—we both can.", "ええ、二人とも話せます。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "学 / 学习",
      pinyin: "xué / xuéxí",
      hint: { zh: "学习活动", kr: "배우기", en: "study", jp: "勉強" },
      explanation: {
        zh: "「学」可单独作动词或与其他成分搭配；「学习」为双音节动词，宾语常为语言或技能，如「学习汉语」。\n\n「学习」\nxuéxí",
        kr: "「学」「学习」로 공부·습득을 말합니다.",
        en: "学 / 学习 = study (学习 often with objects like 汉语).",
        jp: "「学」「学习」で勉強。",
      },
      examples: [
        { zh: "你在学什么呢？", pinyin: "Nǐ zài xué shénme ne?", translation: tr("뭐 배우고 있어?", "What are you studying?", "何を勉強してる？") },
        { zh: "我正在学习汉语呢。", pinyin: "Wǒ zhèngzài xuéxí Hànyǔ ne.", translation: tr("중국어 공부 중이에요.", "I’m studying Chinese.", "中国語を勉強してます。") },
      ],
    },
    {
      pattern: "正在……呢",
      pinyin: "zhèngzài … ne",
      hint: { zh: "进行中", kr: "진행", en: "in progress", jp: "進行中" },
      explanation: {
        zh: "副词「正在」与动词性成分组合表示动作正在进行，句末常用语气词「呢」呼应，如「我正在读书呢」。\n\n「正在」\nzhèngzài",
        kr: "「正在 … 呢」는 지금 하고 있음.",
        en: "正在…呢 = in the middle of doing…",
        jp: "「正在…呢」は進行。",
      },
      examples: [
        { zh: "我正在读书呢。", pinyin: "Wǒ zhèngzài dúshū ne.", translation: tr("책 읽고 있어요.", "I’m reading.", "読書してます。") },
      ],
    },
    {
      pattern: "什么问内容",
      pinyin: "shénme wèn nèiróng",
      hint: { zh: "疑问内容", kr: "내용", en: "what content", jp: "内容" },
      explanation: {
        zh: "疑问代词「什么」可询问事物、行为或内容，如「你在学什么？」「你读的是什么书？」。\n\n「什么」\nshénme",
        kr: "「什么」로 내용·대상을 묻습니다.",
        en: "什么 asks what (content or thing).",
        jp: "「什么」は内容を尋ねる。",
      },
      examples: [
        { zh: "你在学什么呢？", pinyin: "Nǐ zài xué shénme ne?", translation: tr("뭐 배워?", "What are you studying?", "何を勉強してる？") },
      ],
    },
    {
      pattern: "都",
      pinyin: "dōu",
      hint: { zh: "总括", kr: "모두", en: "all", jp: "みな" },
      explanation: {
        zh: "副词「都」用于总括前面所举的人或事物，表示全体具有某种情况，如「我们都会说汉语」。\n\n「都」\ndōu",
        kr: "「都」는 전원 해당.",
        en: "都 = all (in the group).",
        jp: "「都」は全部。",
      },
      examples: [
        { zh: "我们都会说汉语。", pinyin: "Wǒmen dōu huì shuō Hànyǔ.", translation: tr("우리 다 중국어 해요.", "We all speak Chinese.", "みんな中国語が話せます。") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "我在学校学习中文。", pinyin: "Wǒ zài xuéxiào xuéxí Zhōngwén.", translations: tr("학교에서 중국어를 배워요.", "I study Chinese at school.", "学校で中国語を勉強します。") },
        { zh: "我是中学生。", pinyin: "Wǒ shì zhōngxuéshēng.", translations: tr("저는 중학생이에요.", "I’m a middle school student.", "中学生です。") },
        { zh: "我学习两个小时。", pinyin: "Wǒ xuéxí liǎng ge xiǎoshí.", translations: tr("두 시간 공부해요.", "I study for two hours.", "二時間勉強します。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜今天的课表", kr: "읽기｜오늘 시간표", en: "Reading | Today’s timetable", jp: "読み物｜今日の時間割" },
      sentences: [
        { zh: "第一课 读书 9:00—9:50", pinyin: "Dì-yī kè dúshū jiǔ diǎn líng líng dào jiǔ diǎn wǔ shí", translations: tr("1교시 독서 9:00—9:50", "Period 1 Reading 9:00—9:50", "第1時限 読書 9:00—9:50") },
        { zh: "第二课 汉语10:00—10:50", pinyin: "Dì-èr kè Hànyǔ shí diǎn líng líng dào shí diǎn wǔ shí", translations: tr("2교시 중국어 10:00—10:50", "Period 2 Chinese 10:00—10:50", "第2時限 中国語 10:00—10:50") },
        { zh: "下午 书法课 2:00—4:00", pinyin: "Xiàwǔ shūfǎ kè liǎng diǎn líng líng dào sì diǎn líng líng", translations: tr("오후 서예 2:00—4:00", "Afternoon calligraphy 2:00—4:00", "午後 書道 2:00—4:00") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l17_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: { cn: "下面哪一句表示「动作正在进行」？", kr: "「지금 하고 있다」에 가까운 말은?", en: "Which shows an action in progress?", jp: "「いま進行中」を表すのは？" },
      options: opt4(
        ["我正在读书呢。", "책 읽는 중이에요.", "I’m reading right now.", "今、読書してます。"],
        ["我昨天读书了。", "어제 책 읽었어요.", "I read yesterday.", "昨日読みました。"],
        ["我会读书。", "책 읽을 줄 알아요.", "I can read.", "読めます。"],
        ["我想读书。", "책 읽고 싶어요.", "I want to read.", "読みたいです。"]
      ),
      answer: "A",
      explanation: { cn: "「正在……呢」表进行。", kr: "「正在…呢」는 진행.", en: "正在…呢 marks ongoing action.", jp: "「正在…呢」は進行。" },
    },
    {
      id: "hsk30_l17_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「学习」的拼音是？", kr: "「学习」의 병음은?", en: "What’s the pinyin for 学习?", jp: "「学习」のピンインは？" },
      options: pinOpts("xuéxí", "xuéxī", "xüéxí", "xuéxi"),
      answer: "A",
      explanation: { cn: "「学习」读作 xuéxí。", kr: "「学习」는 xuéxí입니다.", en: "Say xuéxí.", jp: "読みは xuéxí です。" },
    },
    {
      id: "hsk30_l17_p3",
      type: "choice",
      subtype: "dialogue_response",
      prompt: { cn: "「你们都会说汉语吗？」里的「都」强调：", kr: "「都」는?", en: "In 你们都会…, 都 stresses:", jp: "「你们都会」の「都」は？" },
      options: opt4(
        ["几个人全部具备所说情况", "여러 사람 모두", "Everyone in the group", "グループの全員"],
        ["只有一个人会", "한 명만", "Only one person", "一人だけ"],
        ["谁也不大会", "아무도 못 함", "Nobody can", "だれもできない"],
        ["问时间是不是都花在汉语上", "시간을 다 썼냐", "Whether time was all spent", "時間の使い方"]
      ),
      answer: "A",
      explanation: { cn: "「都」总括「你们」全体。", kr: "「都」는 전원.", en: "都 = all of you.", jp: "「都」は全員。" },
    },
    {
      id: "hsk30_l17_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: { cn: "「你是大学生吗？」「不是，我是中学生。」回答的是关于：", kr: "무엇에 대한 답?", en: "That exchange is about:", jp: "何について答えている？" },
      options: opt4(
        ["就读的学校阶段/身份", "학교 단계·신분", "School level / status", "学校の段階・身分"],
        ["住在哪座城市", "어느 도시", "Which city", "どの都市"],
        ["今天上几节课", "오늘 몇 교시", "How many classes today", "今日の授業数"],
        ["会不会写汉字", "한자 쓰기", "Writing characters", "漢字が書けるか"]
      ),
      answer: "A",
      explanation: { cn: "大学生、中学生说明学籍阶段。", kr: "대학·중학은 학년 단계.", en: "大学生 vs 中学生 = school level.", jp: "学生の段階の話。" },
    },
  ],
  aiPractice: {
    speaking: ["你在做什么呢？", "我正在读书呢。", "你在学什么呢？", "我正在学习汉语呢。", "你一天学习几个小时汉语？", "你是大学生吗？", "我们都是小学生。", "你们都会说汉语吗？"],
    chatPrompt: "请只用本课「学、学习、正在、课、读、读书、大学生、小学生、中学生、小学、中文、我们、都、小时、一天」等词语谈学习；不要写成问天气。",
    prompt: {
      zh: "请只用本课「学、学习、正在、课、读、读书、大学生、小学生、中学生、小学、中文、我们、都、小时、一天」等词语谈学习；不要写成问天气。",
      kr: "공부·학년·시간만. 날씨는 빼 주세요.",
      en: "Study and school level only—no weather.",
      jp: "勉強と学生の話だけ。天気は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l17_study",
          situation: { zh: "会话二：学什么", kr: "회화2", en: "Dialogue 2", jp: "会話2" },
          aiRole: { zh: "王老师", kr: "왕 선생님", en: "Teacher Wang", jp: "王先生" },
          studentRole: { zh: "汤姆", kr: "탐", en: "Tom", jp: "トム" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "你在学什么呢？", pinyin: "Nǐ zài xué shénme ne?", kr: "뭐 배우고 있니?", en: "What are you studying?", jp: "何を勉強してる？" },
            { zh: "我正在学习汉语呢。", pinyin: "Wǒ zhèngzài xuéxí Hànyǔ ne.", kr: "중국어 공부 중이에요.", en: "I’m studying Chinese.", jp: "中国語を勉強してます。" },
          ],
          rounds: [{ aiLine: "加油！", studentRefs: ["你在学什么呢？"], acceptable: ["你在学什么呢？"], closeAnswers: ["学", "什么"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「正在……呢」说明此刻在做的功课。", pinyin: "zhèngzài", kr: "진행 중 말하기.", en: "Ongoing study with 正在…呢.", jp: "「正在…呢」で進行を言う。" },
      { zh: "能用「都」概括「我们、你们」全体。", pinyin: "dōu", kr: "전원 해당.", en: "都 for the whole group.", jp: "「都」で全員。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "本课谈学习与身份，不是说交通。", pinyin: "xuéxí", kr: "공부·학년.", en: "Study—not transport.", jp: "学習の课。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：读书与汉字。会话二：学汉语的时长。会话三：大中小学与都会说汉语。",
        kr: "독서 → 시간 → 신분·都.",
        en: "Reading · hours · levels & 都.",
        jp: "読書／時間／段階と「都」。",
      },
      scenarioSummaryLines: [{ zh: "「一天」指一昼夜中的学习时段安排。", pinyin: "yī tiān", kr: "하루.", en: "一天 = a day.", jp: "「一天」は一日。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「学」和「学习」能随便换吗？", kr: "「学」?", en: "学 vs 学习?", jp: "「学」と「学习」？" },
    freeAskExamples: { zh: ["「正在」一定要加「呢」吗？", "「小学生」和「小学」有什么不同？"], kr: ["「呢」?", "小学生?"], en: ["Need 呢?", "小学生 vs 小学?"], jp: ["「呢」は？", "小学生と小学？"] },
    coreExpressions: [
      {
        expr: "你在学什么呢？ / 我正在学习汉语呢。",
        pinyin: "Nǐ zài xué shénme ne? / Wǒ zhèngzài xuéxí Hànyǔ ne.",
        usage: { zh: "询问并回答正在学的内容。", kr: "무엇을 배우는지 묻고 답한다.", en: "Ask and say what you’re studying.", jp: "勉強内容を聞き、答える。" },
      },
    ],
  },
});

export const lesson18 = L(18, {
  title: {
    zh: "第18课｜课后你做什么？",
    cn: "第18课｜课后你做什么？",
    kr: "제18과｜수업 끝나면 뭐 해요?",
    en: "Lesson 18 | What Do You Do After Class?",
    jp: "第18課｜授業のあと何をしますか。",
  },
  summary: {
    zh: "学习用「做什么」询问课余活动，区分「听」与「听见」，用「只」表限制，用「好听、好玩儿」评价。",
    kr: "「做什么」「听/听见」「只」「好听·好玩儿」.",
    en: "做什么; 听/听见; 只; 好听/好玩儿.",
    jp: "「做什么」「听」「听见」「只」「好听」「好玩儿」。",
  },
  scene: {
    id: "hsk30_l18_scene",
    title: i4("课余与爱好", "방과·취미", "After school & hobbies", "放課後と趣味"),
    summary: i4(
      "会话一：下课听歌、游戏、弟弟找朋友；会话二：只喜欢听歌、歌好听；会话三：听见唱歌、妹妹唱得好听。",
      "회화1 노래·게임 → 회화2 취향 → 회화3 들림·칭찬.",
      "Music & games · taste · hearing & praise.",
      "音楽とゲーム／趣味／聞こえるとほめる。",
    ),
  },
  objectives: [
    {
      zh: "能用「下课后你做什么？」「我听歌」谈论课余活动",
      pinyin: "xià kè · zuò shénme",
      kr: "「做什么」로 방과 후 활동을 묻고 말한다.",
      en: "Ask and say what you do after class.",
      jp: "「做什么」で放課後のことを言う。",
    },
    {
      zh: "能区分「听」表主动聆听与「听见」表感知到声音",
      pinyin: "tīng · tīngjiàn",
      kr: "「听」과 「听见」를 가른다.",
      en: "Tell 听 from 听见.",
      jp: "「听」と「听见」の違い。",
    },
  ],
  dialogueCards: [
    card(
      { zh: "会话一｜课后活动", kr: "회화 1｜방과 후", en: "Dialogue 1 | After class", jp: "会話1｜放課後" },
      i4("问下课后做什么，听歌、玩游戏，弟弟去找小朋友。", "노래·게임·동생은 친구.", "Music, games, little brother off to friends.", "音楽、ゲーム、弟は友だち。"),
      [
        line("李明", "下课后你做什么？", "Xià kè hòu nǐ zuò shénme?", tr("수업 끝나면 뭐 해?", "What do you do after class?", "授業のあと何する？")),
        line("汤姆", "我听歌，也玩电脑游戏。", "Wǒ tīng gē, yě wán diànnǎo yóuxì.", tr("노래 듣고 컴퓨터 게임도 해요.", "I listen to music and play computer games.", "音楽を聴いて、パソコンゲームもします。")),
        line("李明", "游戏好玩儿吗？", "Yóuxì hǎowánr ma?", tr("게임 재밌어?", "Are the games fun?", "ゲームは楽しい？")),
        line("汤姆", "好玩儿。", "Hǎowánr.", tr("재밌어요.", "Yeah, fun.", "楽しい。")),
        line("李明", "你弟弟呢？", "Nǐ dìdi ne?", tr("남동생은?", "What about your brother?", "弟は？")),
        line("汤姆", "他去找小朋友玩了。", "Tā qù zhǎo xiǎopéngyou wán le.", tr("친구 찾아 놀러 갔어요.", "He went to play with friends.", "友だちを探しに遊びに行った。")),
      ]
    ),
    card(
      { zh: "会话二｜说爱好", kr: "회화 2｜취향", en: "Dialogue 2 | Preferences", jp: "会話2｜好み" },
      i4("喜欢唱歌还是只喜欢听歌，这首歌好不好听。", "노래 부르기 vs 듣기·곡 평가.", "Singing vs listening—how’s the song.", "歌うか聴くか、曲の評価。"),
      [
        line("王美", "你喜欢唱歌吗？", "Nǐ xǐhuan chàng gē ma?", tr("노래 부르는 거 좋아해?", "Do you like singing?", "歌うのは好き？")),
        line("汤姆", "我只喜欢听歌。", "Wǒ zhǐ xǐhuan tīng gē.", tr("듣는 것만 좋아해요.", "I only like listening.", "聴くのが好きです。")),
        line("王美", "这首歌怎么样？", "Zhè shǒu gē zěnmeyàng?", tr("이 노래 어때?", "How’s this song?", "この歌どう？")),
        line("汤姆", "很好听。", "Hěn hǎotīng.", tr("아주 좋아요.", "Sounds great.", "とてもいい。")),
      ]
    ),
    card(
      { zh: "会话三｜说别人爱好", kr: "회화 3｜남의 취미", en: "Dialogue 3 | Someone else’s hobby", jp: "会話3｜ほかの人" },
      i4("有没有听见唱歌、妹妹在唱、唱得好听。", "노래 소리·여동생·칭찬.", "Hear singing—sister—praising.", "歌声・妹・ほめる。"),
      [
        line("王美", "你听见有人在唱歌吗？", "Nǐ tīngjiàn yǒu rén zài chàng gē ma?", tr("누가 노래하는 소리 들려요?", "Do you hear someone singing?", "だれか歌ってるの聞こえる？")),
        line("汤姆", "是的，我妹妹在唱歌呢。", "Shì de, wǒ mèimei zài chàng gē ne.", tr("네, 여동생이 노래해요.", "Yes—my sister’s singing.", "ええ、妹が歌ってます。")),
        line("王美", "你妹妹唱歌真好听。", "Nǐ mèimei chàng gē zhēn hǎotīng.", tr("여동생 노래 정말 잘하네요.", "She sings really well.", "妹さん、歌が上手ですね。")),
        line("汤姆", "是的，她很喜欢唱歌。", "Shì de, tā hěn xǐhuan chàng gē.", tr("네, 노래 부르는 걸 좋아해요.", "Yeah—she loves to sing.", "ええ、歌うのが大好きなんです。")),
      ]
    ),
  ],
  grammar: [
    {
      pattern: "做什么",
      pinyin: "zuò shénme",
      hint: { zh: "询问活动", kr: "무엇을 하다", en: "what you do", jp: "何をする" },
      explanation: {
        zh: "疑问代词「什么」与动词「做」搭配，可询问进行的活动或安排，如「你做什么？」「下课后你做什么？」。\n\n「做什么」\nzuò shénme",
        kr: "「做什么」로 하는 일을 묻습니다.",
        en: "做什么 asks what activity.",
        jp: "「做什么」は何をするか。",
      },
      examples: [
        { zh: "下课后你做什么？", pinyin: "Xià kè hòu nǐ zuò shénme?", translation: tr("수업 끝나면 뭐 해?", "What do you do after class?", "放課後何する？") },
      ],
    },
    {
      pattern: "只",
      pinyin: "zhǐ",
      hint: { zh: "限制范围", kr: "만", en: "only", jp: "だけ" },
      explanation: {
        zh: "副词「只」用于限制范围，表示除此以外不包括其他，如「我只喜欢听歌」。\n\n「只」\nzhǐ",
        kr: "「只」는 한정.",
        en: "只 = only / nothing but.",
        jp: "「只」はだけ。",
      },
      examples: [
        { zh: "我只喜欢听歌。", pinyin: "Wǒ zhǐ xǐhuan tīng gē.", translation: tr("듣는 것만 좋아해요.", "I only like listening.", "聴くのだけ好き。") },
      ],
    },
    {
      pattern: "听 / 听见",
      pinyin: "tīng / tīngjiàn",
      hint: { zh: "听辨", kr: "듣기·들림", en: "listen / hear", jp: "聞く・聞こえる" },
      explanation: {
        zh: "「听」强调主动聆听；「听见」强调感知到声音的结果，如「听见有人在唱歌」。\n\n「听见」\ntīngjiàn",
        kr: "「听」는 듣기,「听见」는 들리다.",
        en: "听 = listen; 听见 = hear (notice).",
        jp: "「听」は聞く、「听见」は聞こえる。",
      },
      examples: [
        { zh: "我听歌。", pinyin: "Wǒ tīng gē.", translation: tr("노래 들어요.", "I listen to songs.", "歌を聴きます。") },
        { zh: "你听见有人在唱歌吗？", pinyin: "Nǐ tīngjiàn yǒu rén zài chàng gē ma?", translation: tr("누가 노래하는 소리 들려요?", "Do you hear someone singing?", "歌ってるの聞こえる？") },
      ],
    },
    {
      pattern: "好听 / 好玩儿",
      pinyin: "hǎotīng / hǎowánr",
      hint: { zh: "评价", kr: "평가", en: "sounds good / fun", jp: "耳心地・楽しさ" },
      explanation: {
        zh: "形容词「好听」多用于评价声音、歌曲；「好玩儿」多用于评价游戏、活动是否有趣。\n\n「好玩儿」\nhǎowánr",
        kr: "「好听」는 소리,「好玩儿」는 재미.",
        en: "好听 = pleasant to hear; 好玩儿 = fun.",
        jp: "「好听」は音、「好玩儿」はおもしろさ。",
      },
      examples: [
        { zh: "很好听。", pinyin: "Hěn hǎotīng.", translation: tr("정말 좋아요.", "It sounds great.", "とてもいい。") },
        { zh: "游戏好玩儿吗？", pinyin: "Yóuxì hǎowánr ma?", translation: tr("게임 재밌어?", "Is the game fun?", "ゲームは楽しい？") },
      ],
    },
  ],
  extension: [
    {
      groupTitle: { zh: "扩展表达", kr: "더 익히기", en: "More useful lines", jp: "表現を広げる" },
      sentences: [
        { zh: "我喜欢唱歌。", pinyin: "Wǒ xǐhuan chàng gē.", translations: tr("노래 부르는 걸 좋아해요.", "I like singing.", "歌うのが好きです。") },
        { zh: "这首歌很好听。", pinyin: "Zhè shǒu gē hěn hǎotīng.", translations: tr("이 노래 정말 좋아요.", "This song sounds great.", "この歌はとてもいい。") },
        { zh: "小朋友在玩。", pinyin: "Xiǎopéngyou zài wán.", translations: tr("아이들이 놀고 있어요.", "The kids are playing.", "子どもたちが遊んでいる。") },
      ],
    },
    {
      groupTitle: { zh: "阅读小材料｜课后活动表", kr: "읽기｜방과 활동", en: "Reading | After-school list", jp: "読み物｜放課後の予定" },
      sentences: [
        { zh: "下课后：", pinyin: "Xià kè hòu:", translations: tr("수업 후:", "After class:", "放課後：") },
        { zh: "听歌", pinyin: "tīng gē", translations: tr("노래 듣기", "Listen to music", "音楽を聴く") },
        { zh: "唱歌", pinyin: "chàng gē", translations: tr("노래 부르기", "Sing", "歌う") },
        { zh: "玩", pinyin: "wán", translations: tr("놀기", "Play", "遊ぶ") },
        { zh: "游戏", pinyin: "yóuxì", translations: tr("게임", "Games", "ゲーム") },
      ],
    },
  ],
  practice: [
    {
      id: "hsk30_l18_p1",
      type: "choice",
      subtype: "meaning_to_vocab_choice",
      prompt: { cn: "下面哪一句在问「课余做什么」？", kr: "방과 후에 뭐 하냐는 말은?", en: "Which asks what you do after class?", jp: "放課後に何をするか聞いているのは？" },
      options: opt4(
        ["下课后你做什么？", "수업 끝나면 뭐 해?", "What do you do after class?", "放課後何する？"],
        ["今天天气怎么样？", "날씨 어때?", "How’s the weather?", "天気は？"],
        ["你怎么去学校？", "학교 어떻게 가?", "How do you get to school?", "学校へどう行く？"],
        ["这件衣服多少钱？", "옷 얼마?", "How much is this?", "いくら？"]
      ),
      answer: "A",
      explanation: { cn: "「下课后……做什么」指向课余活动。", kr: "방과 후 활동.", en: "After-class activities.", jp: "放課後の活動。" },
    },
    {
      id: "hsk30_l18_p2",
      type: "choice",
      subtype: "zh_to_pinyin_choice",
      prompt: { cn: "「听见」的拼音是？", kr: "「听见」의 병음은?", en: "What’s the pinyin for 听见?", jp: "「听见」のピンインは？" },
      options: pinOpts("tīngjiàn", "tīngjiān", "tīnjian", "tīngjiǎn"),
      answer: "A",
      explanation: { cn: "「听见」读作 tīngjiàn。", kr: "「听见」는 tīngjiàn입니다.", en: "Say tīngjiàn.", jp: "読みは tīngjiàn です。" },
    },
    {
      id: "hsk30_l18_p3",
      type: "choice",
      subtype: "dialogue_response",
      prompt: { cn: "「我只喜欢听歌。」里的「只」表示：", kr: "「只」는?", en: "In 我只喜欢听歌, 只 means:", jp: "「只」は？" },
      options: opt4(
        ["范围仅限于后面所说的事", "뒤에 나온 것만", "Only what follows", "後に続くことだけ"],
        ["表示非常喜欢", "아주 좋아", "Really like a lot", "とても好き"],
        ["表示刚刚才开始喜欢", "방금 좋아짐", "Just started liking", "今好きになった"],
        ["表示和别人一样喜欢", "남과 같이", "Same as others", "みんなと同じ"]
      ),
      answer: "A",
      explanation: { cn: "「只」限制喜欢的方式为「听」而非「唱」。", kr: "「只」로 범위 제한.", en: "只 narrows to listening.", jp: "「只」は範囲を限る。" },
    },
    {
      id: "hsk30_l18_p4",
      type: "choice",
      subtype: "dialogue_response",
      prompt: { cn: "「你听见有人在唱歌吗？」主要在问：", kr: "「听见」로 묻는 것은?", en: "That question mainly asks whether you:", jp: "その質問は主に何を聞いている？" },
      options: opt4(
        ["是否感知到歌声（听没听到）", "소리가 들리는지", "Notice the singing", "歌が聞こえるか"],
        ["你会不会唱这首歌", "이 노래를 부를 줄 아는지", "Can you sing it", "歌えるか"],
        ["你想不想去唱歌", "노래하러 갈래", "Want to go sing", "歌いに行きたいか"],
        ["这首歌多少钱", "노래 값", "Song’s price", "値段"]
      ),
      answer: "A",
      explanation: { cn: "「听见」表感知到声音，不是问会不会唱。", kr: "「听见」는 들림 여부.", en: "听见 checks if you hear it.", jp: "「听见」は聞こえるか。" },
    },
  ],
  aiPractice: {
    speaking: ["下课后你做什么？", "我听歌，也玩电脑游戏。", "游戏好玩儿吗？", "我只喜欢听歌。", "很好听。", "你听见有人在唱歌吗？", "你妹妹唱歌真好听。"],
    chatPrompt: "请只用本课「唱、歌、玩、游戏、好玩儿、找、小朋友、只、听、听见、好听」等词语谈课余活动与声音；不要写成问学习几个小时。",
    prompt: {
      zh: "请只用本课「唱、歌、玩、游戏、好玩儿、找、小朋友、只、听、听见、好听」等词语谈课余活动与声音；不要写成问学习几个小时。",
      kr: "노래·게임·듣기만. 공부 시간은 빼 주세요.",
      en: "Hobbies & sounds—no study hours.",
      jp: "趣味と音だけ。勉強時間は書かない。",
    },
    situationDialogue: {
      defaultScenarioIndex: 0,
      scenarios: [
        {
          id: "l18_after_class",
          situation: { zh: "会话一：课后", kr: "회화1", en: "Dialogue 1", jp: "会話1" },
          aiRole: { zh: "李明", kr: "리밍", en: "Li Ming", jp: "李明" },
          studentRole: { zh: "汤姆", kr: "탐", en: "Tom", jp: "トム" },
          goal: { zh: "", kr: "", en: "", jp: "" },
          expressions: [
            { zh: "下课后你做什么？", pinyin: "Xià kè hòu nǐ zuò shénme?", kr: "수업 끝나면 뭐 해?", en: "What do you do after class?", jp: "放課後何する？" },
            { zh: "我听歌，也玩电脑游戏。", pinyin: "Wǒ tīng gē, yě wán diànnǎo yóuxì.", kr: "노래 듣고 게임도 해요.", en: "I listen to music and play games.", jp: "音楽を聴いてゲームもします。" },
          ],
          rounds: [{ aiLine: "今天真累！", studentRefs: ["下课后你做什么？"], acceptable: ["下课后你做什么？"], closeAnswers: ["做什么", "下课"] }],
        },
      ],
    },
  },
  aiLearning: {
    abilityPoints: [
      { zh: "会用「做什么」问课余安排。", pinyin: "zuò shénme", kr: "방과 후 묻기.", en: "Ask after-class plans.", jp: "「做什么」で聞く。" },
      { zh: "能区分「听」与「听见」。", pinyin: "tīng", kr: "듣기 vs 들림.", en: "听 vs 听见.", jp: "「听」「听见」。" },
    ],
    lessonExplain: {
      focusMinimal: true,
      learningGoals: [{ zh: "本课谈玩乐与声音，不是谈学习时长。", pinyin: "kè hòu", kr: "취미·소리.", en: "Play & sound—not study hours.", jp: "遊びと音。勉強時間ではない。" }],
      practiceFocus: [],
      scenarioSummary: {
        zh: "会话一：听歌与游戏。会话二：只喜欢听与好听。会话三：听见唱歌与妹妹唱得好听。",
        kr: "노래·게임 → 취향 → 들림·칭찬.",
        en: "Music/games · taste · hearing & praise.",
        jp: "音楽・ゲーム／趣味／聞こえ方。",
      },
      scenarioSummaryLines: [{ zh: "「好玩儿」多形容游戏、活动有趣。", pinyin: "hǎowánr", kr: "재미있음.", en: "好玩儿 = fun.", jp: "「好玩儿」はおもしろさ。" }],
      confusionPoints: [],
    },
    freeAskPlaceholder: { zh: "例如：「好听」能形容人吗？", kr: "「好听」?", en: "好听 for people?", jp: "「好听」は人に？" },
    freeAskExamples: { zh: ["「只」放在动词前还是后？", "听见后面一定要说人吗？"], kr: ["「只」?", "听见?"], en: ["Where does 只 go?", "Must 听见 have a person?"], jp: ["「只」の位置は？", "「听见」は人が必要？"] },
    coreExpressions: [
      {
        expr: "下课后你做什么？ / 我听歌。",
        pinyin: "Xià kè hòu nǐ zuò shénme? / Wǒ tīng gē.",
        usage: { zh: "询问并回答课余活动。", kr: "방과 후 일정.", en: "After-class activities.", jp: "放課後の予定。" },
      },
    ],
  },
});
