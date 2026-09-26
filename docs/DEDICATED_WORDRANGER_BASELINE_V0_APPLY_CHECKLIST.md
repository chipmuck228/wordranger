# Dedicated WordRanger Baseline V0 Apply Checklist

Candidate / Not a Standard. **Checklist only. Nothing below is done.**

Companion to `docs/DEDICATED_WORDRANGER_BASELINE_V0_REMOTE_APPLY_PLAN.md`.
A checked box is not authorization. Gate A is **BLOCKED**. Status:
`CLI ATOMIC CHANNEL PROVEN LOCALLY`;
`REMOTE APPLY STILL UNAUTHORIZED`.
Do not apply. Dashboard SQL Editor is not the apply channel.

Content identity for this checklist (immutable apply lock):

- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- Baseline:
  `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`
- Baseline version: `202609260001`
- Baseline SHA-256:
  `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe`
- Vocabulary: `vocabulary-content-v1` /
  `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`
  / `1600` / `1638` / `716` / `1638`
- Atomicity evidence: no authored top-level `begin;` / `commit;`;
  CLI 2.118.0 locally proven
- Archive exclusion: `supabase/migrations_archive/pre_dedicated_baseline/`
- Dedicated target: `DEDICATED_TARGET_MATCH`
- API probe: `TARGET_OBJECTS_NOT_EXPOSED_OR_NOT_FOUND`
- Catalog: not `TARGET_EMPTY_CATALOG_VERIFIED`
- Production alias rollback: `782ffcca670c`

Review identity is not a SHA stored in this file. Immediately
before any later apply, fetch and confirm: PR #17 is OPEN and
unmerged; remote PR head equals the fetched source-branch head;
no unreviewed commits; checks pass; no unresolved review threads;
the reviewed tree contains this Content identity. Hardcoding a
final PR head here would be an impossible self-reference.

Gates must run in order: **Gate A → Gate B → Gate C → Gate D**.
Do not skip ahead. Do not merge PR #17 from this checklist.
Refuse automatic PR merge.

## 0. Hard stops — abort and do not apply

- [ ] Confirm Review identity immediately before any later
      authorization. Do not treat a SHA written in this PR as
      the final head
- [ ] Confirm Production alias is still `782ffcc`
- [ ] Confirm Dedicated identity is still `DEDICATED_TARGET_MATCH`
- [ ] Confirm catalog is `TARGET_EMPTY_CATALOG_VERIFIED` before
      any Gate A attempt. `PGRST205` is not catalog-empty proof
- [ ] Confirm Content identity SHA-256, version `202609260001`,
      and vocabulary fingerprint have not drifted
- [ ] Confirm CLI is still 2.118.0
- [ ] Confirm the operator is not on the legacy CLI link
- [ ] Refuse Dashboard SQL Editor as the apply channel
- [ ] Refuse `db query --file` as the apply channel
- [ ] Refuse `migration repair` and any apply-then-fake-history
      split
- [ ] Refuse `--linked`
- [ ] Refuse `--include-all` / `--include-seed` / `--include-roles`
- [ ] Refuse unauthorized `db push` / `migration up`
- [ ] Refuse archive replay
- [ ] Schema/history mismatch is a stop
- [ ] Refuse any apply that would copy campus / enrollment /
      newsletter / traffic / `public.users` or other shared Blaze
      objects
- [ ] Refuse learner-data migration
- [ ] Refuse automatic PR merge
- [ ] Refuse `.env.local` or ambient env as a Gate B credential
      source

## 1. Preflight (read-only catalog)

- [ ] Authorized Dedicated-only catalog query, never legacy link
- [ ] REQUIRED_CORE tables absent
- [ ] Shared Blaze objects absent
- [ ] Conflicting functions / triggers / indexes absent
- [ ] History precondition: `schema_migrations` missing or empty
- [ ] Roles `anon` / `authenticated` / `service_role` exist
- [ ] Production `SUPABASE_SERVICE_ROLE_KEY` name present
- [ ] Production configuration still `POINTS_TO_DEDICATED_TARGET`
- [ ] Record `TARGET_EMPTY_CATALOG_VERIFIED` only after the above

Catalog verification is a Gate A precondition. Stop if any
REQUIRED_CORE table exists, shared Blaze objects appear, history
is not empty, target identity mismatches, hashes drifted, the
service-role server path cannot be confirmed, or Production alias
left `782ffcc`.

## 2. Gate A — baseline apply — BLOCKED

Recommended later channel, not executed here:

`supabase db push --db-url <Dedicated direct connection>`

- [ ] Do not apply while blocked. Remote apply is still
      unauthorized
- [ ] Dedicated direct DB connection identity verified
- [ ] `--db-url` explicit and Dedicated-only; `--linked` absent
- [ ] `--dry-run` lists exactly `202609260001`
- [ ] Active migrations directory contains exactly the reviewed
      baseline
- [ ] Exact baseline file, version `202609260001`, SHA matches
- [ ] Separate human authorization recorded
- [ ] Dedicated target only
- [ ] No Dashboard SQL Editor
- [ ] No `db query --file`
- [ ] No `migration repair`
- [ ] No archive replay
- [ ] History postcondition: exactly one row `202609260001` /
      `dedicated_wordranger_baseline_v0`; statements are the
      transaction-control-free baseline; no archive/Blaze
      versions
- [ ] Catalog post-check passed
- [ ] Schema/history mismatch stop: do not repair

## 3. Gate B — vocabulary seed

- [ ] Gate A catalog and history postconditions already passed
- [ ] Importer from the reviewed tree that contains Content
      identity
- [ ] Credential source is a Dedicated-only isolated snapshot
      (Vercel Production pull to a git-external temp file, or
      another approved Dedicated-only source)
- [ ] Not `.env.local`, not ambient env, not the legacy CLI link
- [ ] URL host and service-role key from the same snapshot
- [ ] No anon fallback in that snapshot
- [ ] Values not printed
- [ ] Importer process reads only the isolated snapshot
- [ ] Temp file deleted; `TEMP_DELETED` recorded
- [ ] Target identity re-checked before and after
- [ ] `npm run import:vocabulary -- --fingerprint` matches the
      locked `vocabulary-content-v1` identity
- [ ] Empty-target seed + deterministic upsert only
- [ ] No stale-row delete
- [ ] No learner-table writes
- [ ] Database read-back recomputes the same fingerprint

## 4. Gate C — no-write runtime and security preflight

- [ ] Gate A and Gate B evidence both complete
- [ ] Service-role read-only counts checked
- [ ] Anon / authenticated denied on learner and vocabulary tables
- [ ] Adapter/config validation only
- [ ] Gate C does not write learner data
- [ ] No session / task / evidence created
- [ ] No disposable identity minted
- [ ] No claim that smoke Evidence can be deleted
- [ ] This checklist does not execute smoke

## 5. Gate D — merge / Production

- [ ] Gates A, B, and C have complete evidence
- [ ] Separate authorization to merge PR #17
- [ ] Reconfirm Production env `POINTS_TO_DEDICATED_TARGET`
- [ ] Remember merge triggers Git Production deployment
- [ ] After deploy: unauthenticated GET only
- [ ] `/train` write smoke is a further authorization, uses the
      existing `/train` identity contract, and leaves append-only
      Evidence if run
- [ ] If permanent canary Evidence is not accepted, skip write
      smoke
- [ ] Keep `782ffcc` instant rollback until the new Production
      deploy is accepted
- [ ] Do not enable `/practice`, Auth, or Context Lab

## 6. Rollback reminders

- [ ] Gate A blocked or failed at precondition → no remote change
- [ ] Schema/history mismatch → stop; no repair
- [ ] Gate A success / Gate B failure → keep schema and honest
      history, no runtime, rerun deterministic seed after fix
- [ ] Gate B success / Gate C failure → do not delete data, do
      not merge, investigate adapter/config
- [ ] Production deploy failure → instant rollback to `782ffcc`
- [ ] Learner writes already on Dedicated → stop writes; no
      overwrite/rebuild; Evidence is append-only
