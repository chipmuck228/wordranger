# Contextual Scene Content Contract Candidate V0

> Status: **Candidate / Experimental / Not a Standard**
>
> This contract extracts Meal scene content from runtime engines. It does
> not change frozen WordRanger learning semantics and is not wired into
> `/train`.

## 1. Problem

Meal soup / bowl / spoon / fork content was duplicated across Probe
targets, BUILD profiles, STRENGTHEN profiles, presentation maps, and
plan factories. Adding a word required editing engines. This Candidate
makes scene content a single authored pack.

Passing schema validation means the pack is structurally consistent. It
does **not** mean the teaching is pedagogically correct.

## 2. Authored content vs runtime engine

Scene Content owns:

- scene / frame / lexeme identity
- entity, role, and ordered fact grounding
- Probe / BUILD / STRENGTHEN presentation profiles
- pedagogical contrast
- scene order
- Candidate provenance

Runtime engines own:

- queue mutation
- plan compilation into frozen tasks
- public screen projection
- calling `submitTaskAction`

Runtime engines must not recognize soup / bowl / spoon / fork.

## 3. Identity is always `{ lexemeId, senseId }`

Display labels, lemmas, Chinese glosses, array indexes, step-ID
suffixes, entity-ID fragments, filenames, and word switches are not
identity.

## 4. Bundled vocabulary authority

Bundled vocabulary is the only source of:

- display form
- Chinese meaning
- IPA

IPA may be missing. The resolver must not invent it. The bundled
lexeme ID must match the pack target lexeme ID.

## 5. Skeleton / frame / fact authority

Approved frames own entities, roles, and world facts. A pack may only
cite facts that already exist on the frame, with the same predicate and
the same ordered arguments.

## 6. Pedagogical wording authority

Teaching copy, contrast copy, fade copy, and recall prompts are authored
in the pack. They are not inferred from labels.

## 7. Frame facts vs pedagogical contrast

`contains(bowl, soup)` is a frame fact.

“Soup is food, bowl is a container” may be a role contrast.

“Spoon and fork are used differently” may be a pedagogical contrast.

A contrast must never be upgraded into a skeleton/frame axiom just
because copy mentions two entities.

## 8. Ordered fact arguments

`contains(bowl, soup)` is not `contains(soup, bowl)`. Validators must
compare predicate **and** ordered arguments. Reversed arguments fail
with `CONTENT_FACT_DIRECTION_MISMATCH`.

## 9. Validator vs resolver

The validator checks authored data. It does not touch UI, learner
state, or Evidence. It recursively rejects Evidence/mastery fields
anywhere in the pack, not only on the top-level object.

It validates **every** pack frame. A second frame with a bad entity or
fact fails even when the current runtime frame is valid. Frame IDs must
be unique. Lexeme membership uses per-frame bindings:

```ts
membership.frameBindings: { frameId, entityId, roleId, sceneOrder }[]
```

The resolver binds one runtime frame at a time. It returns only lexemes
that have a binding for that frame. `frameId` is the frame being
resolved, never `frameBindings[0]`.

The validator also requires that the bound runtime entity's
`lexemeSenseBindings` contain `fixtureSense`. A matching entity ID
without that sense is `CONTENT_ENTITY_SENSE_BINDING_MISMATCH`.

TypeScript types are not enough. Authored JSON must pass the runtime
validator.

## 9a. Generic plan factory

`createContextualLexicalBuildPlan` / `createContextualLexicalStrengthenPlan`
read `skeletonId`, `activeGoalId`, plan ID namespace, and guided
rationales from resolved content and the current frame. They do not
import Meal fixtures. They use the already-resolved `lexeme.entityId`
and contrast / fact entity IDs. They do not look entities up again by
`fixtureSense`. If a resolved ID is not on the current frame, the
factory returns an empty plan.

Same-skeleton remapping (home-breakfast snapshot → restaurant / picnic)
belongs in the Meal wrapper, not the generic factory.

Meal-specific values such as `EATER_CAN_EAT_FOOD` and `planIdNamespace:
"meal"` live in the Meal pack or Meal wrappers. Presentation roles are
plain strings. Meal UI maps `"FOOD" | "CONTAINER" | "TOOL"` in the Meal
renderer adapter.

## 9b. Registry immutability

Registry entries are deep-frozen at load. `packId` must equal `pack.id`.
Duplicate IDs fail closed. Getters return structured clones, so callers
cannot mutate approval state or authored wording for later requests.

## 10. Registry approval

Registry statuses are only:

- `DRAFT`
- `CANDIDATE`
- `APPROVED_FOR_EXPERIMENT`

`/play/context-lab` loads `APPROVED_FOR_EXPERIMENT` only. There is no
`STANDARD` or `PRODUCTION_APPROVED` status.

## 11. Future authoring workflow

```text
选择 bundled lexeme
→ 选择 exact sense
→ 绑定 scene/frame/entity/role
→ 引用 ordered facts
→ authored contrast
→ authored BUILD/STRENGTHEN presentation
→ validator
→ human review
→ APPROVED_FOR_EXPERIMENT
→ runtime projection
```

LLM output may only create a Candidate pack. It must not auto-approve.

## 12. Current four words are a migration fixture

soup / bowl / spoon / fork are the migrated Meal fixture. This is not
1600-word coverage. There is no authoring tool yet.

## 13. Synthetic fifth target

`synthetic-meal-extension` is a data-only extensibility test. It is not
a production Meal word, is not in the runtime registry, and must not
appear in `/play/context-lab`.

## 14. Frozen boundary

Scene Content does not grade, create Evidence, write learner state,
choose the production Scheduler, or define a new frozen skill.

Final scored work still follows:

```text
PublicLearningTask
→ StudentAction
→ submitTaskAction
→ frozen evaluator
→ LearningEvidence
→ frozen learner update
```
