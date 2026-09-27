# Dedicated WordRanger Baseline V0 Remote Preflight Evidence

Candidate / Not a Standard. **Read-only evidence. Gate A was not executed.**

This file records a catalog-only remote preflight. It does not
authorize apply, merge, vocabulary import, learner writes, Vercel
env changes, or Production deployment.

Remote apply remains **unauthorized**.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Inspected source branch:
  `migration/dedicated-wordranger-baseline-candidate-v0`
- Inspected PR / branch head:
  `1f42a027f6dbda849aa5ed527911abd3a5ceaef0`
- This evidence commit is a later local record. It is not itself
  an apply head.
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
| Archive | 12 historical migrations remain `R100` under `supabase/migrations_archive/pre_dedicated_baseline/` |
| Authored transaction control | absent |
| Handwritten history insert | absent |
| Repo-local CLI | Supabase CLI **2.118.0** |

## 2. Credential-source classifications

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase or Postgres variables. Did not use `--linked` or
the legacy CLI link.

Required names were present:

- Dedicated Supabase API URL
- service-role key
- Dedicated direct database connection

Classifications:

- `DEDICATED_API_AND_DB_MATCH`
- `SERVICE_ROLE_SNAPSHOT_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

Temporary credential file result: **`TEMP_DELETED`**.

## 3. Catalog result

Read-only SQL session through the Dedicated direct connection.
Transaction set read-only before catalog queries. SELECT-only
`pg_catalog` / `information_schema` judges. No learner row
payloads were selected.

| Judge | Result |
| --- | --- |
| REQUIRED_CORE tables (10) | 0 present |
| `prevent_learning_evidence_mutation` | absent |
| `learning_evidence_no_update` | absent |
| 18 baseline-owned named indexes | 0 present |
| REQUIRED_CORE catalog | **`TARGET_EMPTY_CATALOG_VERIFIED`** |

No unexpected WordRanger table existed, so no row-count class was
required. Any existing required object would have been a stop.

## 4. Migration history

Inspected only by catalog SELECT. The history table was not
created.

- History infrastructure: **`HISTORY_INFRASTRUCTURE_ABSENT`**
- History row count: `0`
- Baseline version `202609260001` present: no
- Blaze / other versions present: no
- History precondition: **pass** (table missing or zero rows)

## 5. Shared-object contamination

Pattern and named-object judges only. No unrelated row data.

- Shared campus / enrollment / newsletter / traffic / `public.users`
  / `v3_migration_offering_legacy_stage` table matches: `0`
- Public functions whose names include `blaze`: `0`
- Classification: **`SHARED_BLAZE_OBJECTS_ABSENT`**

## 6. Roles and extensions

No role or extension was created or altered.

- `anon`, `authenticated`, `service_role`: **`REQUIRED_ROLES_RECOGNIZABLE`**
- `pgcrypto`: **`PGCRYPTO_INSTALLED`**
- Baseline SQL does not need a change before a later Gate A
  authorization

## 7. Command-channel preflight

Verified locally and statically. No remote `db push`, including
`--dry-run`, was executed.

Proposed later apply command, documentation only, not executed:

```
./node_modules/.bin/supabase db push \
  --db-url <Dedicated direct connection> \
  --yes \
  --skip-vault \
  --workdir <reviewed isolated workdir>
```

Forbidden for that later command:

- `--linked`
- `--include-all`
- `--include-seed`
- `--include-roles`
- Dashboard SQL Editor
- `db query --file`
- migration repair
- any legacy Blaze connection

Archive directory is outside the active CLI migrations workdir.

## 8. Non-claims

- No DDL occurred.
- No DML occurred.
- No `schema_migrations` object was created.
- No vocabulary import occurred.
- No learner data was written.
- `/train` was not started.
- PR #17 was not merged.
- Vercel env was not modified.
- Production was not redeployed.
- Gate A apply was **not** executed.
- Remote apply remains **unauthorized**.
- `GATE_A_APPLY_REQUIRES_SEPARATE_AUTHORIZATION`
