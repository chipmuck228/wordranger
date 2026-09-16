# Database

## Event log vs snapshot

`learning_evidence` is the source of truth: an append-only event log of learning facts.

`student_word_models` (+ skill states + weaknesses) is a derived snapshot used for querying, review queues, and the Debug Lab. If the v1 policy is replaced, snapshots can be rebuilt by replaying evidence through `processEvidence`.

## Why evidence is append-only

Changing an outcome after the fact would destroy rebuildability. Application repositories do not implement `updateEvidence`. Postgres also rejects `UPDATE`/`DELETE` on `learning_evidence` via trigger.

## Tables

| Table | Role |
| --- | --- |
| `words` | Minimal lemma catalog. Word graph comes later. |
| `learning_sessions` | Practice session envelope |
| `learning_evidence` | Immutable event log |
| `student_word_models` | Current mastery/retention/review snapshot |
| `student_word_skill_states` | Per-skill scores inside a snapshot |
| `student_word_weaknesses` | Weakness rows; resolved rows are kept |

## Indexes

- `student_word_models`: `user_id`, `word_id`, `next_review_at`, `mastery_stage`, unique `(user_id, word_id)`
- `learning_evidence`: `(user_id, word_id, occurred_at)`, `session_id`, `skill`, `outcome`

## Consistency strategy

`LearningRepository.commitEvidenceAndSnapshot` is the transactional boundary.

- **In-memory**: append + snapshot in one try/catch; rollback both on failure.
- **Supabase JS**: write evidence first, then snapshot. The JS client does not give a multi-table transaction without an RPC. If the snapshot write fails, evidence remains. That is recoverable because evidence is the source of truth.

Honest limitation: V1 does **not** fake atomicity. A later `process_evidence` Postgres function should insert evidence and upsert snapshot rows in one transaction.

## Rebuild recipe

1. Load all `learning_evidence` for `(user_id, word_id)` ordered by `occurred_at`, `id`
2. Start from `createInitialStudentWordModel`
3. Replay each event through `processEvidence` against an in-memory store
4. Replace the snapshot tables with the rebuilt model

## RLS TODO

There is no student auth context yet. Do not add `using (true)` write policies. When Supabase Auth lands:

- students insert their own evidence and read their own snapshots
- no one updates evidence
- service role is server-only
