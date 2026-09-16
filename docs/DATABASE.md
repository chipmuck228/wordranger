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

- `public_payload` — student-safe `PublicLearningTask`
- `answer_key` — **server-only**. Never `select("*")` this table from a browser client. Evaluation must run on the server (or in Debug Lab in-process).
- `generation_trace` — why this task was built (candidates, blocked relations, policy version)

`learning_evidence.task_id` references `learning_tasks(id)` and is unique when not null (one task → one terminal evidence). Legacy Debug Lab evidence may still have `task_id` null.

## Learning tables

`learning_evidence` is the source of truth: an append-only event log of learning facts keyed by `lexeme_id` → `lexemes.id`.

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

## RLS TODO

There is no student auth context yet. Do not add `using (true)` write policies. When Supabase Auth lands:

- students insert their own evidence and read their own snapshots
- no one updates evidence
- service role is server-only
