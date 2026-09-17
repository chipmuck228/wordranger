# Database

WordRanger stores five different kinds of data. They must not be collapsed into one table.

| Responsibility | Tables / files | Mutability |
| --- | --- | --- |
| Source facts | `vocabulary_source_entries`, `data/vocabulary/source/` | Immutable-ish PDF facts. Canonical corrections must not rewrite them. |
| Canonical facts | `lexemes`, `data/vocabulary/canonical/` | Trainable vocabulary units. Identified by UUID + `canonical_key`. |
| Enrichment | `lexeme_relations`, `lexeme_tags`, `data/vocabulary/enrichment/` | Relations and tags with `confidence` / `provenance`. |
| Learning event log | `learning_evidence` | Append-only source of truth. Optional `task_id`. |
| Generated tasks | `learning_tasks` | Public payload + server-only answer key + generation trace. |
| Learning snapshot | `student_lexeme_models` + skill states + weaknesses | Derived projection. Rebuildable from evidence. |
| Game orchestration | `game_sessions` | Resume/navigation only. Not learning truth. |

## Vocabulary tables

### `vocabulary_source_entries`

PDF numbered entries. Unique `source_index` and `canonical_key` (`src-0019`). No student state.

### `lexemes`

Canonical trainable units. `id` is UUID. `canonical_key` (`lex-0019-1`) is the stable import key. `lemma` is indexed but **not** unique. FK `source_entry_id` → `vocabulary_source_entries.id`.

### `lexeme_relations`

Word-graph edges. Constraints: `from_lexeme_id <> to_lexeme_id`, `confidence` in `0..1`, unique `(type, from_lexeme_id, to_lexeme_id, provenance)`. Import keeps `confidence` and `provenance`. Production queries apply `VocabularyContentPolicy`; they do not drop those columns.

### `lexeme_tags`

One row per lexeme. `game_tags` describe present data capabilities, not which game to play. Confidence columns are nullable with a `0..1` check.

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

## Indexes

- `lexemes`: `lemma`, `source_entry_id`, `source_index`, unique `canonical_key`
- `student_lexeme_models`: `user_id`, `lexeme_id`, `next_review_at`, `mastery_stage`, unique `(user_id, lexeme_id)`
- `learning_evidence`: `(user_id, lexeme_id, occurred_at)`, `session_id`, `skill`, `outcome`

## Consistency strategy

`LearningRepository.commitEvidenceAndSnapshot` is the transactional boundary.

- **In-memory**: append + snapshot in one try/catch; rollback both on failure.
- **Supabase JS**: write evidence first, then snapshot. The JS client does not give a multi-table transaction without an RPC. If the snapshot write fails, evidence remains. That is recoverable because evidence is the source of truth.

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

Cleanup/TTL is future work. A failed session save after `learning_tasks` insert can leave an orphan assigned task; do not delete it.

## Phase 04 persistence

Phase 04 adds **no required persistence tables**. The scheduler still generates `LearningSessionPlan` on demand. Phase 05.1+ persist a copy of that plan's playable needs inside `game_sessions.state` so refresh does not re-run the Scheduler. Phase 06–09 add no new tables. Word Bubble, Matching, Snake, and Daily Training reuse `game_sessions` with their `game_type`. Daily Training needs a product-session id, revision CAS, and `session_id` correlation on assigned tasks; `game_sessions` already provides those without copying learning truth. A separate `training_sessions` table is not required. Renderer layout, Matching partial selection, and Snake body/ticks are not stored.

The scheduler reads:

- vocabulary (`lexemes`)
- student snapshots (`student_lexeme_models`)
- skill states (`student_lexeme_skill_states`)
- weaknesses (`student_lexeme_weaknesses`)
- recent evidence (`learning_evidence` → `RecentLearningActivity`)

`LearningStateQueryRepository` is the read port. It is not the Learning Core mutation port.

## RLS TODO

There is no student auth context yet. Current V1 uses trusted server actions and `V1_PLACEHOLDER_USER_ID`. Do not add `using (true)` write policies. When Supabase Auth lands:

- students insert their own evidence and read their own snapshots
- no one updates evidence
- service role is server-only
