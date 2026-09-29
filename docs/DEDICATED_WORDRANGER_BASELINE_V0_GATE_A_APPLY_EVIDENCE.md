# Dedicated WordRanger Baseline V0 Gate A Apply Evidence

Candidate / Not a Standard. **Local evidence record of one authorized remote Gate A apply.**

The remote Gate A apply happened on the Dedicated remote target
through the locally proven Supabase CLI channel. Remote schema and
history now exist. Vocabulary remains empty. Runtime and Production
are not activated.

At the time this evidence was captured, the evidence commit was local and unpushed.
It was not the authorized apply head. The authorized remote Gate A
apply used commit `8a3362e6f3eb9d56101cafe315522a07e9ceb863`. A
later push of this evidence record does not rerun or alter the remote apply.
Inclusion of the evidence in PR #17 does not authorize vocabulary
import, runtime activation, merge, Production deployment or Gate B.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Source branch:
  `migration/dedicated-wordranger-baseline-candidate-v0`
- Authorized PR / isolated worktree head:
  `8a3362e6f3eb9d56101cafe315522a07e9ceb863`
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
| Archive | 12 historical migrations remain outside the active directory |
| Authored transaction control | absent |
| Handwritten history insert | absent |
| Repo-local CLI | Supabase CLI **2.118.0** |

## 2. Isolated apply workspace and credentials

Created a temporary detached git worktree at the exact authorized
head. That worktree contained the reviewed baseline, exactly one
active migration, and its own clean `npm ci` CLI **2.118.0**.

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase or Postgres variables. Did not use `--linked` or
the legacy CLI link.

Classifications:

- `DEDICATED_API_AND_DB_MATCH`
- `SERVICE_ROLE_SNAPSHOT_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

## 3. Immediate pre-apply precondition

Read-only direct session immediately before the single apply.
Transaction set read-only. SELECT-only judges. No learner row
payloads were selected.

| Judge | Result |
| --- | --- |
| REQUIRED_CORE tables (10) | 0 present |
| `prevent_learning_evidence_mutation` | absent |
| `learning_evidence_no_update` | absent |
| 18 baseline-owned named indexes | 0 present |
| REQUIRED_CORE catalog | **`TARGET_EMPTY_CATALOG_VERIFIED`** |
| History infrastructure | **`HISTORY_INFRASTRUCTURE_ABSENT`** |
| Shared Blaze objects | **`SHARED_BLAZE_OBJECTS_ABSENT`** |
| Roles | **`REQUIRED_ROLES_RECOGNIZABLE`** |
| `pgcrypto` | **`PGCRYPTO_INSTALLED`** |
| Production alias | still `782ffcca670c` |
| Precondition | **pass** |

## 4. Apply command

Executed exactly once from the isolated reviewed worktree. Shell
tracing disabled. Connection value not printed. No retry.

Sanitized command shape:

```
./node_modules/.bin/supabase db push \
  --db-url <Dedicated direct connection> \
  --yes \
  --skip-vault \
  --workdir <reviewed isolated workdir>
```

Forbidden flags were absent:

- `--linked`
- `--include-all`
- `--include-seed`
- `--include-roles`

Intended migration list contained only:

`202609260001_dedicated_wordranger_baseline_v0`

| Result | Value |
| --- | --- |
| CLI exit status | `0` |
| Exit class | **`APPLY_EXIT_ZERO`** |
| Other migrations proposed | no |
| Dashboard SQL Editor | not used |
| `db query --file` | not used |
| `migration repair` | not used |
| Manual history insert | not used |

## 5. Post-apply verification recovery

Baseline apply ran exactly once. CLI apply exited 0. The
first automated postcondition query failed. The apply was not retried.
Verification continued using batched SELECT-only reconciliation.
The reconciliation performed no DDL or DML. There was
no migration repair and no manual history insert. The
reconciliation verified the exact schema, history, security and
zero-row postconditions. The query failure was a
verification-query failure, not evidence of a second or failed
apply. No error message, cause, or status code was recorded
beyond that classification.

- `POST_APPLY_FIRST_QUERY_FAILED`
- `SELECT_ONLY_RECONCILIATION_VERIFIED`

## 6. Migration history postcondition

SELECT-only. The CLI wrote the history row. No handwritten insert.

- History table exists
- History row count: `1`
- Version: `202609260001`
- Name: `dedicated_wordranger_baseline_v0`
- Stored statement count: `87`
- Authored `begin;` / `commit;`: absent
- Handwritten `schema_migrations` insert: absent
- First stored statement includes `create extension` and `pgcrypto`
- Last stored statement grants `service_role` on `student_lexeme_weaknesses`
- Other versions: none
- Classification: **`HISTORY_POSTCONDITION_VERIFIED`**

## 7. Formal schema inventory

Classification: **`COMPLETE`**

| Object | Result |
| --- | --- |
| REQUIRED_CORE tables | 10 present |
| `public.prevent_learning_evidence_mutation` | present |
| `learning_evidence_no_update` | present |
| 18 named indexes | 18 present |
| `pgcrypto` | installed |

## 8. Initial data state

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

## 9. Vocabulary privilege matrix

Classification: **`VOCAB_SERVICE_ROLE_SUI_NO_DELETE`**.

Applies identically to the four vocabulary tables.

| Grantee | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PUBLIC | no | no | no | no | no | no | no |
| anon | no | no | no | no | no | no | no |
| authenticated | no | no | no | no | no | no | no |
| service_role | yes | yes | yes | no | no | no | no |

## 10. Learner security matrix

Classification: **`LEARNER_RLS_ENABLE_NOT_FORCE_NO_CLIENT_POLICIES`**
and **`LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED`**.

Applies identically to the six learner tables.

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

## 11. Evidence protection

- Append-only function `public.prevent_learning_evidence_mutation` exists
- Trigger `learning_evidence_no_update` exists
- No mutation probe used real learner rows
- No test Evidence was inserted

## 12. Contamination exclusions

Classification: **`SHARED_AND_OPTIONAL_OBJECTS_ABSENT`**.

- Shared Blaze objects remain absent
- No optional Context Lab / content-release / placement objects
- No test-only cleanup RPC
- `learning_sessions` was not created

## 13. Operational safety

- Production alias still
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Vercel env was not modified
- Production was not redeployed
- `/train` was not requested
- Vocabulary was not imported
- Learner data was not written
- PR #17 was not merged
- Auto-merge was not enabled
- Gate B was not authorized and was not started

## 14. Cleanup

Temporary credential snapshot and isolated worktree were removed
after verification. Dedicated schema was not dropped or altered
after the successful apply. Blaze was not touched.

- **`TEMP_DELETED`**
- **`WORKTREE_REMOVED`**

## 15. Conclusion

`GATE_A_BASELINE_APPLIED`;
`SCHEMA_AND_HISTORY_POSTCONDITIONS_VERIFIED`;
`VOCABULARY_NOT_IMPORTED`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

## 16. Non-claims

- Vocabulary was not imported.
- Learner data was not written.
- `/train` was not started.
- PR #17 was not merged.
- Vercel env was unchanged.
- Production was not redeployed.
- Gate B is not authorized.
- This document does not authorize import, `/train`, merge, or
  Production promotion.
