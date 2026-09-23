# Daily Training Experience

Student-facing flow for 自由练习 (`/train`). Internal architecture lives in `docs/ARCHITECTURE.md`.

“自由练习” currently means: start a small scheduled set of direct questions. It does **not** mean picking any of the 1600 words, changing LearningNeed, or bypassing the Scheduler.

## Home

让学过的单词，在需要时想得起来

自由练习

随时开始一小组单词练习。系统会安排适合当前练习的单词，你只需要直接选择或输入答案。

没有小游戏操作，适合复习、课前热身，或者每天练一点。

[开始自由练习] → `/train`

If an incomplete `/train` session id is already stored, the same link may read 继续自由练习. That uses the existing session keys, not a guessed plan.

单词由系统根据当前学习情况安排。

Home may show: 今天还没有完成练习 / 今天已完成 N 组练习.

场景学习 stays visible as 场景学习正在准备中. Homepage does not link Context Lab and does not read Context Lab availability.

Game routes stay available by direct URL and are not first-level home entries.

## Start

Home → `/train`

WordRanger

自由练习

单词由系统根据当前学习情况安排。

[开始练习]

Then: 正在准备练习…

## Train

Stay on `/train`. The system presents one task at a time using the **direct** presentation (`DIRECT_PRACTICE`).

Progress is simple: `3 / 8`.

The student sees a prompt plus ordinary choices or a text field. There is no bubble, matching, snake, or 单词闯关 chrome on new sessions.

Do not ask which game is next.

## Feedback

Immediate result after the answer. Then [下一题].

Wrong answers stay supportive and factual. No HP, penalty, or score deduction.

## Next item

[下一题] → the next direct question.

## Complete

本组练习完成

完成 8 个

答对 X 个

Optional: 今天多留意：quiet、borrow、through

[再练一组] [回首页]

再练一组 starts a fresh round from the updated learner model. It does not replay the previous plan.

## What the student does not choose

The student does not pick a word list, skill, new/review count, or game.

The student only starts, answers, and continues.
