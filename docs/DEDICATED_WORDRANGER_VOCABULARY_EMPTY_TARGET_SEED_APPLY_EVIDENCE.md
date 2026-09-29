# Dedicated WordRanger Empty-Target Vocabulary Seed Apply Evidence

Candidate / Not a Standard. **Local evidence record of one authorized
remote empty-target vocabulary seed apply.**

The remote seed apply happened on the Dedicated WordRanger target
through one `psql -f` of the exact committed seed file. This later
evidence record does not rerun or alter that apply. Inclusion of
this evidence in PR #17 does not authorize a Production switch,
`/train`, merge, Homepage / `/practice` / Auth enablement, or a
remote TypeScript fingerprint claim.

- Date: **2026-09-29**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Source branch:
  `migration/dedicated-wordranger-baseline-candidate-v0`
- Inspected / applied artifact head:
  `60e360880fe739629876fae397167f37ace9f33e`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Do not store a later evidence-commit SHA here. That is an
impossible self-reference. The inspected head above is a
capture-time identity for the exact seed artifact that was
executed. A later evidence push does not change that artifact.

Status:

`REMOTE_SEED_APPLIED_AND_COUNTS_VERIFIED`;
`MIGRATION_HISTORY_UNCHANGED_AFTER_SEED`;
`REMOTE_VOCABULARY_COUNTS_VERIFIED`;
`REMOTE_LEARNER_TABLES_ZERO_VERIFIED`;
`REMOTE_VOCABULARY_REFERENTIAL_INTEGRITY_VERIFIED`;
`VOCAB_SERVICE_ROLE_SUI_NO_DELETE_UNCHANGED`;
`LEARNER_SECURITY_UNCHANGED_AFTER_SEED`;
`NO_SHARED_OPTIONAL_OR_UNEXPECTED_OBJECTS_CREATED`;
`REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED`;
`PR_17_REMAINS_DO_NOT_MERGE`;
`PRODUCTION_REMAINS_ON_782FFCC`

The committed seed SQL still carries the authored comment
`REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED`. That comment is
the generator's capture-time identity. It is not rewritten. This
evidence records the later authorized apply.

## 1. Content identity

| Input | Value |
| --- | --- |
| Seed path | `supabase/seeds/dedicated_wordranger_vocabulary_v0.sql` |
| Seed SHA-256 | `2fb4c9eb6bae072cf263fa130cea72a861ee07804c9e00255766cb7261f1ad8c` |
| Baseline path | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
| Baseline SHA-256 | `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe` |
| Fingerprint version | `vocabulary-content-v1` |
| Expected local fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |
| Expected counts | `1600 / 1638 / 716 / 1638` |
| Active lineage | exactly one migration, the baseline above |

Local PostgreSQL 16 A–H already verified a disposable readback
fingerprint match. That local proof is not a remote TypeScript fingerprint.

## 2. Target and credentials

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git for the SELECT-only post-check only.
Did not read a local dotenv file. Did not use ambient Supabase
or Postgres variables. Did not use `--linked` or the legacy CLI
link. Did not print URL, host, project ref, user, password, key,
or JWT.

The earlier authorized apply used one session-mode Dedicated
Postgres connection with `sslmode=verify-full` and the official
Supabase CA. Dashboard SQL Editor was not used. The retired
remote direct-Postgres runner was not used.

Classifications:

- `DEDICATED_SNAPSHOT_ELIGIBLE`
- `DEDICATED_API_AND_DB_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

Temporary snapshot deleted: **`TEMP_DELETED`**.

## 3. Authorized execution facts

Executed exactly once. SQL was not edited. The transaction was
not split. There was no retry.

Sanitized command shape:

```
psql "<Dedicated session-mode connection, sslmode=verify-full>" \
  -v ON_ERROR_STOP=1 \
  -f supabase/seeds/dedicated_wordranger_vocabulary_v0.sql
```

Observed executor tokens, in order:

- `BEGIN`
- `SET`
- precondition `DO`
- `INSERT 0 1600`
- `INSERT 0 1638`
- `INSERT 0 716`
- `INSERT 0 1638`
- postcondition `DO`
- `COMMIT`

Not used:

- Dashboard SQL Editor
- `db push`
- PostgREST `--apply`
- `DELETE` / `TRUNCATE` / `UPDATE` / `UPSERT` / `ON CONFLICT`
- migration repair
- handwritten `schema_migrations` insert

## 4. Migration history

SELECT-only after apply.

- History table exists
- History row count: `1`
- Version: `202609260001`
- Name: `dedicated_wordranger_baseline_v0`
- Other versions: none
- Seed apply wrote no history row

Classification: **`MIGRATION_HISTORY_UNCHANGED_AFTER_SEED`**.

## 5. Vocabulary counts

Count-only. No source-word, UUID, or row payload was selected.

| Table | Rows |
| --- | --- |
| `vocabulary_source_entries` | `1600` |
| `lexemes` | `1638` |
| `lexeme_relations` | `716` |
| `lexeme_tags` | `1638` |

Classification: **`REMOTE_VOCABULARY_COUNTS_VERIFIED`**.

Correct counts are not content correctness.

## 6. Learner counts

Count-only. No learner row was created or read.

| Table | Rows |
| --- | --- |
| `learning_tasks` | `0` |
| `game_sessions` | `0` |
| `learning_evidence` | `0` |
| `student_lexeme_models` | `0` |
| `student_lexeme_skill_states` | `0` |
| `student_lexeme_weaknesses` | `0` |

Classification: **`REMOTE_LEARNER_TABLES_ZERO_VERIFIED`**.

## 7. Referential integrity

Aggregate counts only. Each class below was `0`, except the
abbreviation digest comparison which matched the committed seed
postcondition.

- missing source-entry references
- missing relation source lexemes
- missing relation target lexemes
- missing tag lexemes
- missing abbreviation targets
- duplicate vocabulary PKs / unique keys
- empty required source / lexeme / relation business fields

Abbreviation count and abbreviation-pair digest matched the
committed seed postcondition. No row values were printed.

Classification: **`REMOTE_VOCABULARY_REFERENTIAL_INTEGRITY_VERIFIED`**.

## 8. Vocabulary privilege matrix

Classification: **`VOCAB_SERVICE_ROLE_SUI_NO_DELETE_UNCHANGED`**.

Applies identically to the four vocabulary tables. Catalog
`has_table_privilege` / ACL explode only. No DML probe.

| Grantee | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PUBLIC | no | no | no | no | no | no | no |
| anon | no | no | no | no | no | no | no |
| authenticated | no | no | no | no | no | no | no |
| service_role | yes | yes | yes | no | no | no | no |

## 9. Learner security

Classification: **`LEARNER_SECURITY_UNCHANGED_AFTER_SEED`**.

Applies identically to the six learner tables. Catalog only. No
mutation probe.

| Check | Result |
| --- | --- |
| RLS | enabled |
| FORCE RLS | disabled |
| Client policies | `0` |

| Grantee | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| PUBLIC | no | no | no | no |
| anon | no | no | no | no |
| authenticated | no | no | no | no |
| service_role | yes | yes | yes | yes |

- function `public.prevent_learning_evidence_mutation` present
- trigger `learning_evidence_no_update` present

## 10. Shared / optional contamination

Classification: **`NO_SHARED_OPTIONAL_OR_UNEXPECTED_OBJECTS_CREATED`**.

- Shared Blaze campus / enrollment / newsletter / traffic objects absent
- `public.users` absent
- placement-review objects absent
- Context Lab / content-release objects absent
- `cleanup_progress_test_user` absent
- `learning_sessions` absent
- no new public client policies

## 11. Remote fingerprint

`REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED`

The exact reviewed seed SHA was executed. SQL pre/post
assertions passed. Remote counts and referential integrity
passed. Local PostgreSQL readback fingerprint was previously
verified. Those facts are not rewritten as a remote TypeScript fingerprint.
No complete vocabulary readback was downloaded.

## 12. Product and deployment

- Seed completion is not Production runtime acceptance
- PR #17 remains DO NOT MERGE
- Production remains on `782ffcc` by the last confirmed record
- `/train` write smoke was not executed
- Homepage was not changed
- `/practice` remains unenabled by this work
- Auth remains unenabled
- Vercel env was not changed
- Preview success is not runtime acceptance

## 13. Non-claims

- Remote TypeScript fingerprint was not verified
- PR #17 was not merged
- Production was not deployed or switched
- `/train` was not started
- Homepage / `/practice` / Auth were not enabled
- The seed was not executed a second time
- No DDL / DML was performed in the post-check
- Learner data was not written
- Migration history was not edited
