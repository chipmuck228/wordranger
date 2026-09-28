# Dedicated WordRanger Transactional Direct-Postgres Remote Preflight Evidence

Candidate / Not a Standard. **Local evidence record of one authorized
read-only direct-Postgres preflight attempt.**
This is not a remote vocabulary import and not a COMMIT write.

The runner inspected Dedicated credentials against source head
`edd6e247680742f9845bca7091068ccd1ef5ca0b`. This evidence commit
is a later local record. It is not itself a remote-apply
authorization. A later push of this record does not rerun or
alter Dedicated.

- Date: **2026-09-28**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Inspected source head:
  `edd6e247680742f9845bca7091068ccd1ef5ca0b`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Do not store a later PR head SHA here. That is an impossible
self-reference.

## 1. Authorization

`--apply` remained hard-closed:
`REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`.

The old PostgREST importer `--apply` was not invoked.
No remote INSERT / UPDATE / DELETE / TRUNCATE / DDL was sent.
No COMMIT write transaction was opened.

## 2. Credential-source classifications

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase / Postgres / Vercel variables. Did not use
`--linked`. Did not compose a REST URL into a DB URL.

Required names were present. API URL and database user-ref
resolved to the same Dedicated project. Both snapshot database
URLs used the pooler host class. Neither URL used the dedicated
direct host class.

Classifications:

- `DEDICATED_SNAPSHOT_ELIGIBLE`
- `DEDICATED_API_AND_DB_MATCH`
- `LEGACY_SOURCE_EXCLUDED`
- `POOLED_TRANSACTION_QUERY_REJECTED`
- `SQL_NOT_ATTEMPTED`
- `TEMP_DELETED`

Because the snapshot had no dedicated direct-Postgres URL, the
runner refused to connect. It did not treat `sslmode=require` as
verify-full. It did not open `BEGIN READ ONLY`. It did not
downgrade TLS.

## 3. Local runner proof

Independent of the remote stop, the one-shot runner was verified
on disposable local PostgreSQL 16:

- `--fingerprint` printed the expected content fingerprint
- `--validate` returned `LOCAL_CONTENT_VALID`
- `--preflight` against loopback returned
  `READONLY_PREFLIGHT_COMPLETE`
- `--dry-run` returned `LOCAL_DRY_RUN_ROLLED_BACK`
- `--apply` returned `REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`
  even with bypass environment variables

Expected fingerprint remains `vocabulary-content-v1` /
`9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`.
Baseline SHA-256 remains
`7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe`.

## 4. Non-claims

- Dedicated vocabulary tables were not imported.
- Learner tables were not written.
- Direct DB TLS hostname/chain was not proven, because no
  dedicated direct URL was available to probe.
- This is not `DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED`; that class
  applies only after a dedicated direct target exists and the
  certificate check fails.
- PR #17 was not merged.
- Production was not deployed.
- This record does not authorize a remote transactional import.
