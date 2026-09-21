# Contextual Meal Expansion Batch 02

> Status: **Candidate V0 / CANDIDATE / human review PENDING**
>
> plate is authored Scene Content only. It is not approved, not
> `APPROVED_FOR_EXPERIMENT`, and not in Meal Context Lab.
> This is not a Standard, not production `/train`, and not 1600-word coverage.

## 1. Batch goal

Add one catalog-mapped Meal word, `plate`, as a reviewable Candidate pack
on top of the fingerprint-bound five-word experiment pack.

Success is an honest CANDIDATE pack plus a PENDING human review packet.
This batch does not promote.

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

- pack provenance `CANDIDATE`
- registry status `CANDIDATE`
- no promotion attestation
- `getApprovedExperimentSceneContent(batch02)` is unapproved
- Meal Context Lab still reads batch 01: soup / bowl / spoon / fork / cup
