# Dedicated WordRanger PostgREST Write-Probe Capability Preflight Evidence

Candidate / Not a Standard. **Local evidence record of one
authorized remote read-only capability GET.**
This is not a write probe and not a third import.

The remote GET inspected Dedicated against PR head
`61c755e06f94a8817a2453f4b21575c106318c04`. This evidence
commit is a later local record. It is not the inspected head.
A later push of this evidence record does not rerun or alter
the remote GET. This task performed no remote write.

This file records whether Dedicated currently honors
`Prefer: tx=rollback` on a `limit=0` GET. It does not run the
one-row write probe. It does not run `--apply`. It does not
authorize merge. `WRITE_PROBE_NOT_AUTHORIZED` is unchanged.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Inspected source branch:
  `migration/dedicated-wordranger-baseline-candidate-v0`
- Remote GET inspected commit:
  `61c755e06f94a8817a2453f4b21575c106318c04`
- This evidence commit is a later local record. It is not the
  inspected head and is not itself a write authorization.
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

## 1. Content identity

| Input | Value |
| --- | --- |
| Active baseline path | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
| Baseline SHA-256 | `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe` |
| `apply-import.ts` SHA-256 | `3b65732cafc8d03e306b75b82654c56ac0fdb6afbdc1f55d71b436a7d7731b53` |
| `batch-error.ts` SHA-256 | `2558791095682ee404232277954c0f542156f2bc0af645b70adb2fc29efd4ce6` |
| `import-rows.ts` SHA-256 | `44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36` |
| Vocabulary `algorithmVersion` | `vocabulary-content-v1` |
| Vocabulary fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |
| Counts | 1600 / 1638 / 716 / 1638 |

`apply-import.ts` remains a persisting upsert with no
`tx=rollback`. Reusing `--apply` stays
`IMPORTER_APPLY_PATH_REJECTED`.

## 2. Credential-source classifications

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase or Postgres variables. Did not use `--linked` or
the legacy CLI link.

Required names were present. API URL and database connection
resolved to the same Dedicated target. The service-role key came
from that same snapshot. JWT role claim was `service_role`.
Hosts did not classify as the legacy source.

Classifications:

- `REQUIRED_NAMES_PRESENT`
- `DEDICATED_API_AND_DB_MATCH`
- `SERVICE_ROLE_SNAPSHOT_MATCH`
- `LEGACY_SOURCE_EXCLUDED`

Temporary credential file result: **`TEMP_DELETED`**.

## 3. Production alias

Live Production aliases resolved to one Ready deployment whose
created time matches commit
`782ffcca670c8272a3ba7ca07bedaef4debdc95f`.

Classification: **`PRODUCTION_REMAINS_ON_782FFCC`**.

## 4. Authorized GET

Service-role only. One table. Request body: none. No count. No
row payloads. No INSERT / UPSERT / UPDATE / DELETE.

| Field | Value |
| --- | --- |
| Method | `GET` |
| Table | `vocabulary_source_entries` |
| Select | `id` |
| Limit | `0` |
| Prefer sent | `tx=rollback` |
| Request body | none |
| Write | false |

No HTTP response was received, so there is no response body to
describe. Provider message, hint, details, URL, and JWT were
not recorded.

## 5. Transport result

Identity checks passed, so the GET was sent. The request did
not complete a TLS/HTTP response.

Observed transport classes:

- Node HTTPS: `ECONNRESET`
- curl fallback: `CURL_EXIT_35`
- DNS families: IPv4 only
- API URL scheme: `https` with no whitespace

No HTTP status was received. No response headers were
received. `Preference-Applied` was therefore absent.

Classification: **`CAPABILITY_GET_TRANSPORT_FAILED`**.

`ECONNRESET` and `CURL_EXIT_35` are transport classes only.
They do not mean PostgREST rejected `tx=rollback`. They do
not mean `tx=rollback` is disabled. They do not mean the
server returned HTTP 4xx or HTTP 5xx. They do not prove a
TLS configuration error. They do not prove a later retry
would succeed.

This is not `TX_ROLLBACK_HONORED`.
This is not `TX_ROLLBACK_NOT_HONORED`.
Transport failure proves neither honored nor not honored.
Honor requires a response header.
Honor remains **`TX_ROLLBACK_HONOR_UNPROVEN`**.

## 6. Operational safety

- Production alias still
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Vercel env was not modified
- Production was not redeployed
- `/train` was not requested
- Vocabulary was not imported
- Learner data was not written
- PR #17 was not merged
- Auto-merge was not enabled
- Write probe was not executed
- `--apply` was not run
- This task performed no remote write
- Schema cache was not refreshed
- Grants and RLS were not modified
- `db-tx-end` was not read or changed

## 7. Cleanup

Temporary credential snapshot was removed after the GET
attempt. Dedicated schema was not dropped or altered. The
legacy source was not touched.

- **`TEMP_DELETED`**

## 8. Conclusion

`CAPABILITY_PREFLIGHT_EXECUTED`;
`CAPABILITY_GET_TRANSPORT_FAILED`;
`TX_ROLLBACK_HONOR_UNPROVEN`;
`WRITE_PROBE_NOT_AUTHORIZED`;
`THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

GET transport failure leaves honor
`TX_ROLLBACK_HONOR_UNPROVEN`. POST rollback was not tested
and is not proven. The write probe still requires a later
independent explicit authorization. A third complete import
remains unauthorized.

A later successful GET with `Preference-Applied: tx=rollback` would provide capability evidence only.
It would not itself authorize or prove zero-residue behavior for a POST write probe.

## 9. Non-claims

- Write probe was not executed.
- `--apply` was not executed against Dedicated.
- Gate B was not retried a third time.
- Vocabulary remains unimported.
- Learner data was not written.
- `/train` was not started.
- Vercel env was not modified.
- Production was not deployed.
- PR #17 was not merged.
- Gate C/D remain unauthorized.
- Hosted `db-tx-end` was not changed.
- This record does not authorize the write probe, a third
  import, `/train`, merge, or Production promotion.
- A successful GET can be capability evidence only.
- POST zero-residue behavior remains untested.
