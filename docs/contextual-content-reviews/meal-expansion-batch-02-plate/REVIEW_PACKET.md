# Review packet

Status: Candidate V0 / Experimental / CANDIDATE only

This file is machine-generated. It is not a human approval.

- Pack: `meal-scene-expansion-batch-02`
- Registry status: `CANDIDATE`
- Target: `4ca2bd15-e50d-531b-a379-30eebab1c9c2` / `plate#food-support`
- Canonical key: `lex-1036-1`
- Selected meaning: `盘子`
- Content fingerprint: `4ce843238a0b5b4ca570b335e75ed2549b9af94acf536144812ecc1c86ed032b`
- Human review: APPROVED
- Stale state: CURRENT

## Notices

- “通过审核”只记录人工审核结果。
- Candidate V0 / APPROVED_FOR_EXPERIMENT only.
- 不是 Standard，也不接入生产 /train。
- 机器验证通过不等于人工批准。
- 保存审核决定不会修改 registry 或 promotion。
- LOCAL_INTERNAL_REVIEWER is not a production identity.

## Machine checks

- PASS CONTENT_VALID: Scene Content validator passed.
- PASS REGISTRY_STATUS: Registry status is CANDIDATE.
- PASS EXPERIMENT_RUNTIME: Pack remains CANDIDATE and is not approved for experiment.
- PASS ORIGINAL_FOUR_WORD_PACK_UNCHANGED: Original four-word Meal pack remains identifiable.
- PASS PROBE_NO_FORM_LEAK: Probe student copy does not include the target form.

## Home breakfast (`home-breakfast-v0`)

- supports(home-plate, home-served-food) `home-fact-supports-plate-food`

### Probe

Student: 写出当前物品的英文单词

Audit: GUIDED / form visible false / leak pass

### PRESENT_CONTEXT

Student: 桌上有一个较平的盘子。先看看它在场景里的位置。

Audit: GUIDED / form visible false / leak pass

### OBSERVE_RELATION

Student: 这个盘子用来放食物。

Audit: GUIDED / form visible false / leak pass

### PRESENT_LEXICAL_FORM

Student: 这是教学，不是测试。看一看这个词和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### SHOW_CONTRAST

Student: 这个较平的盘子用来放食物，不是那个较深、装着汤的碗。

Audit: GUIDED / form visible false / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: Produce the English word for the highlighted food support.

Audit: ASSESSABLE / form visible false / leak pass

### RECONNECT_FORM

Student: 这是强化，不是测试。重新看一看这个放食物的盘子和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: 根据这个放食物的盘子的意思，写出英文单词。当前页面没有完整答案或拼写提示。

Audit: ASSESSABLE / form visible false / leak pass

### Frozen Task Preview

Student: Produce the English word for the highlighted food support.

Audit: PREVIEW / form visible false / leak pass

## Restaurant meal (`restaurant-meal-v0`)

- supports(rest-plate, rest-served-food) `rest-fact-supports-plate-food`

### Probe

Student: 写出当前物品的英文单词

Audit: GUIDED / form visible false / leak pass

### PRESENT_CONTEXT

Student: 桌上有一个较平的盘子。先看看它在场景里的位置。

Audit: GUIDED / form visible false / leak pass

### OBSERVE_RELATION

Student: 这个盘子用来放食物。

Audit: GUIDED / form visible false / leak pass

### PRESENT_LEXICAL_FORM

Student: 这是教学，不是测试。看一看这个词和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### SHOW_CONTRAST

Student: 这个较平的盘子用来放食物，不是那个较深、装着汤的碗。

Audit: GUIDED / form visible false / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: Produce the English word for the highlighted food support.

Audit: ASSESSABLE / form visible false / leak pass

### RECONNECT_FORM

Student: 这是强化，不是测试。重新看一看这个放食物的盘子和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: 根据这个放食物的盘子的意思，写出英文单词。当前页面没有完整答案或拼写提示。

Audit: ASSESSABLE / form visible false / leak pass

### Frozen Task Preview

Student: Produce the English word for the highlighted food support.

Audit: PREVIEW / form visible false / leak pass

## Known limitations

- This packet reviews only the registered target.
- Saving APPROVED does not change pack or registry status.
- This is not 1600-word coverage.
