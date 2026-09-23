# Daily Training Experience

Student-facing flow for 今日训练. Internal architecture lives in `docs/ARCHITECTURE.md`.

## Home

让学过的单词，在需要时想得起来

[继续今天的学习] → `/train`

自由练习 is an explanation on the homepage. Game routes stay available by direct URL and are not first-level home entries.

场景学习 may link to `/play/context-lab` only when the Context Lab gate is on and Homepage can treat the content source as startable. Otherwise it shows 场景学习正在准备中.

After a round, home may show: 今天已经完成 1 轮训练.

## Start

Home → `/train`

WordRanger

今日训练

系统会安排今天最值得练的单词。

[开始]

Then: 正在准备今天的训练…

## Train

Stay on `/train`. The system presents one task at a time.

Progress is simple: `3 / 8`.

A small game label may appear (单词泡泡, 连连看, 贪食蛇, 单词闯关). The task is the focus.

If the interaction is unfamiliar, one line of help is enough:

- 连连看: 先点左边，再找到右边最合适的一项。
- 贪食蛇: 控制小蛇，吃到正确答案。

Do not ask which game is next.

## Feedback

Immediate result after the answer. Then [继续].

Wrong answers stay supportive and factual. No HP, penalty, or score deduction.

## Next item

[继续] → 下一题 → the next interaction.

If the renderer changes, present it naturally. Do not ask permission to switch games.

## Complete

这一轮完成

完成 8 个

答对 X 个

今天又稳了一点。

Optional: 今天多留意：quiet、borrow、through

[再来一轮] [回首页]

再来一轮 starts a fresh round from the updated learner model. It does not replay the previous plan.

## What the student does not choose

The student does not pick a word list, skill, new/review count, or game.

The student only starts, interacts, answers, and continues.
