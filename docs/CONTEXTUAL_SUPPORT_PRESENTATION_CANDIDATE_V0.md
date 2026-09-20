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
| **STRENGTHEN** | Only the support that matches the Probe weakness under repair. Meal V0 implements catalog-driven **active-recall weakness** for the four current Probe targets (soup, bowl, spoon, fork): lexical form reveal, then a spelling cue, then a frozen typing check. |

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
- Meal STRENGTHEN for active-recall weakness is now generated from the Meal scene catalog and bundled vocabulary profiles. The four current Probe targets reuse one factory. Copy, IPA, and spelling cues come from real vocabulary, not lemma guesses or four copied controllers.
- Reconnect shows the current Meal scene, highlights the current target, and uses that target's real display form, meaning gloss, and IPA when vocabulary has IPA.
- Fade keeps the same highlight, hides the full English form, and derives the cue from the verified display form.
- Verify highlights the current target and hides both the full form and the cue.
- Support exposures are explicit step metadata bound to run, plan, target `lexemeId`/`senseId`, step, kind, and `shownAt`. Helpers must not parse step IDs to infer the target.
- `hintCount` is target-scoped and plan-scoped. Another target's or another plan's exposure does not count. If causality cannot be proven, verification stops instead of defaulting to `1`.
- Multiple eligible STRENGTHEN targets use a server-authoritative queue. The client can start the needed strengthen operation, but cannot name the next target.
- Non-spoon BUILD remains an explicit capability gap: “建立记忆体验尚未实现.” It does not block a legal STRENGTHEN queue.
- Assisted verification is not long-term independent retrieval. Production `/train` is still not connected.
