# Dedicated WordRanger Baseline V0 Gate B Retry Apply Evidence

Candidate / Not a Standard. **Local evidence record of one authorized remote Gate B vocabulary import retry.**
This is not a successful import and not a runtime acceptance.

The authorized retry used isolated worktree head
`db6cc6552b280f7b137d88e28888f000cc9aa2db`. This evidence
commit is a later local record. It is not the authorized retry head.
A later push of this evidence record does not rerun or alter
the remote retry. This task performed exactly one `--apply`.

This was the second total remote `--apply` attempt against Dedicated
and the first explicitly authorized Gate B retry. The earlier
unsuccessful attempt used `1418efb19a84332cca77384a7c4a11a691862c11`.
This task did not execute a second retry.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Authorized retry / isolated worktree head:
  `db6cc6552b280f7b137d88e28888f000cc9aa2db`
- This evidence commit is a later local record. It is not the
  authorized retry head.
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

## 1. Content identity

| Input | Value |
| --- | --- |
| Active baseline path | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
| Baseline version | `202609260001` |
| Baseline name | `dedicated_wordranger_baseline_v0` |
| Baseline SHA-256 | `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe` |
| Active lineage | exactly one file, the baseline above |
| Expected fingerprint version | `vocabulary-content-v1` |
| Expected fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |
| Expected counts | `1600` / `1638` / `716` / `1638` |

Importer and row-mapper hashes at this retry:

| File | SHA-256 |
| --- | --- |
| `scripts/import-vocabulary.ts` | `6c3a1beb3d7ca80a50db5ab050cea86faea8a11ad6c7f509730d79efcfedc4f8` |
| `src/server/vocabulary/import/run-cli.ts` | `0816fd43c8506656dde05ed943f9aaab6a7d208511cc1ba65c7d3701d244af36` |
| `src/server/vocabulary/import/apply-import.ts` | `22ec38aa8a0ac163c56503470662eb652c71621e535d7cb426a7bc0cbafef74f` |
| `src/server/vocabulary/import/batch-error.ts` | `70a088d0a096593bc4f407606eb080344539d82f8a8014066e256627cc8d6c01` |
| `src/server/vocabulary/import/import-rows.ts` | `44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36` |
| `src/server/vocabulary/import/rebuild-contract.ts` | `b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb` |
| `src/server/vocabulary/import/plan-import.ts` | `63bca2c8a7f265da69fd03c8a455b7d10827cce1f702ca906efbd4a8cbc00b08` |

Source vocabulary assets:

| Asset | SHA-256 |
| --- | --- |
| `data/vocabulary/source/words-source.json` | `f47afc841ffd5a9b5643499f38e158dd72481d4ad7bd0b7f12fa0ab87f1ed142` |
| `data/vocabulary/canonical/words-canonical.json` | `5dbbfd77aed165d55000746a45762615316ee43814045756f6d7ca9722e77910` |
| `data/vocabulary/enrichment/word-relations.json` | `99d30f16662ff0ca609b5bc546d103d2479ab7035f558b98cb35d405a072f0e9` |
| `data/vocabulary/enrichment/word-tags.json` | `a0555ed0bbd0f132f39efaf20827de18d8250d16773f0c4dd2946f0e60296b0e` |

The reviewed importer was not modified for this retry.

## 2. Isolated retry workspace and credentials

Created a temporary detached git worktree at the exact authorized
retry head. That worktree contained the reviewed importer and its
own clean `npm ci`.

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase or Postgres variables. Did not use `--linked` or
the legacy CLI link. Did not pass an anon key.

Classifications:

- `DEDICATED_API_AND_DB_MATCH`
- `SERVICE_ROLE_SNAPSHOT_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

## 3. Immediate pre-retry remote state

SELECT-only. No business row payloads were selected.

- History: exactly one row `202609260001` / `dedicated_wordranger_baseline_v0`
- Schema: **`COMPLETE`**
- Vocabulary tables: **`ALL_VOCABULARY_TABLES_ZERO_ROWS`**
- Learner tables: **`ALL_LEARNER_TABLES_ZERO_ROWS`**
- Vocabulary privileges: **`VOCAB_SERVICE_ROLE_SUI_NO_DELETE`**
- Learner privileges: **`LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED`**
- Contamination: **`SHARED_AND_OPTIONAL_OBJECTS_ABSENT`**
- Four service-role PostgREST `limit=0` reads: **`POSTGREST_READ_OK`**
- Production alias: still `782ffcca670c`

Offline `--fingerprint`, `--validate`, and `--dry-run` from the
isolated worktree matched `vocabulary-content-v1` /
`9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`
/ `1600` / `1638` / `716` / `1638` / `qaIssueCount` `0`.

## 4. Single authorized retry

Executed the existing reviewed `--apply` contract exactly once from
the isolated worktree. Shell tracing disabled. Credentials not
printed. Anon key was not passed. No DELETE, truncate, or learner
write was requested. The apply was not retried a second time.

Sanitized command shape:

```
./node_modules/.bin/tsx scripts/import-vocabulary.ts --apply
```

Environment names passed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

| Result | Value |
| --- | --- |
| CLI exit status | `1` |
| Exit class | **`IMPORT_EXIT_NONZERO`** |
| Plan printed before failure | yes, expected counts, `qaIssueCount` `0` |
| Sanitized failure code | `VOCABULARY_IMPORT_BATCH_FAILED` |
| operation | `SOURCE_ENTRIES_UPSERT` |
| table | `vocabulary_source_entries` |
| batchStart | `0` |
| batchSize | `200` |
| kind | `POSTGREST_ERROR` |
| providerCode | none that passed the reviewed allowlist |
| Retry after failure | none |
| Repair / truncate / delete | none |
| Manual history edit | none |

Provider message, hint, details, cause, row content, and lemma
were not recorded.

## 5. SELECT-only reconciliation

Classification: **`IMPORT_ROLLED_BACK_OR_NO_ROWS`**.

| Table | Rows after attempt |
| --- | --- |
| `vocabulary_source_entries` | `ZERO` |
| `lexemes` | `ZERO` |
| `lexeme_relations` | `ZERO` |
| `lexeme_tags` | `ZERO` |
| six learner tables | `ZERO` |

- History still exactly one expected row
- Schema inventory unchanged (`COMPLETE`)
- Privilege matrices unchanged
- Shared / optional objects remain absent
- No dangling references (tables empty)
- Remote content fingerprint was not computed because no rows exist
- Learner tables remain empty
- `/train` was not requested

This is not `COMPLETE`. This is not `PARTIAL_IMPORT_STATE`.

## 6. Operational safety

- Production alias still
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Vercel env was not modified
- Production was not redeployed
- `/train` was not started
- PR #17 was not merged
- PR body was not updated
- Gate C/D were not authorized and were not started

## 7. Cleanup

- **`TEMP_DELETED`**
- **`WORKTREE_REMOVED`**

Imported vocabulary was not removed because none was persisted.
Dedicated schema was not dropped or repaired.

## 8. Conclusion

`GATE_B_RETRY_NOT_CLEANLY_COMPLETED`;
`NO_SECOND_RETRY_DELETE_OR_REPAIR_PERFORMED`;
`IMPORT_ROLLED_BACK_OR_NO_ROWS`;
`IMPORT_EXIT_NONZERO`;
`LEARNER_TABLES_REMAIN_EMPTY`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

## 9. Non-claims

- Vocabulary was not imported.
- Learner data was not written.
- `/train` was not started.
- Runtime has not been accepted.
- PR #17 was not merged.
- Production was not redeployed.
- Gate C/D remain unauthorized.
- This document does not authorize another retry, delete, repair,
  merge, or Production promotion.
- Remote content fingerprint was not verified because no rows exist.
