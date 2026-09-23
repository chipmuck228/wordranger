# Contextual Meal Expansion Batch 03

> Status: **Candidate V0 / CANDIDATE / unpromoted / not RELEASE_ELIGIBLE**
>
> This document inventories bundled vocabulary identities and authors
> reviewable Scene Content only. It is not Standard, not production
> `/train`, and not the current six-word Context Lab runtime.

## 1. Vocabulary identity inventory

All lookups used bundled `words-canonical.json` plus
`bundledSceneLexemeLoader(canonicalKey)`. Lemma is never identity.
`lexemeId` is `lexemeIdFromCanonicalKey(canonicalKey)`.

| Planned lemma | Bundled canonicalKey | Bundled lemma / display | IPA | meaningsZh | Selector | Sense uniqueness | Meal fit | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| knife | `lex-0747-1` | `knife(pl.knives)` | `/naɪf/` | `小刀`, `匕首`, `刀片` | exact `小刀` | one bundled lexeme; three glosses, one selectable meal gloss | eating tool for cutting solid food | **AUTHORED** |
| napkin | — | — | — | — | — | absent from bundled vocabulary | — | **BLOCKED** |
| bread | `lex-0184-1` | `bread` | `/bred/` | `面包`, `食物，粮食`, `生计` | exact `面包` | one bundled lexeme; meal gloss is uniquely selectable | solid food that a knife can cut | **AUTHORED** |
| water | `lex-1517-1` | `water` | `/ˈwɔːtə(r)/` | `水` | exact `水` (only gloss) | one bundled lexeme; one gloss | drinkable liquid at the table | **AUTHORED** |

No provisional identities. No substituted words.

## 2. Exact senses selected

| Target | `lexemeId` | `senseId` | Selected meaning | Why this sense |
| --- | --- | --- | --- | --- |
| knife | from `lex-0747-1` | `knife#eating-tool` | `小刀` | Bundled meal-appropriate gloss. `匕首` and `刀片` are not tableware. |
| bread | from `lex-0184-1` | `bread#solid-food` | `面包` | Bundled food gloss. `生计` is not a Meal object. |
| water | from `lex-1517-1` | `water#drinkable-liquid` | `水` | Sole bundled gloss. |

Fixture `lexemeId` values (`lex-knife` etc.) remain catalog handles only.
Pack targets use bundled UUIDs.

## 3. Why these words join Meal

Knife, bread, and water extend the existing table: tools, food, and a
drinkable liquid. They are not a flat “also Meal” list.

## 4. Relation to the current six words

Inherited, fingerprint-stable:

`soup`, `bowl`, `spoon`, `fork`, `cup`, `plate`

New contrasts:

- knife vs fork / spoon: cutting vs piercing / scooping
- bread vs soup: solid food vs liquid food
- water vs soup: drinkable liquid vs liquid food
- water is not the existing `drink` verb sense and does not replace `cup`

## 5. Semantic roles

| Target | Skeleton role | Supporting non-target |
| --- | --- | --- |
| knife | `EATING_TOOL` (MANY) | — |
| bread | `SOLID_FOOD` (Candidate, OPTIONAL_ONE) | — |
| water | `DRINKABLE_LIQUID` (Candidate, OPTIONAL_ONE) | `WATER_VESSEL` carafe, not a Probe target |

`FOOD` stays soup. `DRINK` stays the existing cup-liquid entity.
Batch-03 does not steal those ONE / OPTIONAL_ONE slots.

## 6. Likely confusion

- knife vs fork: both tools
- bread vs soup: both foods, different state
- water vs soup: both liquids, different consume path
- water vs cup: liquid vs container
- bundled knife display is `knife(pl.knives)`, not a cleaned lemma

## 7. Existing predicates reused

- `suitable_for` (tool → food-like object)
- `contains` (vessel → liquid)

No frozen `CONTEXT_USE` change.

## 8. New Candidate predicates / roles

Isolated batch-03 skeleton only:

- roles: `SOLID_FOOD`, `DRINKABLE_LIQUID`, `WATER_VESSEL`
- relations: `SUITABLE_FOR_CUTTING` (`EATING_TOOL` → `SOLID_FOOD`), `CONTAINS_DRINKABLE` (`WATER_VESSEL` → `DRINKABLE_LIQUID`)

Facts live on isolated frames, not as “always used / always beside” axioms.

## 9. Probe / BUILD / STRENGTHEN summary

Each authored target:

- Probe: independent recall, then meaning recognition; recall success skips recognition
- BUILD: Ground → Connect core relation → Contrast → Fade → frozen recall handoff
- STRENGTHEN: short cue, controlled support, faded recall, frozen verify

Recognition distractors come from other Meal table objects already in the
pack (tool vs tool, food vs food, liquid vs liquid). They are not invented
senses.

## 10. Known capability gaps

- **napkin** is BLOCKED: not in bundled vocabulary
- no bundled audio / pronunciation transport
- knife display form includes the plural note from source data
- bread / water extra glosses exist but are not selected
- no new frozen task types; uncompilable response kinds stay gaps
- pack is CANDIDATE / `releaseEligibility=NONE` / unpromoted
- promotion uses independent `CONTEXTUAL_CONTENT_PROMOTION_*` gates and `CONTEXTUAL_PROMOTION_RUNTIME`; review write does not authorize promotion
- `file` / `memory` runtimes are local only; Vercel production/preview must use `supabase` after the promotion migration is applied
- this document does not apply a remote migration and does not record a live promotion

This remains Candidate V0 / Experimental.
