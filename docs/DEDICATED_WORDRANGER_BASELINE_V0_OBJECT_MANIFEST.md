# Dedicated WordRanger Baseline V0 Object Manifest

Candidate / Not a Standard. Companion to
`docs/DEDICATED_WORDRANGER_CONSOLIDATED_BASELINE_CANDIDATE_V0.md`.

No secrets. No URL. No project ref. No learner identifiers.

## Active file

`supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`

Archive (not active):

`supabase/migrations_archive/pre_dedicated_baseline/`

## Required tables

| Table | Notes |
| --- | --- |
| `public.vocabulary_source_entries` | Rebuild from bundled source |
| `public.lexemes` | Unique `canonical_key`; FK to source entries |
| `public.lexeme_relations` | Unique `(type, from, to, provenance)` |
| `public.lexeme_tags` | Confidence 0..1 when present |
| `public.learning_tasks` | Server-only `answer_key` |
| `public.game_sessions` | `revision` CAS token |
| `public.learning_evidence` | Append-only; `session_id` correlation; unique `task_id` when set |
| `public.student_lexeme_models` | Unique `(user_id, lexeme_id)` |
| `public.student_lexeme_skill_states` | Unique `(model_id, skill)` |
| `public.student_lexeme_weaknesses` | Optional related lexeme |

## Required non-table objects

| Object | Kind |
| --- | --- |
| `pgcrypto` | extension on real Postgres |
| `public.prevent_learning_evidence_mutation` | function |
| `learning_evidence_no_update` | BEFORE UPDATE OR DELETE trigger |
| Learner RLS ENABLE | six learner tables, FORCE off |
| Client revoke | PUBLIC / anon / authenticated |
| `service_role` DML | SELECT / INSERT / UPDATE / DELETE on the six learner tables |

## Vocabulary fingerprint

Algorithm, not a frozen published hash:

1. Load bundled vocabulary only.
2. Sort `canonical_key` for source entries, lexemes, and relations.
3. Sort tag `lexeme_id`.
4. SHA-256 the four labeled blocks.

Produce locally:

`npm run import:vocabulary -- --fingerprint`

Rebuild must match those counts and that fingerprint. It must leave
learner tables empty.

## Excluded from V0

`cleanup_progress_test_user`, `learning_sessions`,
`vocabulary_placement_reviews`, Context Lab / content-release
objects, campus / enrollment / newsletter / traffic,
`public.users`, Blaze-named functions, Auth users, Storage,
Realtime, learner rows, test data.
