# Database

WordRanger stores five different kinds of data. They must not be collapsed into one table.

| Responsibility | Tables / files | Mutability |
| --- | --- | --- |
| Source facts | `vocabulary_source_entries`, `data/vocabulary/source/` | Immutable-ish PDF facts. Canonical corrections must not rewrite them. |
| Canonical facts | `lexemes`, `data/vocabulary/canonical/` | Trainable vocabulary units. Identified by UUID + `canonical_key`. |
| Enrichment | `lexeme_relations`, `lexeme_tags`, `data/vocabulary/enrichment/` | Relations and tags with `confidence` / `provenance`. Placement metadata is derived reference data plus optional overlay `word-placement.json`; it is not stored on learner tables. |
| Learning event log | `learning_evidence` | Append-only source of truth. Optional `task_id`. |
| Generated tasks | `learning_tasks` | Public payload + server-only answer key + generation trace. |
| Learning snapshot | `student_lexeme_models` + skill states + weaknesses | Derived projection. Rebuildable from evidence. |
| Game orchestration | `game_sessions` | Resume/navigation only. Not learning truth. |
| Experimental Context Lab orchestration | `context_lab_runs` | Candidate V0 run JSON only. Not learning truth and not a Standard. |

## Vocabulary tables

### `vocabulary_source_entries`

PDF numbered entries. Unique `source_index` and `canonical_key` (`src-0019`). No student state.

### `lexemes`

Canonical trainable units. `id` is UUID. `canonical_key` (`lex-0019-1`) is the stable import key. `lemma` is indexed but **not** unique. FK `source_entry_id` → `vocabulary_source_entries.id`.

### `lexeme_relations`

Word-graph edges. Constraints: `from_lexeme_id <> to_lexeme_id`, `confidence` in `0..1`, unique `(type, from_lexeme_id, to_lexeme_id, provenance)`. Import keeps `confidence` and `provenance`. Production queries apply `VocabularyContentPolicy`; they do not drop those columns.

### `lexeme_tags`

One row per lexeme. `game_tags` describe present data capabilities, not which game to play. Confidence columns are nullable with a `0..1` check.

Placement metadata is **not** a learner table. It is derived from source/canonical facts (PDF section, starred marker, normalized POS) with optional overlay JSON. Human-reviewed `BAND_*` overrides persist in `vocabulary_placement_reviews`. Do not add `functionWord`, CEFR, or difficulty onto `student_lexeme_models`, `learning_evidence`, `learning_tasks`, or `game_sessions`.

### `vocabulary_placement_reviews`

Sparse CURATED placement overrides for internal review. Not learner progress.

| Column | Role |
| --- | --- |
| `lexeme_id` | PK and FK → `lexemes(id)` |
| `band_id` | Reviewed band. Domain/server validates against `PlacementBandDefinition`; the table does not freeze `BAND_1`…`BAND_6` in a CHECK |
| `status` | CHECK `REVIEWED` |
| `source` | CHECK `CURATED` |
| `provenance` | JSON array, must be non-empty |
| `review_note` | Optional |
| `reviewed_at` | Server time |
| `updated_at` | Row update time |

Writes go Browser → server action → `CuratedPlacementStore` → service-role Supabase. RLS is enabled with **no** anon/authenticated policies. `anon` and `authenticated` are revoked. Service role only.

`data/vocabulary/placement/curated-word-placement.json` remains a bootstrap/export artifact. It is not the deployed write target. Import: `npm run import:curated-placement -- --dry-run` (default) and `--apply` (opt-in, service role required). Export: `npm run export:curated-placement`.

## Learning tasks

`learning_tasks` stores one generated task:

- `user_id` / `session_id` — **task assignment identity**. They bind the generated task to a student session. They are not part of `PublicLearningTask`. Application `saveGeneratedTask` requires both. Columns remain nullable in SQL because this phase has no auth and Debug/tests use string ids, not UUIDs.
- `public_payload` — student-safe `PublicLearningTask`
- `answer_key` — **server-only**. Never `select("*")` this table from a browser client. Evaluation must run on the server via `submitTaskAction` (Debug Lab may display the key).
- `generation_trace` — why this task was built (candidates, blocked relations, policy version)

`learning_evidence.task_id` references `learning_tasks(id)` and is unique when not null (one task → one terminal evidence). Legacy Debug Lab evidence may still have `task_id` null.

## Learning tables

`learning_evidence` is the source of truth: an append-only event log of learning facts keyed by `lexeme_id` → `lexemes.id`.

`session_id` on evidence is a **correlation token**. Student games write `game_sessions.id` here. It does not require a row in `learning_sessions` (that table is a leftover Core stub; game orchestration is `game_sessions`).

`student_lexeme_models` (+ `student_lexeme_skill_states` + `student_lexeme_weaknesses`) is a derived snapshot used for querying, review queues, and the Debug Lab. It stores `policy_version`. If the v1 policy is replaced, snapshots can be rebuilt by replaying evidence through `processEvidence`.

## Why evidence is append-only

Changing an outcome after the fact would destroy rebuildability. Application repositories do not implement `updateEvidence`. Postgres also rejects `UPDATE`/`DELETE` on `learning_evidence` via `prevent_learning_evidence_mutation`.

Live progress tests may call `cleanup_progress_test_user(target_user uuid)` to delete rows for **one randomized test user**. That RPC refuses `V1_PLACEHOLDER_USER_ID`, is granted only to `service_role`, and does not change application append-only APIs. `npm run test:progress` still requires `ALLOW_SUPABASE_PROGRESS_WRITES=1` before any mutation.

## Indexes

- `lexemes`: `lemma`, `source_entry_id`, `source_index`, unique `canonical_key`
- `student_lexeme_models`: `user_id`, `lexeme_id`, `next_review_at`, `mastery_stage`, unique `(user_id, lexeme_id)`
- `learning_evidence`: `(user_id, lexeme_id, occurred_at)`, `session_id`, `skill`, `outcome`
- `vocabulary_placement_reviews`: PK `lexeme_id`, `band_id`, `reviewed_at`

## Consistency strategy

`LearningRepository.commitEvidenceAndSnapshot` is the transactional boundary.

- **In-memory**: append + snapshot in one try/catch; rollback both on failure.
- **Supabase JS**: write evidence first, then snapshot. The JS client does not give a multi-table transaction without an RPC. If the snapshot write fails, evidence remains. That is recoverable because evidence is the source of truth.
- **Planning does not auto-rebuild.** `planLearningSession` reads `student_lexeme_models` (and recent evidence for recency only). A snapshot-miss after a successful evidence insert would look like UNSEEN to NEW_WORD until a manual replay. Daily Training submit surfaces `SNAPSHOT_WRITE_FAILED` rather than silently continuing. This is residual risk, not a redesigned Core transaction.

Honest limitation: V1 does **not** fake atomicity. A later `process_evidence` Postgres function should insert evidence and upsert snapshot rows in one transaction.

## Rebuild recipe

1. Load all `learning_evidence` for `(user_id, lexeme_id)` ordered by `occurred_at`, `id`
2. Start from `createInitialStudentLexemeModel`
3. Replay each event through `processEvidence` against an in-memory store
4. Replace the snapshot tables with the rebuilt model

## Import

`npm run import:vocabulary -- --validate` and `--dry-run` never write. `--apply` upserts by `canonical_key` / deterministic UUID and requires Supabase env vars. Tests use `InMemoryVocabularyRepository` and local JSON only.

## Game sessions

`game_sessions` stores **orchestration state only** so student games can survive serverless cold starts. It does **not** replace `learning_tasks`, `learning_evidence`, or `student_lexeme_models`.

| Column | Role |
| --- | --- |
| `id` | Session id (uuid) |
| `user_id` | Owner (uuid). V1 is the placeholder user, not real auth. |
| `game_type` | Free play: `RANGER_TRIAL`, `WORD_BUBBLE`, `MATCHING`, or `SNAKE`. Daily Training: `DAILY_TRAINING` as orchestration identity only (not `Evidence.gameId`). A store must not resume another type's session |
| `plan_id` | Scheduler plan id |
| `status` | `active` / `completed` / `failed` |
| `state` | JSON orchestration (`stateVersion: "v1"`, planned needs, `currentNeedIndex`, `currentTaskId`, phase, presentation stats, last safe feedback, `lastCompletedTaskId`) |
| `created_at` / `updated_at` | `updated_at` is written only on a successful create/CAS write |
| `revision` | Optimistic concurrency token. New rows start at `0`. Each successful update is `WHERE revision = N` then writes `N+1`. Failed CAS does not change `updated_at`. |

`revision` is **not** `stateVersion` (JSON schema), **not** scheduler `policyVersion`, and **not** learning-domain versioning. The CAS column is the source of truth; it is not stored inside `state` JSON and is not sent to the browser.

`state` must not contain AnswerKey, Evidence copies, or `StudentLexemeModel`. `currentTaskId` points at `learning_tasks`. Session stats are UI counters.

V1 uses trusted server actions + the placeholder user. Do not treat RLS as solved.

`vocabulary_placement_reviews` enables RLS immediately and grants only `service_role`. That is an admin/reference lock, not student auth. Hiding `/debug/vocabulary-placement` is not authorization; review writes also require `PLACEMENT_REVIEW_WRITE_ENABLED=1`.

Cleanup/TTL is future work. A failed session save after `learning_tasks` insert can leave an orphan assigned task; do not delete it.

## Experimental Context Lab runs

`context_lab_runs` is **Candidate V0 / Experimental / Not a Standard**. It is not a learning table and not a product game session.

Why a separate table: `game_sessions` is the product orchestration store for LearningNeed plans, `currentTaskId`, and renderer stats. Context Lab stores a Candidate `ExperienceRun` and must not reuse another game’s repository instance or `GAME_RUNTIME`. Mixing that JSON into `game_sessions.state` would collapse experimental Candidate orchestration into the product session contract.

| Column | Role |
| --- | --- |
| `id` | Run id (uuid, server-generated) |
| `user_id` | Owner. V1 is `V1_PLACEHOLDER_USER_ID` |
| `schema_version` | Candidate envelope (`candidate-v0`). Unknown versions are rejected |
| `experience_id` | Plan/experience identity from the stored run |
| `run_state` | Candidate `ExperienceRun` JSON. Orchestration only |
| `revision` | CAS token. Insert at `0`; update `WHERE revision = N` writes `N+1` |
| `created_at` / `updated_at` | `updated_at` changes only on successful create/CAS |

`run_state` must not contain AnswerKey, Evidence, mastery, or submitted typed text. There is no Evidence foreign key and no client-writable path. RLS is enabled with no anon/authenticated policies; `service_role` only. Abandoned experimental runs have no expiry job yet.

Context Lab frozen-task assignment writes the existing `learning_tasks` row (`user_id` = server `V1_PLACEHOLDER_USER_ID`, `session_id` = Context Lab run id). Submission goes through `submitTaskAction` into existing `learning_evidence` / learner snapshots. Do not add a Context Lab Evidence table.

Live Supabase writes also require the existing `learning_tasks` / `learning_evidence` migrations. Context Lab binds the Meal BUILD typing fixture `lex-spoon` onto bundled canonical `lex-1311-1` before `saveGeneratedTask`. Candidate plan JSON may still contain fixture IDs; Evidence uses the vocabulary UUID.

Rollback implication: dropping `context_lab_runs` discards experimental Context Lab orchestration only. It does not affect `learning_tasks`, `learning_evidence`, `student_lexeme_models`, or `game_sessions`.

## Phase 04 persistence

Phase 04 adds **no required persistence tables**. The scheduler still generates `LearningSessionPlan` on demand. Phase 05.1+ persist a copy of that plan's playable needs inside `game_sessions.state` so refresh does not re-run the Scheduler. Phase 06–09 add no new tables. Word Bubble, Matching, Snake, and Daily Training reuse `game_sessions` with their `game_type`. Daily Training needs a product-session id, revision CAS, and `session_id` correlation on assigned tasks; `game_sessions` already provides those without copying learning truth. A separate `training_sessions` table is not required. Renderer layout, Matching partial selection, and Snake body/ticks are not stored.

The scheduler reads:

- vocabulary (`lexemes`)
- student snapshots (`student_lexeme_models`)
- skill states (`student_lexeme_skill_states`)
- weaknesses (`student_lexeme_weaknesses`)
- recent evidence (`learning_evidence` → `RecentLearningActivity`)

`LearningStateQueryRepository` is the read port. It is not the Learning Core mutation port.

## Free Practice identity prerequisite (Candidate Slice 1)

Public Free Practice must not use `V1_PLACEHOLDER_USER_ID`. A server-only port (`src/server/free-practice/identity`) resolves identity from a Supabase Auth cookie session via `auth.getUser()` and the **anon** key. The service-role key is never used for this lookup and must never be sent to the browser.

- Browser `userId` fields, `localStorage`, and `sessionStorage` UUIDs are not trusted.
- Missing, expired, or corrupt sessions fail closed (`NO_SERVER_SESSION`).
- Missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` fails closed (`AUTH_NOT_CONFIGURED`). There is no placeholder, random UUID, or memory fallback.
- The shared placeholder id is rejected (`PLACEHOLDER_FORBIDDEN`).
- Daily Training (`/train`) and Context Lab still use the placeholder. This section does not migrate them and does not change RLS yet.
- Anonymous Auth is single-browser: clearing cookies loses continuity. Cross-device recovery is not supported. Email/magic-link is a later identity option.
- `WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY=1` enables a test-only reader factory. It is ignored on Vercel / `NODE_ENV=production`.
- This is not a Standard and does not authorize a `/practice` route.
- Cookie refresh middleware is **not** added in Slice 1, so `/train` is
  unchanged. A later public `/practice` slice must add `@supabase/ssr`
  middleware before relying on long-lived anonymous sessions. Expired
  access tokens currently fail closed.

## Free Practice plan read queries (Candidate Slice 2)

This is a Candidate read-model note, not a schema change and not a
Standard. No migration is required: existing `learning_evidence` and
`student_lexeme_models` columns already support the queries.

`src/server/free-practice/planning` owns a dedicated read port. It does
**not** extend frozen `LearningRepository`. Every query is bound to a
trusted server `userId`. Service-role clients are not a license to omit
the `user_id` filter or to read another user's rows.

**UNSEEN**

```
student_lexeme_models
  select lexeme_id, mastery_stage
  eq user_id
```

Skill-state and weakness rows are not loaded. Eligibility is “no
snapshot or `mastery_stage = UNSEEN`” plus usable `meaningsZh` from
bundled vocabulary.

**RECENTLY_INCORRECT**

```
learning_evidence
  select id, lexeme_id, skill, outcome, occurred_at
  eq user_id
  order occurred_at descending
  order id descending
  limit 40
```

All outcomes. This is not “last 40 `INCORRECT` rows”. The planner then
keeps the latest terminal row per `lexeme_id + skill`. The planner is
read-only: it does not insert Evidence, snapshots, tasks, or
`game_sessions`.

## RLS TODO

There is no student auth context yet. Current V1 uses trusted server actions and `V1_PLACEHOLDER_USER_ID`. Do not add `using (true)` write policies. When Supabase Auth lands:

- students insert their own evidence and read their own snapshots
- no one updates evidence
- service role is server-only
- `vocabulary_placement_reviews` stays service-role-only; do not add `using (true)` policies
