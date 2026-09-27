# Dedicated WordRanger Baseline V0 Gate B Import Incident

Candidate / Not a Standard. **Local incident record of one unsuccessful
remote Gate B import attempt.**

This is not a success evidence document. Vocabulary was not imported.
Learner data was not written. `/train` was not started. Runtime has
not been accepted. PR #17 was not merged. Production was not
deployed. Gate C/D remain unauthorized.

At the time this evidence was captured, the incident commit was local
and unpushed. It was not the authorized import head. The authorized
remote Gate B attempt used commit
`1418efb19a84332cca77384a7c4a11a691862c11`. A later push of this
incident record does not rerun or alter the remote import.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Authorized PR / isolated worktree head:
  `1418efb19a84332cca77384a7c4a11a691862c11`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

## 1. Content identity

| Input | Value |
| --- | --- |
| Active baseline path | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
| Baseline SHA-256 | `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe` |
| Importer | `scripts/import-vocabulary.ts` |
| Importer SHA-256 | `660faf1e2bc8f1502249a998ed9ef15caeb644a807d56192d48e6f46a9109a84` |
| Row mapper SHA-256 | `44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36` |
| Rebuild/fingerprint SHA-256 | `b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb` |
| Apply helper SHA-256 | `f4794d83b03c7b5b699f14a00693d140e8dfb88899260d2345e00ceec7508e89` |
| Expected fingerprint version | `vocabulary-content-v1` |
| Expected fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |

Source vocabulary assets used by the importer:

| Asset | SHA-256 |
| --- | --- |
| `data/vocabulary/source/words-source.json` | `f47afc841ffd5a9b5643499f38e158dd72481d4ad7bd0b7f12fa0ab87f1ed142` |
| `data/vocabulary/canonical/words-canonical.json` | `5dbbfd77aed165d55000746a45762615316ee43814045756f6d7ca9722e77910` |
| `data/vocabulary/enrichment/word-relations.json` | `99d30f16662ff0ca609b5bc546d103d2479ab7035f558b98cb35d405a072f0e9` |
| `data/vocabulary/enrichment/word-tags.json` | `a0555ed0bbd0f132f39efaf20827de18d8250d16773f0c4dd2946f0e60296b0e` |

The importer and fingerprint implementation were not modified.

## 2. Local fingerprint gate

Existing `--fingerprint` mode, from the isolated reviewed worktree:

- version `vocabulary-content-v1`
- fingerprint `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`
- source entries `1600`
- lexemes `1638`
- relations `716`
- tags `1638`
- `qaIssueCount` `0`

Existing vocabulary fingerprint / rebuild / PGlite import tests passed
before remote credentials were pulled.

## 3. Credential classifications

Pulled the authorized Vercel Production snapshot into a temporary file
outside git. Did not read `.env.local`. Did not use ambient Supabase
or Postgres variables. Did not use `--linked`.

- `DEDICATED_API_AND_DB_MATCH`
- `SERVICE_ROLE_SNAPSHOT_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

## 4. Immediate pre-import remote state

SELECT-only. All four vocabulary tables were still zero. Schema and
history still matched Gate A postconditions.

- History: exactly one row `202609260001` / `dedicated_wordranger_baseline_v0`
- Schema: **`COMPLETE`**
- Vocabulary tables: **`ALL_VOCABULARY_TABLES_ZERO_ROWS`**
- Learner tables: **`ALL_LEARNER_TABLES_ZERO_ROWS`**
- Vocabulary privileges: **`VOCAB_SERVICE_ROLE_SUI_NO_DELETE`**
- Contamination: **`SHARED_AND_OPTIONAL_OBJECTS_ABSENT`**
- Production alias: still `782ffcca670c`

## 5. Import attempt

Executed the existing reviewed `--apply` contract exactly once from
the isolated worktree. Shell tracing disabled. Credentials not
printed. Anon key was not passed. No DELETE, truncate, or learner
write was requested. The apply was not retried.

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
| Recorded error message | none beyond an unhandled promise rejection of an opaque object |
| Retry | none |
| Repair / truncate / delete | none |
| Manual history edit | none |

## 6. SELECT-only reconciliation

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
- No dangling references (tables empty)
- Remote content fingerprint was not computed because no rows exist
- Learner tables remain empty

## 7. Operational safety

- Production alias still
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Vercel env was not modified
- Production was not redeployed
- `/train` was not started
- PR #17 was not merged
- Gate C/D were not authorized and were not started

## 8. Cleanup

- **`TEMP_DELETED`**
- **`WORKTREE_REMOVED`**

Imported vocabulary was not removed because none was persisted.
Dedicated schema was not dropped.

## 9. Conclusion

`GATE_B_IMPORT_NOT_CLEANLY_COMPLETED`;
`NO_RETRY_DELETE_OR_REPAIR_PERFORMED`;
`LEARNER_WRITES_NOT_AUTHORIZED`;
`IMPORT_ROLLED_BACK_OR_NO_ROWS`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

## 10. Non-claims

- Vocabulary was not imported.
- Learner data was not written.
- `/train` was not started.
- Runtime has not been accepted.
- PR #17 was not merged.
- Production was not redeployed.
- Gate C/D remain unauthorized.
- This document does not authorize a retry, delete, repair, or Gate B
  re-run.

## 11. Follow-on diagnosis

A later local diagnosis and importer fail-closed hardening is recorded
in `docs/DEDICATED_WORDRANGER_BASELINE_V0_GATE_B_IMPORT_DIAGNOSIS.md`.
That work does not change this incident classification and does not
authorize a Gate B retry.
