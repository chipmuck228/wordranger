# Contextual Meal Expansion Batch 02

> Status: **Candidate V0 / APPROVED_FOR_EXPERIMENT / human review APPROVED**
>
> plate is fingerprint-bound Scene Content for the six-word experimental
> Meal Context Lab only. It is not Standard and not production `/train`.
> This is not 1600-word coverage.

## 1. Batch goal

Add one catalog-mapped Meal word, `plate`, as a reviewable Candidate pack
on top of the fingerprint-bound five-word experiment pack.

Success is a fingerprint-bound `APPROVED_FOR_EXPERIMENT` pack used only by
`/play/context-lab`. This is not Standard promotion.

## 2. Identity

| Field | Value |
| --- | --- |
| bundled canonicalKey | `lex-1036-1` |
| bundled lexemeId | from `lexemeIdFromCanonicalKey("lex-1036-1")` |
| exact senseId | `plate#food-support` |
| catalog role | `FOOD_SUPPORT` |
| display / lemma | from bundled vocabulary |
| IPA | `/pleɪt/` from bundled vocabulary |
| bundled meaningsZh | `板`, `片`, `牌`, `盘子`, `盆子` |
| meaning selector | exact bundled value `盘子` |

The meal sense is the existing REVIEWED catalog sense `plate#food-support`,
contrasted with `bowl#food-container`. It is not a second bowl identity
and not a guessed lemma.

## 3. Frames

Home Breakfast and Restaurant Meal naturally include a plate beside the
soup bowl. Those plate entities live only on isolated batch 02 frames
and skeleton. Approved `MEAL_FRAMES` / `mealSkeleton` stay five-word.

Picnic has the same Candidate-only domain entity for fixture completeness,
but this pack only authors Home and Restaurant.

Each authored frame defines:

- `home-plate` / `rest-plate` with role `FOOD_SUPPORT`
- frame-only `home-served-food` / `rest-served-food` with role `SUPPORTED_FOOD`
- fact `supports(plate, served-food)`
- contrast: plate vs bowl

`SUPPORTED_FOOD` is not a Probe / BUILD / STRENGTHEN target.

## 4. Isolation

- pack provenance `APPROVED_FOR_EXPERIMENT`
- registry status `APPROVED_FOR_EXPERIMENT`
- approval basis `HUMAN_REVIEW_PROMOTION`
- plate promotion attestation is fingerprint-bound to revision 1
- `getApprovedExperimentSceneContent(batch02)` loads the six-word pack
- Meal Context Lab reads batch 02: soup / bowl / spoon / fork / cup / plate
- batch 02 frames/skeleton stay isolated from approved five-word `MEAL_FRAMES`
