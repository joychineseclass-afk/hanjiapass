# Lumina 全平台 i18n 文案键名总表（商业级）

## 设计原则

1. **全部使用 `模块_功能` 命名**（如 `review_start`、`lesson_dialogue`、`practice_submit`）
2. **不在代码中写死中文**，统一使用 `t("key")`
3. **所有模块必须用 key**：按钮、提示、标题、Tab、说明

## 文件结构

```
ui/i18n/
├── common.json    # 全平台通用
├── nav.json       # 导航栏
├── nav_stroke     # 笔顺（nav.json 中）
├── hsk.json       # HSK 模块
├── lesson.json    # 课程 Lesson
├── practice.json  # 练习
├── review.json    # 错题复习
├── audio.json     # 发音
├── progress.json  # 学习进度
├── system.json    # 系统提示
├── teacher.json   # 教师系统
├── student.json   # 学生系统
├── future.json    # 未来模块预留
├── index.js       # 加载器
└── README.md
```

## 一、Common（全平台通用）

| key | CN | KR | EN |
|-----|----|----|-----|
| common_ok | 确定 | 확인 | OK |
| common_cancel | 取消 | 취소 | Cancel |
| common_confirm | 确认 | 확인 | Confirm |
| common_back | 返回 | 뒤로 | Back |
| common_next | 下一步 | 다음 | Next |
| common_previous | 上一步 | 이전 | Previous |
| common_close | 关闭 | 닫기 | Close |
| common_open | 打开 | 열기 | Open |
| common_save | 保存 | 저장 | Save |
| common_delete | 删除 | 삭제 | Delete |
| common_edit | 编辑 | 편집 | Edit |
| common_search | 搜索 | 검색 | Search |
| common_loading | 加载中... | 불러오는 중... | Loading... |
| common_submit | 提交 | 제출 | Submit |
| common_retry | 重试 | 다시 시도 | Retry |
| common_start | 开始 | 시작 | Start |
| common_finish | 完成 | 완료 | Finish |
| common_continue | 继续 | 계속 | Continue |
| common_view_more | 查看更多 | 더보기 | View more |

## 二、导航栏（Navigation）

| key | CN | KR | EN |
|-----|----|----|-----|
| nav_home | 首页 | 홈 | Home |
| nav_courses | 课程 | 과정 | Courses |
| nav_hsk | HSK学习 | HSK 학습 | HSK Learning |
| nav_kids | 少儿中文 | 어린이 중국어 | Kids Chinese |
| nav_travel | 旅游中文 | 여행중국어 | Travel Chinese |
| nav_business | 商务中文 | 비즈니스 중국어 | Business Chinese |
| nav_culture | 文化 | 문화 | Culture |
| nav_hanja | 汉字 | 한자 | Hanzi |
| nav_strokes | 笔顺 | 필순 | Strokes |
| nav_speaking | 会话 | 회화 | Speaking |
| nav_review | 复习 | 복습 | Review |
| nav_resources | 资源 | 자료 | Resources |
| nav_teacher | 教师专区 | 교사 전용 | Teacher |
| nav_student | 学生 | 학생 | Student |
| nav_my_learning | 我的学习 | 내 학습 | My Learning |
| nav_settings | 设置 | 설정 | Settings |
| nav_language | 语言 | 언어 | Language |

## 三、HSK 模块

| key | CN | KR | EN |
|-----|----|----|-----|
| hsk_title | HSK学习 | HSK 학습 | HSK Learning |
| hsk_level | 等级 | 레벨 | Level |
| hsk_version | 版本 | 버전 | Version |
| hsk_select_level | 选择等级 | 레벨 선택 | Select level |
| hsk_start_learning | 开始学习 | 학습 시작 | Start learning |
| hsk_lessons_total | 共{n}课 | 총{n}과 | {n} lessons |
| hsk_words_total | 共{n}词 | 총{n}단어 | {n} words |
| hsk_search_word | 搜索单词 | 단어 검색 | Search word |
| hsk_choose_lesson | 选择课程 | 수업 선택 | Choose lesson |

## 四、课程 Lesson

| key | CN | KR | EN |
|-----|----|----|-----|
| lesson_words | 单词 | 단어 | Vocabulary |
| lesson_dialogue | 会话 | 회화 | Dialogue |
| lesson_grammar | 语法 | 문법 | Grammar |
| lesson_extension | 扩展表达 | 확장 표현 | Extension |
| lesson_practice | 练习 | 연습 | Practice |
| lesson_ai_practice | AI练习 | AI 학습 | AI Practice |

## 五、Practice（练习）

| key | CN | KR | EN |
|-----|----|----|-----|
| practice_correct | 正确 | 정답 | Correct |
| practice_wrong | 错误 | 오답 | Wrong |
| practice_explanation | 解析 | 해설 | Explanation |
| practice_submit | 提交答案 | 제출하기 | Submit |
| practice_question_number | 第{n}题 | 제{n}문제 | Question {n} |

## 六、Review（错题复习）

| key | CN | KR | EN |
|-----|----|----|-----|
| review_mode | 错题复习 | 오답 복습 | Wrong Answer Review |
| review_start | 复习 | 복습 | Review |
| review_continue | 继续复习 | 계속 복습 | Continue Review |
| review_current_lesson | 本课 | 본과 | This Lesson |
| review_current_level | 本级 | 본급 | This Level |
| review_all_wrong | 全部错题 | 전체 오답 | All Wrong |
| review_completed | 复习完成 | 복습 완료 | Review Completed |

## 七、Audio（发音）

| key | CN | KR | EN |
|-----|----|----|-----|
| audio_play | 播放 | 재생 | Play |
| audio_repeat | 重复 | 반복 | Repeat |
| audio_listen | 听 | 듣기 | Listen |

## 八、Progress（学习进度）

| key | CN | KR | EN |
|-----|----|----|-----|
| progress_title | 学习进度 | 학습 진행 | Learning Progress |
| progress_accuracy | 正确率 | 정답률 | Accuracy |

## 九、System（系统提示）

| key | CN | KR | EN |
|-----|----|----|-----|
| system_loading | 加载中 | 로딩 중 | Loading |
| system_error | 系统错误 | 시스템 오류 | System Error |

## 十、未来模块预留

| key | 说明 |
|-----|------|
| ai_chat | AI对话 |
| ai_explain | AI讲解 |
| ai_practice | AI练习 |
| game_mode | 游戏模式 |
| leaderboard | 排行榜 |
| certificate | 证书 |
| level_test | 等级测试 |

## 扩展新语言

增加 `jp.json`、`es.json` 等，在 `jsonToDict` 中支持新字段即可。系统 UI 会自动切换语言。
