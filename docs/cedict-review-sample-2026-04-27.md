# CC-CEDICT 试跑样本报告（Round 1 · 仅草稿）

**角色**: Agent A · Dictionary Data  
**日期**: 2026-04-27  
**性质**: 本文件内全部四语释义与例句均为 **draft 草稿**，**不代表**词条已正式进入词典，**禁止**据此将任何条目的 `qualityLevel` 升级为 `reviewed` / `teaching` / `courseReady`。

---

## 1. `check-dictionary-data.mjs` 执行说明

**本地必跑命令**（本 Agent 执行环境无法可靠捕获 `node` 的 stdout，以下数值需你在仓库根目录复核）:

```bash
cd C:\Users\kindh\Documents\GitHub\hanjiapass
npm run check:dictionary
```

请将完整终端输出粘贴到本节后作为归档（当前 Round 1 报告中此节留空待补）。

---

## 2. 数据规模与统计（部分为只读推断，需脚本复核）


| 项目                                                                   | 数值 / 说明                                                              | 复核方式                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| `data/dictionary/dictionary-index.json` 索引行数（`"id":` 出现次数）           | **131**（工具按行匹配；若索引为多行 JSON 则为近似）                                     | `npm run check:dictionary` 汇总 |
| `data/dictionary/words-cedict-001.json` 中 `"needsReview": true` 出现次数 | **95**（每词条通常一行）                                                      | 同上 + `grep`                   |
| `data/dictionary/cedict/cedict-index.json`                           | 单行超大 JSON，**不宜**用按行 `rg` 统计 `needsReview` 总数；全量统计须本地 `node` 解析       | 本地脚本或 `check:dictionary`      |
| `data/dictionary/cedict/words-cedict-001.json` 首部词条                  | `cedict_full_000001` … 均为 `qualityLevel: "raw"`, `needsReview: true` | 见 §3 样本 A                     |


**缺字段统计（规则摘要）**  
对 `qualityLevel: raw` 且 `needsReview: true` 的 CC-CEDICT 行，`check-dictionary-data.mjs` 允许仅 `meaning.en`；非 raw 或已审条目则要求 `meaning` / `example` 的 **cn / kr / en / jp** 与 `examplePinyin` 齐全。具体缺失分布以脚本输出为准。

---

## 3. 十条试跑样本选取策略

- **样本 A（3 条）**: `cedict/words-cedict-001.json` 文件序首部的 `cedict_full_000001`–`cedict_full_000003`（符号与紧急号码，**教学价值低**，用于验证工作流）。
- **样本 B（7 条）**: 主库 `words-cedict-001.json` 中 `cedict_word_0006`–`cedict_word_0012`（常见教学词，**更适合**作为四语草稿质量评审）。

---

## 4. 十条 · 四语释义与例句 **草稿**（每条均含 confidence / 风险点）

> **confidence**: `high` | `medium` | `low`  
> **规则**: `low` / 含地域或制度敏感表述的条目 **必须** 进入 §5「待人工确认清单」后再考虑入库。

### 样本 A-1 · `cedict_full_000001`


| 字段                          | 值              |
| --------------------------- | -------------- |
| word / traditional / pinyin | `%` / `%` / pā |
| 现有 meaning.en（数据内）          | percent (Tw)   |



|               | 草稿                                                                                      |
| ------------- | --------------------------------------------------------------------------------------- |
| meaning.cn    | 百分号；在台湾等地常指「百分比」符号。                                                                     |
| meaning.kr    | 퍼센트 기호; 대만 등에서는 백분율을 나타낼 때 쓰는 기호로도 쓰입니다.                                                |
| meaning.en    | Percent sign; in some regions (e.g. Taiwan usage in sources) associated with “percent.” |
| meaning.jp    | パーセント記号。地域によっては「パーセント」を指す記号として扱われます。                                                    |
| example.cn    | 增长了 10%。                                                                                |
| example.kr    | 10% 늘었습니다.                                                                              |
| example.en    | It increased by 10%.                                                                    |
| example.jp    | 10％増えました。                                                                               |
| examplePinyin | zēngzhǎng le shí pā.                                                                    |


- **confidence（释义四语）**: cn **medium**, kr **medium**, en **medium**, jp **medium**（依赖 Tw 标注与地域用法）  
- **风险点**: 词条非汉字；教学场景优先级低；英源 `percent (Tw)` 需产品决定是否保留地域标注。

---

### 样本 A-2 · `cedict_full_000002`


| 字段                          | 值                                                                     |
| --------------------------- | --------------------------------------------------------------------- |
| word / traditional / pinyin | `110` / `110` / yāoyāolíng                                            |
| 现有 meaning.en               | the emergency number for law enforcement in Mainland China and Taiwan |



|               | 草稿                                                          |
| ------------- | ----------------------------------------------------------- |
| meaning.cn    | 中国大陆、台湾等地报警用的电话号码（匪警）。                                      |
| meaning.kr    | 중국 본토·대만 등에서 경찰에 신고할 때 부르는 번호(일명 110).                      |
| meaning.en    | Police emergency number in mainland China and Taiwan (110). |
| meaning.jp    | 中国本土や台湾などで警察への緊急通報に使われる番号（110）。                             |
| example.cn    | 遇到危险请拨打 110。                                                |
| example.kr    | 위급할 때 110에 전화하세요.                                           |
| example.en    | In an emergency, dial 110 for the police.                   |
| example.jp    | 危険なときは110番に電話してください。                                        |
| examplePinyin | yù dào wēixiǎn qǐng bōdǎ yāoyāolíng.                        |


- **confidence**: cn **high**, kr **high**, en **high**, jp **high**  
- **风险点**: 实际服务以当地法规为准；词典释义需与产品「是否向全球用户展示地域号码」一致。

---

### 样本 A-3 · `cedict_full_000003`


| 字段                          | 值                             |
| --------------------------- | ----------------------------- |
| word / traditional / pinyin | `119` / `119` / yāoyāojiǔ     |
| 现有 meaning.en               | （以数据文件内 CC-CEDICT 英文为准；常见为火警） |


> 因单行 chunk 在工具中截断，**英文原义以本地 JSON 为准**。下表按常见释义起草，**confidence 降级**。


|               | 草稿（假设 en 为 fire emergency）                     |
| ------------- | ---------------------------------------------- |
| meaning.cn    | 中国大陆等地火警电话。                                    |
| meaning.kr    | 중국 본토 등에서 화재 신고용 번호(일명 119).                   |
| meaning.en    | Fire emergency number in mainland China (119). |
| meaning.jp    | 中国本土などで火災通報に使われる番号（119）。                       |
| example.cn    | 发生火灾请拨打 119。                                   |
| example.kr    | 화재가 나면 119에 신고하세요.                             |
| example.en    | Call 119 if there is a fire.                   |
| example.jp    | 火事のときは119番に通報してください。                           |
| examplePinyin | fāshēng huǒzāi qǐng bōdǎ yāoyāojiǔ.            |


- **confidence**: 全体 **low**（未在报告中核对原始 `rawEnglishDefinitions` 全文）  
- **风险点**: **必须** 人工核对 `cedict_full_000003` 的 `meaning.en` / `rawEnglishDefinitions` 后再定稿。

---

### 样本 B-1 · `cedict_word_0006` 中国


|               | 草稿                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| meaning.cn    | 东亚国家名称；中文语境中常特指中华人民共和国，亦可在历史/文化语境中泛指中华文化圈相关含义（产品需定调）。                                                     |
| meaning.kr    | 동아시아의 국가 이름. 학습용으로는 보통 중화인민공화국을 가리키지만, 맥락에 따라 문화권을 넓게 이야기할 때도 있습니다.                                       |
| meaning.en    | Name of a country in East Asia; in learning materials often refers to the PRC (usage depends on context). |
| meaning.jp    | 東アジアの国名。教材では文脈により中华人民共和国を指すことが多い。                                                                         |
| example.cn    | 我在中国学习中文。                                                                                                 |
| example.kr    | 저는 중국에서 중국어를 배웁니다.                                                                                        |
| example.en    | I study Chinese in China.                                                                                 |
| example.jp    | 私は中国で中国語を勉強しています。                                                                                         |
| examplePinyin | wǒ zài zhōngguó xuéxí zhōngwén.                                                                           |


- **confidence**: cn **medium**, kr **high**, en **medium**, jp **high**  
- **风险点**: **政治与地理表述**敏感；`meaning.en` 草稿中 “PRC” 是否采用需 **产品 / 法务** 定调；**禁止**静默覆盖。

---

### 样本 B-2 · `cedict_word_0007` 学习


|               | 草稿                                                        |
| ------------- | --------------------------------------------------------- |
| meaning.cn    | 通过练习、听讲等方式获得知识或技能。                                        |
| meaning.kr    | 공부나 연습 등을 통해 지식이나 기술을 익히는 것.                              |
| meaning.en    | To acquire knowledge or skills through study or practice. |
| meaning.jp    | 勉強や練習などによって知識や技能を身につけること。                                 |
| example.cn    | 我每天学习汉语。                                                  |
| example.kr    | 저는 매일 중국어를 공부합니다.                                         |
| example.en    | I study Chinese every day.                                |
| example.jp    | 私は毎日中国語を勉強しています。                                          |
| examplePinyin | wǒ měitiān xuéxí hànyǔ.                                   |


- **confidence**: 四语 **high**  
- **风险点**: 与已存在「教学示例句」去重（仓库内另有审校例句时可合并策略）。

---

### 样本 B-3 · `cedict_word_0008` 老师


|               | 草稿                                                |
| ------------- | ------------------------------------------------- |
| meaning.cn    | 对教师的尊称；学校里传授知识的人。                                 |
| meaning.kr    | 학교 등에서 가르치는 사람을 높여 부르는 말; 선생님.                    |
| meaning.en    | A teacher; title or term for someone who teaches. |
| meaning.jp    | 学校などで教える人；先生。                                     |
| example.cn    | 王老师，您好！                                           |
| example.kr    | 선생님, 안녕하세요!                                       |
| example.en    | Hello, Teacher Wang!                              |
| example.jp    | 王先生、こんにちは！                                        |
| examplePinyin | Wáng lǎoshī, nín hǎo!                             |


- **confidence**: 四语 **high**  
- **风险点**: 韩文用「선생님」与词头「老师」对齐是否要在释义中写明「汉语词形为老师」— 待教研习惯确认。

---

### 样本 B-4 · `cedict_word_0009` 学生


|               | 草稿                                                                  |
| ------------- | ------------------------------------------------------------------- |
| meaning.cn    | 在学校等机构学习的人。                                                         |
| meaning.kr    | 학교 등에서 배우는 사람.                                                      |
| meaning.en    | A student; a person who studies at a school or similar institution. |
| meaning.jp    | 学校などで学ぶ人。学生。                                                        |
| example.cn    | 他是我的学生。                                                             |
| example.kr    | 그는 제 학생입니다.                                                         |
| example.en    | He is my student.                                                   |
| example.jp    | 彼は私の生徒です。                                                           |
| examplePinyin | tā shì wǒ de xuéshēng.                                              |


- **confidence**: 四语 **high**  
- **风险点**: 日语「生徒/学生」用法因学段而异；当前例用「生徒」偏中小学语感，**待人工**统一术语表。

---

### 样本 B-5 · `cedict_word_0010` 中文


|               | 草稿                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------ |
| meaning.cn    | 中国的语言文字；口语中也常指汉语。                                                                          |
| meaning.kr    | 중국의 언어와 문자; 말로는 보통 중국어를 가리킵니다.                                                             |
| meaning.en    | The Chinese language and writing system; often refers to spoken Chinese in everyday usage. |
| meaning.jp    | 中国の言語と文字。口語では中国語を指すことも多い。                                                                  |
| example.cn    | 你会说中文吗？                                                                                    |
| example.kr    | 중국어 할 수 있어요?                                                                               |
| example.en    | Do you speak Chinese?                                                                      |
| example.jp    | 中国語を話せますか。                                                                                 |
| examplePinyin | nǐ huì shuō zhōngwén ma?                                                                   |


- **confidence**: 四语 **high**  
- **风险点**: 「中文」与「汉语」「普通话」分层是否要在释义区展开— 产品词典深度待定。

---

### 样本 B-6 · `cedict_word_0011` 汉字


|               | 草稿                                                                                 |
| ------------- | ---------------------------------------------------------------------------------- |
| meaning.cn    | 记录汉语的文字符号，包括简体、繁体等。                                                                |
| meaning.kr    | 중국어를 기록하는 문자; 간체·번체 등이 있습니다.                                                       |
| meaning.en    | Chinese characters used to write Chinese (simplified and traditional forms, etc.). |
| meaning.jp    | 中国語を表記する文字。簡体字・繁体字などがある。                                                           |
| example.cn    | 汉字很难，但很有趣。                                                                         |
| example.kr    | 한자는 어렵지만 재미있어요.                                                                    |
| example.en    | Chinese characters are difficult but interesting.                                  |
| example.jp    | 漢字は難しいですが、おもしろいです。                                                                 |
| examplePinyin | hànzì hěn nán, dàn hěn yǒuqù.                                                      |


- **confidence**: cn **high**, kr **high**, en **high**, jp **high**  
- **风险点**: 韩文「한자」与平台「汉字学习」模块文案是否统一— 交 i18n 统筹。

---

### 样本 B-7 · `cedict_word_0012` 工作


|               | 草稿                                 |
| ------------- | ---------------------------------- |
| meaning.cn    | 职业或日常所从事的劳动、任务。                    |
| meaning.kr    | 직업적으로 하는 일이나 맡은 임무; 일.             |
| meaning.en    | A job or task; work or employment. |
| meaning.jp    | 職業として行う仕事、または任された業務。               |
| example.cn    | 爸爸去公司工作。                           |
| example.kr    | 아빠는 회사에 출근해 일합니다.                  |
| example.en    | Dad goes to the company to work.   |
| example.jp    | 父は会社に仕事に行きます。                      |
| examplePinyin | bàba qù gōngsī gōngzuò.            |


- **confidence**: cn **high**, kr **high**, en **high**, jp **medium**（日译「仕事に行く」略生硬，更自然可为「会社に出勤する」）  
- **风险点**: 日语句式待母语微调；例句角色设定是否用「爸爸」需与全站例句风格一致。

---

## 5. 待人工确认清单（汇总）


| ID  | 议题                                              |
| --- | ----------------------------------------------- |
| A-1 | 是否收录符号 `%`；是否保留 “(Tw)” 地域标注                     |
| A-3 | 核对 `cedict_full_000003` 原始英文释义后再写四语             |
| B-1 | 「中国」政治/地理表述口径（是否使用 PRC、是否加脚注）                   |
| B-4 | 日语「生徒/学生」统一规则                                   |
| B-7 | 日语例句自然度修订                                       |
| 全局  | 草稿与已审校 `cedict_word_0001–0005` 等条目的 **去重与风格对齐** |


---

## 6. Round 2 建议（需人工批准后执行）

- 在本地 `npm run check:dictionary` **退出码 0** 的前提下，由人工从 §5 清单中勾选可入库条目，再讨论批次大小（**不得**默认 50 条）。
- 任何入库操作须单独 PR / 变更单，**且**同步更新 `DICT_DATA_VERSION`（若触及 `dictionaryEngine.js`— 该文件归属非 Round 1 范围，须 Chief Agent 另派）。

---

## 7. Round 1 完成声明

- **新建文件**: 本报告 `docs/cedict-review-sample-2026-04-27.md`  
- **未修改**: `data/`**、`scripts/**`、`ui/**`、`lang/**`  
- **未升级**: 任何 `qualityLevel` / `needsReview` 字段

