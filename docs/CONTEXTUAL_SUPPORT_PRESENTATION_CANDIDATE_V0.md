# Contextual Support Presentation Candidate V0

> Status: **Candidate / Experimental / Not a Standard**
>
> This document defines support *presentation* only. It does not implement a support system, does not create Evidence, and does not change frozen `hintCount` semantics.

---

## Support kinds

| Kind | Meaning |
| --- | --- |
| `PHONETIC` | IPA / phonetic spelling |
| `PRONUNCIATION_AUDIO` | Spoken form |
| `MEANING_GLOSS` | Direct meaning translation |
| `CONTEXT_RELATION` | Scene relation (e.g. spoon suits soup) |
| `CONTRAST` | Teaching contrast (spoon vs fork) |
| `SPELLING_CUE` | Form / spelling scaffold |
| `FULL_ANSWER_REVEAL` | The accepted English form or equivalent |

---

## When they may appear

| Mode | Before the learner answers |
| --- | --- |
| **Probe** | Hidden by default. The Meal scene may show unlabeled objects. No phonetic, audio, gloss-as-answer, synonym/antonym, spelling split, full use explanation, or spoon/fork teaching contrast. |
| **BUILD** | Revealed in authored order after Probe, as the existing guided Meal sequence does: scene → relation → contrast → recall. |
| **STRENGTHEN** | Only the support that matches the frozen weakness under repair (when that mapping exists). V0 does not implement STRENGTHEN support. |

`FULL_ANSWER_REVEAL` after a correct response must not be treated as independent retrieval. Frozen Evidence still uses `hintCount` / evaluator outcome. A revealed answer plus a later correct type-in is not `INDEPENDENT_CORRECT` if hints were used.

---

## Support is not Evidence

Support presentation is Candidate orchestration. It is not a `LearningEvidence` field, not a new Evidence outcome, and not mastery.

Frozen `hintCount` still collapses every assist into `ASSISTED_CORRECT`. The information loss between a Level-1 cue and a full reveal remains a **capability gap**. This document does not close it.

---

## Meal V0 application

- Cold Probe screens use the breakfast objects without BUILD support blocks.
- Existing Meal BUILD guided steps remain the teaching phase and must be labeled as such.
- STRENGTHEN support for spoon (and other words) is pending.
