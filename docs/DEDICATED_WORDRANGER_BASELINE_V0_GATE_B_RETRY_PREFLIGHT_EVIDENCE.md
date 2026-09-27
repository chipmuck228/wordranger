# Dedicated WordRanger Baseline V0 Gate B Retry Preflight Evidence

Candidate / Not a Standard. **Local read-only retry preflight.
This is not a Gate B retry and not a successful import.**

This file records whether Dedicated currently has the read-only
preconditions for a separately authorized Gate B retry. It does
not retry the importer. It does not run `--apply`. It does not
write the remote database. It does not authorize merge.

The original Gate B failure cause remains unknown.
`HISTORICAL_OPAQUE_FAILURE_CAUSE_NOT_RECOVERABLE` is unchanged.
Current PostgREST `limit=0` success does not prove that a later
write would succeed.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Inspected source branch:
  `migration/dedicated-wordranger-baseline-candidate-v0`
- Inspected PR / branch head:
  `d6da81039e51086f19a0d11c97e370777a56863f`
- This evidence commit is a later local record. It is not itself
  a retry authorization.
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

Importer and row-mapper hashes at this preflight:

| File | SHA-256 |
| --- | --- |
| `scripts/import-vocabulary.ts` | `6c3a1beb3d7ca80a50db5ab050cea86faea8a11ad6c7f509730d79efcfedc4f8` |
| `src/server/vocabulary/import/run-cli.ts` | `0816fd43c8506656dde05ed943f9aaab6a7d208511cc1ba65c7d3701d244af36` |
| `src/server/vocabulary/import/apply-import.ts` | `22ec38aa8a0ac163c56503470662eb652c71621e535d7cb426a7bc0cbafef74f` |
| `src/server/vocabulary/import/batch-error.ts` | `70a088d0a096593bc4f407606eb080344539d82f8a8014066e256627cc8d6c01` |
| `src/server/vocabulary/import/import-rows.ts` | `44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36` |
| `src/server/vocabulary/import/rebuild-contract.ts` | `b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb` |

Source vocabulary assets:

| Asset | SHA-256 |
| --- | --- |
| `data/vocabulary/source/words-source.json` | `f47afc841ffd5a9b5643499f38e158dd72481d4ad7bd0b7f12fa0ab87f1ed142` |
| `data/vocabulary/canonical/words-canonical.json` | `5dbbfd77aed165d55000746a45762615316ee43814045756f6d7ca9722e77910` |
| `data/vocabulary/enrichment/word-relations.json` | `99d30f16662ff0ca609b5bc546d103d2479ab7035f558b98cb35d405a072f0e9` |
| `data/vocabulary/enrichment/word-tags.json` | `a0555ed0bbd0f132f39efaf20827de18d8250d16773f0c4dd2946f0e60296b0e` |

Existing plan hash-locks for the importer script, row mapper,
rebuild contract, and vocabulary assets still match. Those locks
were not rewritten.

## 2. Credential-source classifications

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase or Postgres variables. Did not use `--linked` or
the legacy CLI link.

Required names were present. API URL and direct database
connection resolved to the same Dedicated target. The service-role
key came from that same snapshot.

Classifications:

- `DEDICATED_API_AND_DB_MATCH`
- `SERVICE_ROLE_SNAPSHOT_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

Temporary credential file result: **`TEMP_DELETED`**.

## 3. Migration history

SELECT-only. No repair. No handwritten insert.

- History table exists
- History row count: `1`
- Version: `202609260001`
- Name: `dedicated_wordranger_baseline_v0`
- Other versions: none
- Classification: **`HISTORY_POSTCONDITION_VERIFIED`**

## 4. Formal schema inventory

Classification: **`COMPLETE`**

| Object | Result |
| --- | --- |
| REQUIRED_CORE tables | 10 present |
| `public.prevent_learning_evidence_mutation` | present |
| `learning_evidence_no_update` | present |
| 18 named indexes | 18 present |
| `pgcrypto` | installed |

## 5. Row counts

Count-only. No row payloads were selected. No vocabulary import
and no learner writes were performed.

| Table | Rows |
| --- | --- |
| `vocabulary_source_entries` | `ZERO` |
| `lexemes` | `ZERO` |
| `lexeme_relations` | `ZERO` |
| `lexeme_tags` | `ZERO` |
| `learning_tasks` | `ZERO` |
| `game_sessions` | `ZERO` |
| `learning_evidence` | `ZERO` |
| `student_lexeme_models` | `ZERO` |
| `student_lexeme_skill_states` | `ZERO` |
| `student_lexeme_weaknesses` | `ZERO` |

Classification: **`ALL_REQUIRED_TABLES_ZERO_ROWS`**.

## 6. Contamination exclusions

Classification: **`SHARED_AND_OPTIONAL_OBJECTS_ABSENT`**.

- Shared Blaze objects remain absent
- No optional Context Lab / content-release / placement objects
- No test-only cleanup RPC
- `learning_sessions` was not created

## 7. Vocabulary privilege matrix

Classification: **`VOCAB_SERVICE_ROLE_SUI_NO_DELETE`**.

Applies identically to the four vocabulary tables. Catalog
`has_table_privilege` only. No INSERT / UPDATE / DELETE probe.

| Grantee | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PUBLIC | no | no | no | no | no | no | no |
| anon | no | no | no | no | no | no | no |
| authenticated | no | no | no | no | no | no | no |
| service_role | yes | yes | yes | no | no | no | no |

## 8. Learner security matrix

Classification: **`LEARNER_RLS_ENABLE_NOT_FORCE_NO_CLIENT_POLICIES`**
and **`LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED`**.

Applies identically to the six learner tables. Catalog only. No
DML probe.

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

## 9. PostgREST read-path preflight

Service-role only. SELECT of one identity column, `limit=0`, no
`count=exact`, no row payloads, no writes. Provider message, hint,
details, response body, and raw error objects were not recorded.

| Table | Identity column | Classification |
| --- | --- | --- |
| `vocabulary_source_entries` | `id` | `POSTGREST_READ_OK` |
| `lexemes` | `id` | `POSTGREST_READ_OK` |
| `lexeme_relations` | `id` | `POSTGREST_READ_OK` |
| `lexeme_tags` | `lexeme_id` | `POSTGREST_READ_OK` |

Overall: **`POSTGREST_READ_PATH_CONFIRMED`**.

This replaces the earlier diagnosis class
`CURRENT_POSTGREST_READ_PATH_NOT_FULLY_AVAILABLE` for the current
read path only. It does not recover the historical write-path
cause.

## 10. Local importer content identity

`--fingerprint`, `--validate`, and `--dry-run` ran locally with a
clean environment. No Supabase client. No service-role. No
network.

- version `vocabulary-content-v1`
- fingerprint `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`
- source entries `1600`
- lexemes `1638`
- relations `716`
- tags `1638`
- `qaIssueCount` `0`

Current importer identity:

- apply uses `createSupabaseServiceRoleClient`
- no anon fallback
- five closed operations:
  `SOURCE_ENTRIES_UPSERT`,
  `LEXEMES_UPSERT`,
  `LEXEME_ABBREVIATIONS_UPDATE`,
  `RELATIONS_UPSERT`,
  `TAGS_UPSERT`
- public errors keep only a strictly validated `providerCode`
- successful apply prints one `VOCABULARY_IMPORT_APPLIED` JSON
  record with counts

## 11. Operational safety

- Production alias still
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Vercel env was not modified
- Production was not redeployed
- `/train` was not requested
- Vocabulary was not imported
- Learner data was not written
- PR #17 was not merged
- Auto-merge was not enabled
- Gate B retry was not executed
- `--apply` was not run
- Schema cache was not refreshed
- Grants and RLS were not modified

## 12. Cleanup

Temporary credential snapshot was removed after the read-only
probes. Dedicated schema was not dropped or altered. Blaze was
not touched.

- **`TEMP_DELETED`**

## 13. Conclusion

`GATE_B_RETRY_PREFLIGHT_PASSED`;
`POSTGREST_READ_PATH_CONFIRMED`;
`RETRY_REQUIRES_SEPARATE_AUTHORIZATION`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

## 14. Non-claims

- Gate B was not retried.
- `--apply` was not executed against Dedicated.
- Vocabulary remains unimported.
- Learner data was not written.
- `/train` was not started.
- Vercel env was not modified.
- Production was not deployed.
- PR #17 was not merged.
- Gate C/D remain unauthorized.
- This document does not authorize retry, import, `/train`,
  merge, or Production promotion.
- A later retry would not be proven successful by these probes.
