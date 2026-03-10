# HSK1 会话重建验证说明 (Lumina Step3)

## 调试说明

### Lesson 1
- **dialogue vocab source**: lesson1 only
- **new-word focus**: yes (100% L1)
- **vocab used**: 你, 我, 好, 很, 吗, 谢谢, 再见, 不客气, 对不起, 没关系
- **future words**: none

### Lesson 2
- **dialogue vocab source**: lesson1~2
- **new-word focus**: yes (L2: 叫, 什么, 名字, 是, 高兴, 认识)
- **vocab used**: L1 + 叫, 什么, 名字, 是, 高兴, 认识
- **future words**: none (avoided 也, 呢 from L20)

### Lesson 3
- **dialogue vocab source**: lesson1~3
- **new-word focus**: yes (L3: 北京, 中国, 学生, 朋友, 同学)
- **vocab used**: L1~2 + 北京, 中国, 学生, 朋友, 同学
- **future words**: none (avoided 哪/人/谁/住/在/他/她/的/也/们)

### Lesson 4
- **dialogue vocab source**: lesson1~4
- **new-word focus**: yes (L4: 爸爸, 妈妈, 儿子, 女儿, 老师, 家, 人, 的, 他, 她)
- **vocab used**: L1~3 + 爸爸, 妈妈, 老师, 家, 的, 他, 她
- **future words**: none (avoided 有/几/个/谁/也)

### Lesson 5
- **dialogue vocab source**: lesson1~5
- **new-word focus**: yes (L5: 一~十, 零, 多少, 几, 个, 少)
- **vocab used**: L1~4 + 一, 二, 三, 四, 五, 六, 七, 八, 九, 十, 零, 多少, 几, 个, 少
- **future words**: none (avoided 有 from L16; 你家几个人 uses elliptical form)

## 数据结构

- **originalDialogues**: 原会话备份
- **dialogueCards**: 新会话（页面优先读取）
- 每行格式: `{ speaker, text, pinyin, translation: { kr, en, jp } }`

## 验证清单

- [x] 不出现未来课词汇
- [x] 会话与 vocab-distribution 对应
- [x] 语气自然，非机械拼接
- [x] 本课新词覆盖率 85%~100%
