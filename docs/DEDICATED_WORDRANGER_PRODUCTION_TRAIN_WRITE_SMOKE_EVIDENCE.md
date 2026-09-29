# Dedicated WordRanger Production `/train` Write Smoke Evidence

Candidate / Not a Standard. **Local evidence record of one authorized
Production `/train` write smoke.**

This later evidence record does not rerun that smoke. It does not
authorize a second start, a continue, an eight-question finish, a
table clear, Evidence deletion, a Vercel env change, Auth /
Homepage / `/practice` enablement, or a remote TypeScript
fingerprint claim. Deploy rollback is not a database rollback.

- Date: **2026-09-29**
- `origin/main` / inspected Production head:
  `464343095d92805e58d57a7dba9831cb1e7e6899`
- Public aliases were already promoted to that head before the
  smoke. This record does not promote or rebuild.

Do not store a later evidence-commit SHA here. That is an
impossible self-reference. The inspected head above is the
runtime identity that served the smoke.

Status:

`PRODUCTION_TRAIN_WRITE_SMOKE_COMPLETED`;
`ONE_START_ONE_FIRST_PLAYABLE_SUBMIT`;
`CANARY_SESSION_TASK_EVIDENCE_DELTA_PLUS_ONE`;
`REFRESH_RESTORED_AWAITING_CONTINUE`;
`DUPLICATE_SUBMIT_DID_NOT_ADD_EVIDENCE`;
`OWNERSHIP_AND_NO_ANSWER_KEY_LEAK_VERIFIED`;
`APPEND_ONLY_CANARY_RETAINED`;
`FIRST_PLANNED_NEED_SKIPPED_THEN_RECOVERED`;
`SKIP_CLASS_GENERATION_CONSTRAINT`;
`SKIP_CODE_CONTENT_POLICY_BLOCKED`;
`NOT_DATA_GAP`;
`NOT_TRANSIENT_RUNTIME_ERROR`;
`VERCEL_FUNCTION_LOGS_NO_ERROR`;
`GENERATION_FAILURE_NOT_LOGGED_AS_RUNTIME_ERROR`;
`REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED`;
`NO_SECOND_SMOKE`;
`NO_CONTINUE`;
`NO_TABLE_CLEAR`

The skipped first planned need is a recorded generation-constraint
event. Session start recovered on the next planned need. A
deterministic archetype-selection follow-up is not this PR.

## 1. Target and credentials

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git for SELECT-only pre-counts and
post-checks. Did not read a local dotenv file. Did not use
ambient Supabase or Postgres variables. Did not use `--linked` or
the legacy CLI link. Did not print URL, host, project ref, user,
password, key, JWT, session id, task id, Evidence id, or user id.

Classifications:

- `DEDICATED_SNAPSHOT_ELIGIBLE`
- `LEGACY_SOURCE_EXCLUDED`
- `SELECT_ONLY_POSTCHECK`

Temporary snapshot deleted: **`TEMP_DELETED`**.

## 2. Authorized smoke shape

Executed exactly once on public `/train`. No second start. The
on-page start control is the existing Daily Training CTA.

Observed student path, in order:

1. Record six learner-table counts.
2. Open public `/train`.
3. Click start once.
4. Submit the first playable question once.
5. Do not click continue. Do not finish eight questions.
6. Refresh and confirm restored feedback.
7. Repeat the same task submit once.
8. Read-only ownership, counts-delta, and no `answer_key` leak
   check.

Not used:

- continue / next-item
- play-again
- Auth
- `/practice`
- Evidence `DELETE` / `TRUNCATE` / `UPDATE`
- deploy rollback as database rollback
- a second Production smoke after failure

## 3. Pre-smoke and post-smoke counts

Learner tables were already non-zero before this smoke. This
record is an incremental canary, not a claim that Dedicated
learner tables were still zero after seed apply.

| Table | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `game_sessions` | `6` | `7` | `+1` |
| `learning_tasks` | `38` | `39` | `+1` |
| `learning_evidence` | `37` | `38` | `+1` |
| `student_lexeme_models` | `34` | `35` | `+1` |
| `student_lexeme_skill_states` | `204` | `210` | `+6` |
| `student_lexeme_weaknesses` | `1` | `2` | `+1` |

The first three deltas are the authorized canary writes: one
session, one task, one Evidence. The snapshot-table deltas are
`processEvidence` projections from that one Evidence row. They
are not a second session.

Newest Daily Training session after the smoke:

- `game_type` is Daily Training
- `status` is `active`
- `phase` is `awaiting_continue`
- `completed` is `1`
- `currentNeedIndex` is `1`
- user is the V1 placeholder
- task count for that session is `1`
- Evidence count for that session is `1`
- every task and Evidence row matches that session owner
- `public_payload`, session `state`, and Evidence `metadata` have
  no `answer_key`
- page HTML and the duplicate-submit response have no `answer_key`

## 4. Refresh and duplicate submit

Refresh restored the same playable item, the same correct
feedback, and the continue control. Evidence count did not
increase.

A second submit of the same task returned
`TASK_ALREADY_COMPLETED` and did not insert a second Evidence
row. Post-retry counts matched the post-submit counts above.

## 5. First planned-need skip

Start presented progress `2 / 8` because the first planned item
was skipped and the first playable item is index `1`.

Item statuses after the one submit:

`SKIPPED`, `COMPLETED`, then six `PLANNED`.

Need classes, index order, skill and reason only:

| Index | Reason | Skill | Weakness type | Avoid recent types |
| --- | --- | --- | --- | --- |
| `0` | `WEAKNESS` | `MEANING_RECOGNITION` | `SLOW_RESPONSE` | `MEANING_CHOICE` |
| `1` | `NEW_WORD` | `MEANING_RECOGNITION` | none | none |
| `2`–`7` | `NEW_WORD` | `MEANING_RECOGNITION` | none | none |

Need `0` had one preferred prompt mode and no related-lexeme
focus. Exactly one `generationFailures` row:

- code: `CONTENT_POLICY_BLOCKED`
- skill: `MEANING_RECOGNITION`
- class: `GENERATION_CONSTRAINT`
- reason class: production-approved confusable-relation policy
- not `LEXEME_NOT_FOUND`
- not `MISSING_REQUIRED_CONTENT`
- not `INSUFFICIENT_DISTRACTORS`
- not a renderer miss
- reason contained no UUID

Classification:

- not a Dedicated vocabulary-row gap
- not a temporary network or runtime crash
- a deterministic Task Generator constraint after archetype
  selection preferred `CONFUSABLE_CHOICE` because
  `MEANING_CHOICE` was in `avoidRecentTaskTypes` and
  `SLOW_RESPONSE` is not a focused `MEANING_CHOICE` weakness
- Daily Training recovered by skipping that planned need and
  generating the next `NEW_WORD` meaning task

This skip is allowed session recovery. The archetype-selection
hole is a later isolated fix, not a second smoke and not a
database rewrite.

## 6. Server logs

Read recent Production function request logs for `/train` only.
Did not print request ids, hosts, user agents, or message
bodies.

Observed: request rows at `info`, no `error` / `fatal` level, no
`daily-training` error token, no generation-failure token, and
no `answer_key`. The skipped need is stored on session state. It
was not emitted as a runtime error.

## 7. Canary retention

The smoke session, task, and Evidence row remain as an explicit
Production canary. Append-only Evidence was not deleted. Learner
tables were not cleared. A later deploy rollback must not be
treated as a database rollback.

## 8. Non-claims

- Remote TypeScript fingerprint is still
  `REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED`.
  That status is not a remote TypeScript fingerprint
  verification.
- This record does not close Dedicated migration by itself.
- This record does not enable Free Practice identity work.
- This record does not authorize another `/train` write smoke.
- No complete vocabulary readback was downloaded.
