# Contextual Meal Expansion Batch 01

> Status: **Candidate V0 / human-reviewed / APPROVED_FOR_EXPERIMENT only**
>
> Fingerprint-bound cup is approved for experimental Context Lab use.
> This is not a Standard, not production `/train`, and not 1600-word coverage.

## 1. Batch goal

Prove that a catalog-mapped Meal word can enter Scene Content as authored
data only, without changing the runtime engines, Frozen Core, `/train`,
or the current four-word Context Lab.

The success criterion is an auditable result for every reviewed word,
not a forced count of five new executable lexemes.

## 2. Five-word eligibility matrix

| Word | bundled lexemeId | canonicalKey | exact senseId | catalog role | skeleton role exists | frame binding exists | fact grounding exists | binding kind | Probe eligible | BUILD eligible | STRENGTHEN eligible | result / gap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cup | from `lex-0346-1` | `lex-0346-1` | `cup#drink-container` | `DRINK_CONTAINER` | yes | yes (Home/Restaurant/Picnic cup) | yes `contains(cup, drink)` | `NAMES_ENTITY` | yes | yes | yes | `ELIGIBLE_NOW` |
| drink | from `lex-0413-1` | `lex-0413-1` | `drink#consume-liquid` | `DRINK` | yes | yes (beverage entity) | yes `contains(cup, drink)` | `NAMES_ENTITY` | no | no | no | `SENSE_REVIEW_REQUIRED`: sense is consume-action; catalog/frame/fact treat a beverage; bundled gloss merges 喝 / 饮料 |
| plate | from `lex-1036-1` | `lex-1036-1` | `plate#food-support` | `FOOD_SUPPORT` | no | no | no | none | no | no | no | `REQUIRES_FRAME_CONTENT`: no plate entity/fact; do not edit the REVIEWED skeleton to add `FOOD_SUPPORT` in this batch |
| eat | from `lex-0430-1` | `lex-0430-1` | `eat#consume-food` | `CONSUME_FOOD_ACTION` | no | no | no | none | no | no | no | `REQUIRES_CANDIDATE_SCHEMA`: Scene Content binds `entityId` only; do not disguise the action as an entity |
| choose | from `lex-0264-1` | `lex-0264-1` | `choose#select` | `SELECT_ACTION` | no | no | no | none | no | no | no | `REQUIRES_CANDIDATE_SCHEMA`: `CHOOSE_TOOL` is a skeleton event, not a lexeme binding; do not infer an event from the lemma |

Display form, Chinese meaning, and IPA are never copied into the pack.
They come from the injected `SceneLexemeLoader`.

## 3. Implemented word

Only **cup** is executable Scene Content in this batch.

Authored in `meal-scene-expansion-batch-01`:

- identity `{lexemeId, senseId}` from bundled `lex-0346-1` + `cup#drink-container`
- role `DRINK_CONTAINER`
- Home `home-cup` / Restaurant `rest-cup`
- grounding `contains(cup, drink)` with frame-local fact IDs
- contrast target: bowl, because the existing REVIEWED contrast is cup ↔ bowl and both are containers
- Probe / BUILD / STRENGTHEN enabled

The four already-approved Meal words remain in the Candidate pack so
cup's bowl contrast and scene membership stay complete. That does not
approve those four words again.

## 4. Blocked words

- **drink**: sense review required. The current Candidate sense is a
  consume action. The current frame entity is a beverage. The lemma
  must not stand for both.
- **plate**: needs a real plate entity, a real fact, and a skeleton
  role decision. This batch does not rewrite the REVIEWED skeleton.
- **eat** / **choose**: action-binding capability gap. See below.

## 5. Entity binding vs action binding

`ContextualFrameBinding` is:

```ts
{ frameId, entityId, roleId, sceneOrder }
```

Domain frame bindings may use `NAMES_ENTITY` or `NAMES_ACTION`. There
is no `NAMES_EVENT`. Probe, BUILD contrast, and the generic plan
factory all require an entity ID plus, for BUILD, a contrast entity.

An action lexeme cannot honestly become a Scene Content target by
inventing a fake entity. A later Candidate schema may add event/action
bindings. This batch does not implement that refactor.

## 6. Scene vocabulary vs one Probe budget

The Scene catalog / Scene Content pack is the available vocabulary for
a scene. The Probe planner still selects a limited queue.

The original four-word pack `meal-home-breakfast-v0` remains
identifiable. After fingerprint-bound human review, Meal Context Lab
Probe reads the expansion pack and includes cup as a fifth target.

plate / drink / eat / choose are still not executable.

## 7. Human review / experiment promotion

cup is human-reviewed and fingerprint-bound:

- review decision `APPROVED`
- review revision `1`
- content fingerprint
  `51dc51dc1a321f2af03126d75db1823e59eed61f7e3168c47f4b360611997a40`

Promotion is a committed Candidate V0 attestation with scope
`EXPERIMENT_ONLY`. It is `APPROVED_FOR_EXPERIMENT` only.

- Not Standard
- Not production `/train`
- Saving a review decision still does not change registry
- LLM or page buttons cannot create a promotion
- There is no `STANDARD` or `PRODUCTION_APPROVED` status

## 7a. Internal content review

Internal reviewers can inspect this pack at
`/debug/contextual-content-review/meal-expansion-batch-01/cup`
when Debug Tools and the review gate are enabled.

The review page shows the live registry status. A later content change
must fail closed as `STALE_REVIEW` and break promotion validation.

## 8. This is not 1600-word coverage

The Meal catalog still has nine reviewed members. The original
four-word experiment pack remains. This batch adds one
fingerprint-bound experimental executable word. That is not lexicon
completion.
