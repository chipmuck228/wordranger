# Review packet

Status: Candidate V0 / Experimental / APPROVED_FOR_EXPERIMENT only

This file is machine-generated. It is not a human approval.

- Pack: `meal-scene-expansion-batch-01`
- Registry status: `APPROVED_FOR_EXPERIMENT`
- Target: `16ea1697-0049-55fe-9181-03d129352a17` / `cup#drink-container`
- Canonical key: `lex-0346-1`
- Content fingerprint: `51dc51dc1a321f2af03126d75db1823e59eed61f7e3168c47f4b360611997a40`
- Human review: APPROVED
- Stale state: CURRENT

## Notices

- 已进入实验 Context Lab，不代表 Standard 或生产批准
- Candidate V0 / APPROVED_FOR_EXPERIMENT only.
- 不是 Standard，也不接入生产 /train。
- 机器验证通过不等于人工批准。
- 保存审核决定不会修改 registry 或 promotion。
- LOCAL_INTERNAL_REVIEWER is not a production identity.

## Machine checks

- PASS CONTENT_VALID: Scene Content validator passed.
- PASS REGISTRY_STATUS: Registry status is APPROVED_FOR_EXPERIMENT.
- PASS EXPERIMENT_RUNTIME: Expansion pack is APPROVED_FOR_EXPERIMENT only.
- PASS ORIGINAL_FOUR_WORD_PACK_UNCHANGED: Original four-word Meal pack remains identifiable.
- PASS PROBE_NO_FORM_LEAK: Probe student copy does not include the target form.

## Home breakfast (`home-breakfast-v0`)

- contains(home-cup, home-drink) `home-fact-contains-cup-drink`

### Probe

Student: 写出当前物品的英文单词

Audit: GUIDED / form visible false / leak pass

### PRESENT_CONTEXT

Student: 桌上有盛饮料的容器。先看看它在场景里的位置。

Audit: GUIDED / form visible false / leak pass

### OBSERVE_RELATION

Student: 这个容器用来盛饮料。

Audit: GUIDED / form visible false / leak pass

### PRESENT_LEXICAL_FORM

Student: 这是教学，不是测试。看一看这个词和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### SHOW_CONTRAST

Student: 盛饮料的容器和盛食物的碗不是同一个东西。

Audit: GUIDED / form visible false / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: Produce the English word for the highlighted drink container.

Audit: ASSESSABLE / form visible false / leak pass

### RECONNECT_FORM

Student: 这是强化，不是测试。重新看一看这个盛饮料容器和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: 根据这个盛饮料容器的意思，写出英文单词。当前页面没有完整答案或拼写提示。

Audit: ASSESSABLE / form visible false / leak pass

### Frozen Task Preview

Student: Produce the English word for the highlighted drink container.

Audit: PREVIEW / form visible false / leak pass

## Restaurant meal (`restaurant-meal-v0`)

- contains(rest-cup, rest-drink) `rest-fact-contains-cup-drink`

### Probe

Student: 写出当前物品的英文单词

Audit: GUIDED / form visible false / leak pass

### PRESENT_CONTEXT

Student: 桌上有盛饮料的容器。先看看它在场景里的位置。

Audit: GUIDED / form visible false / leak pass

### OBSERVE_RELATION

Student: 这个容器用来盛饮料。

Audit: GUIDED / form visible false / leak pass

### PRESENT_LEXICAL_FORM

Student: 这是教学，不是测试。看一看这个词和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### SHOW_CONTRAST

Student: 盛饮料的容器和盛食物的碗不是同一个东西。

Audit: GUIDED / form visible false / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: Produce the English word for the highlighted drink container.

Audit: ASSESSABLE / form visible false / leak pass

### RECONNECT_FORM

Student: 这是强化，不是测试。重新看一看这个盛饮料容器和它的英文词形。

Audit: GUIDED / form visible true / leak pass

### FADE_FORM

Student: 完整英文已经收起。下面是提示，不是答案。

Audit: GUIDED / form visible false / leak pass

### RECALL

Student: 根据这个盛饮料容器的意思，写出英文单词。当前页面没有完整答案或拼写提示。

Audit: ASSESSABLE / form visible false / leak pass

### Frozen Task Preview

Student: Produce the English word for the highlighted drink container.

Audit: PREVIEW / form visible false / leak pass

## Known limitations

- drink / plate / eat / choose are not in this review.
- Saving APPROVED does not change pack or registry status.
- This is not 1600-word coverage.
