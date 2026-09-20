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
| **STRENGTHEN** | Only the support that matches the Probe weakness under repair. Meal V0 implements spoon **active-recall weakness** only: lexical form reveal, then a spelling cue, then a frozen typing check. |

`FULL_ANSWER_REVEAL` after a correct response must not be treated as independent retrieval. Frozen Evidence still uses `hintCount` / evaluator outcome. A revealed answer plus a later correct type-in is not `INDEPENDENT_CORRECT` if hints were used.

Frozen `ASSISTED_CORRECT` after this STRENGTHEN verification means the check happened after support exposure. It is not a new Candidate Evidence outcome. It is not cold independent retrieval and does not prove long-term independent recall. A later delayed task/session is still required to test that.

---

## Support is not Evidence

Support presentation is Candidate orchestration. It is not a `LearningEvidence` field, not a new Evidence outcome, and not mastery.

Frozen `hintCount` still collapses every assist into `ASSISTED_CORRECT`. The information loss between a Level-1 cue and a full reveal remains a **capability gap**. This document does not close it.

---

## Meal V0 application

- Cold Probe screens hide support by default. The Meal scene may show unlabeled objects. No phonetic, audio, gloss-as-answer, synonym/antonym, spelling split, full use explanation, or spoon/fork teaching contrast before the learner answers.
- Existing Meal BUILD guided steps remain the teaching phase and must be labeled as such. BUILD still uses scene → relation → contrast → recall. It does not reuse the STRENGTHEN support sequence.
- Meal STRENGTHEN for spoon active-recall weakness uses a different sequence: reconnect the scene object to `spoon` and the real bundled gloss → fade the full form and show a generated spelling cue → frozen `ACTIVE_RECALL_TYPING` verification.
- Lexical form reveal and spelling cue are Candidate support exposures. They are recorded only after the server issues and the learner acknowledges that step. The client cannot claim exposure.
- Because those supports were shown in the same experience, the verification `StudentAction.hintCount` is server-authored as `> 0`. Correct typing therefore becomes frozen `ASSISTED_CORRECT`. Candidate does not add an Evidence outcome.
- STRENGTHEN for other Meal words, other weaknesses, and delayed independent retrieval remains pending.
