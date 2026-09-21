# Review packet

Status: Candidate / Experimental / Not Approved

This file is machine-generated. It is not a human approval.

- Pack: `meal-scene-expansion-batch-01`
- Registry status: `CANDIDATE`
- Target: `16ea1697-0049-55fe-9181-03d129352a17` / `cup#drink-container`
- Canonical key: `lex-0346-1`
- Content fingerprint: `51dc51dc1a321f2af03126d75db1823e59eed61f7e3168c47f4b360611997a40`
- Human review: PENDING
- Stale state: CURRENT

## Notices

- “通过审核”只记录人工审核结果。
- 内容仍是 Candidate。
- 进入实验运行需要后续独立代码变更和提交。
- 机器验证通过不等于人工批准。
- LOCAL_INTERNAL_REVIEWER is not a production identity.

## Machine checks

- PASS CONTENT_VALID: Scene Content validator passed.
- PASS REGISTRY_CANDIDATE: Registry status is CANDIDATE.
- PASS NOT_APPROVED_RUNTIME: Expansion pack is not returned by getApprovedExperimentSceneContent.
- PASS APPROVED_PACK_UNCHANGED: Approved Context Lab pack is still the four-word fixture.
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
