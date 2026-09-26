# Dedicated WordRanger Baseline V0 Apply Checklist

Candidate / Not a Standard. **Checklist only. Nothing below is done.**

Companion to `docs/DEDICATED_WORDRANGER_BASELINE_V0_REMOTE_APPLY_PLAN.md`.
A checked box is not authorization. Each gate needs its own later
authorization.

Immutable identity for this checklist:

- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR #17 head: `bb6e522e4db350ca915dade672cbed786f6a7bd1`
- Baseline:
  `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`
- Baseline SHA-256:
  `0ca22a8adba187ad4cc9255d357ab4c9da94dbc2e0a401fe65e6afc73e096b35`
- Vocabulary: `vocabulary-content-v1` /
  `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`
  / `1600` / `1638` / `716` / `1638`
- Dedicated target: `DEDICATED_TARGET_MATCH` / `TARGET_EMPTY`
- Production alias rollback: `782ffcca670c`

Gates must run in order: **Gate A → Gate B → Gate C → Gate D**.
Do not skip ahead. Do not merge PR #17 from this checklist.

## 0. Hard stops — abort and do not apply

- [ ] Confirm PR #17 is still OPEN and unmerged before any later
      authorization
- [ ] Confirm Production alias is still `782ffcc`
- [ ] Confirm Dedicated identity is still `DEDICATED_TARGET_MATCH`
- [ ] Confirm Dedicated schema is still `TARGET_EMPTY` or an
      expected post-gate state, never a drifted partial schema
- [ ] Confirm baseline SHA-256, PR head, and vocabulary fingerprint
      have not drifted
- [ ] Confirm the operator is not on the legacy CLI link
- [ ] Refuse `db push` / `migration up` / history repair
- [ ] Refuse any apply that would copy campus / enrollment /
      newsletter / traffic / `public.users` or other shared Blaze
      objects
- [ ] Refuse learner-data migration
- [ ] Refuse automatic PR merge

## 1. Preflight (read-only)

- [ ] Required extensions current state recorded
- [ ] REQUIRED_CORE tables absent or exactly the reviewed V0 shape
- [ ] Migration history empty or missing; no fabricated Blaze rows
- [ ] Learner rows absent
- [ ] Vocabulary rows absent
- [ ] V0 trigger / function / index names absent before Gate A
- [ ] Shared Blaze objects absent
- [ ] `anon` / `authenticated` / `service_role` exist
- [ ] Production `SUPABASE_SERVICE_ROLE_KEY` name present
- [ ] Production configuration still `POINTS_TO_DEDICATED_TARGET`

Stop if any REQUIRED_CORE table has unexpected structure, any
learner table has data, vocabulary is partially imported, shared
Blaze objects appear, target identity mismatches, hashes drifted,
the service-role server path cannot be confirmed, or Production
alias left `782ffcc`.

## 2. Gate A — baseline apply

- [ ] Separate authorization recorded
- [ ] Exact baseline file, SHA matches
- [ ] Dedicated target only
- [ ] Single transaction; SQL not edited
- [ ] No `db push`
- [ ] No history repair and no fake `schema_migrations` rows
- [ ] Catalog post-check passed
- [ ] On failure: transaction fully rolled back and Dedicated is
      `TARGET_EMPTY` again

## 3. Gate B — vocabulary seed

- [ ] Gate A catalog post-check already passed
- [ ] Importer from the reviewed PR head
- [ ] `npm run import:vocabulary -- --fingerprint` matches the
      locked `vocabulary-content-v1` identity
- [ ] Empty-target confirmed immediately before `--apply`
- [ ] Service-role path confirmed; no anon fallback
- [ ] Empty-target seed + deterministic upsert only
- [ ] No stale-row delete
- [ ] No learner-table writes
- [ ] Database read-back recomputes the same fingerprint
- [ ] Learner counts still zero

## 4. Gate C — runtime smoke

- [ ] Gate A and Gate B evidence both complete
- [ ] Service-role read-only counts checked first
- [ ] Anon / authenticated denied on learner and vocabulary tables
- [ ] No writes under the production placeholder identity
- [ ] Smoke identity separately authorized, disposable, and
      cleanable
- [ ] This checklist does not execute smoke

## 5. Gate D — merge / Production

- [ ] Gates A, B, and C have complete evidence
- [ ] Separate authorization to merge PR #17
- [ ] Reconfirm Production env `POINTS_TO_DEDICATED_TARGET`
- [ ] Remember merge triggers Git Production deployment
- [ ] After deploy: unauthenticated GET only, then a separately
      authorized `/train` smoke
- [ ] Keep `782ffcc` instant rollback until the new Production
      deploy is accepted
- [ ] Do not enable `/practice`, Auth, or Context Lab

## 6. Rollback reminders

- [ ] Gate A in-transaction failure → rollback transaction
- [ ] Gate A success / Gate B failure → keep schema, no runtime,
      rerun deterministic seed after fix
- [ ] Gate B success / Gate C failure → do not delete data, do
      not merge, investigate adapter/config
- [ ] Production deploy failure → instant rollback to `782ffcc`
- [ ] Learner writes already on Dedicated → stop writes; no
      overwrite/rebuild rollback
