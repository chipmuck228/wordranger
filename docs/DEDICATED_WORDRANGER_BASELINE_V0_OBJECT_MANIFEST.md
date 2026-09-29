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
| `public.vocabulary_source_entries` | Empty-target seed from bundled source |
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
| Client revoke | PUBLIC / anon / authenticated on learner and vocabulary tables |
| Schema USAGE | explicit `GRANT USAGE ON SCHEMA public` to `service_role`, `anon`, and `authenticated` so table probes are not hidden by missing schema access |
| `service_role` learner DML | SELECT / INSERT / UPDATE / DELETE on the six learner tables |
| `service_role` vocabulary DML | First `REVOKE ALL` from `service_role` on each vocabulary table, clearing default/existing ALL from a fresh Supabase project. Then SELECT / INSERT / UPDATE only. No DELETE / TRUNCATE / REFERENCES / TRIGGER. The importer does not need DELETE. Empty-target seed + deterministic upsert is unchanged. |

Vocabulary data is server/admin importer state. Student `/train`
and free-play still use the bundled dataset. No vocabulary client
RLS policies.

## Vocabulary fingerprint

`algorithmVersion`: `vocabulary-content-v1`

Content-bound canonical fingerprint, not a frozen published hash
and not a hash of keys alone:

1. Map the bundled dataset through `toVocabularyImportRows()`.
2. Apply abbreviation updates onto lexeme rows.
3. Sort rows by stable identity (`id` / `lexeme_id`).
4. Recursively sort object keys. Keep array business order.
5. Type-tag null, string, number, and boolean. Do not confuse
   `null` with `""`.
6. SHA-256 the UTF-8 canonical payload, including
   `algorithmVersion`.

Imported columns only. `created_at` / `updated_at` are omitted.

Produce locally:

`npm run import:vocabulary -- --fingerprint`

Empty-target seed must match those counts and that fingerprint.
It must leave learner tables empty. Stale-row delete is out of
scope.

## Excluded from V0

`cleanup_progress_test_user`, `learning_sessions`,
`vocabulary_placement_reviews`, Context Lab / content-release
objects, campus / enrollment / newsletter / traffic,
`public.users`, Blaze-named functions, Auth users, Storage,
Realtime, learner rows, test data.
