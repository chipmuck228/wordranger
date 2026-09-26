# Dedicated WordRanger Supabase Cutover Checklist

Candidate / Not a Standard. **Checklist only. Nothing below is done.**

Base: `origin/main` @ `782ffcca670c8272a3ba7ca07bedaef4debdc95f`.

Use with `docs/DEDICATED_WORDRANGER_SUPABASE_MIGRATION_CANDIDATE.md`.
Do not treat a checked box as authorization. Each write stage needs
its own later authorization.

Current freeze (this design pass):

- Automatic Git deployments: `ENABLED`
- This design branch: **local only — do not push**
- Production configuration: `POINTS_TO_DEDICATED_TARGET`
- Dedicated schema: `TARGET_EMPTY`
- Active production snapshot: `ACTIVE_PRODUCTION_TARGET_NOT_VERIFIED`
- Finding: `PRODUCTION_TARGET_SWITCHED_BEFORE_MIGRATION` (configuration)

Until schema + reference data are ready, **do not merge to `main`**,
**do not push this branch**, **do not redeploy**, **do not promote**.

## 0. Freeze (active)

- [ ] Keep merges to `main` blocked
- [ ] Keep this design branch unpushed
- [ ] Do not create a Preview from this work
- [ ] Do not modify Vercel env or Integration
- [ ] Do not relink the CLI
- [ ] Do not `db push` / `migration up` / repair history
- [ ] Do not enable `/practice`
- [ ] Do not enable Anonymous Sign-In or CAPTCHA
- [ ] Do not delete Blaze data

## 1. Target schema validation

Separately authorized. Dedicated project only. Never Blaze.

- [ ] Author the reviewed hybrid baseline (not this pass)
- [ ] Apply to the empty dedicated project only
- [ ] Catalog `/train` required tables, indexes, trigger, grants
- [ ] Confirm shared Blaze names are absent
- [ ] Confirm `schema_migrations` contains only honestly applied
      versions
- [ ] Stop if any required object is missing

## 2. Target reference-data validation

- [ ] `import-vocabulary --validate` then `--dry-run`
- [ ] `--apply` only after schema gate
- [ ] Compare counts / `canonical_key` fingerprints to the bundled
      dataset
- [ ] Optional curated placement from repo JSON only
- [ ] Do not treat Blaze vocabulary rows as authority

## 3. Isolated target tests

- [ ] Persistence tests against the dedicated project only if a later
      task authorizes live keys
- [ ] Anon learner-table `limit=0` denied
- [ ] Service-role can insert a disposable test user that is not the
      V1 placeholder, then delete via the test RPC if that RPC is
      installed
- [ ] No Playwright required for design-only

## 4. Preview environment targeting the dedicated project

- [ ] Preview already has Integration names pointing at the dedicated
      project
- [ ] Do **not** create a Preview by pushing this design branch
- [ ] Preview HTTP only after schema + vocabulary exist
- [ ] Keep `FREE_PRACTICE_*` and `CONTEXT_LAB_ENABLED` unset

## 5. `/train` smoke (controlled identity)

- [ ] GET `/train` is not the smoke test
- [ ] One authorized Start on Preview (or a later production window)
- [ ] Confirm session / task / evidence increment on the **target**
- [ ] Confirm no write landed on Blaze
- [ ] Do not use this smoke to discover identity

## 6. Free Practice identity A/B isolation

- [ ] `/practice` remains 404
- [ ] Do not enable flags
- [ ] Isolation work waits for the later Auth program

## 7. Write-freeze WordRanger paths on Blaze

- [ ] Decide and announce a Blaze `/train` write freeze
- [ ] Required before any learner-row copy (if Option 2 or 3 is later
      authorized)
- [ ] Not required for Option 4 archive-only, except to stop growing
      the archive during cutover

## 8. Final incremental learner sync

- [ ] Default under recommended Option 4: **skip**
- [ ] If Option 2 or 3 is authorized: copy only WordRanger tables,
      with FK closure, checksums, and row-count class compare
- [ ] Never copy campus / enrollment / newsletter / traffic /
      `public.users`

## 9. Separate production Vercel env authorization

- [ ] Current Production names already point at the dedicated target
- [ ] Do not edit them in this design
- [ ] If rollback to Blaze is chosen instead, that is a **separate**
      env authorization
- [ ] Confirm Development remains `NOT_CONFIGURED` or is later filled
      on purpose

## 10. Redeploy

- [ ] Only after schema + vocabulary (+ optional learner) gates
- [ ] Only from reviewed `main`, not from this unpushed design branch
- [ ] Record production SHA and created time
- [ ] Confirm the deploy **postdates** readiness, not Integration-only

## 11. Production smoke

- [ ] Public GET `/`, `/train`, `/practice` (expect 404), Context Lab
      (expect 404)
- [ ] One authorized `/train` Start
- [ ] Not a claim that Free Practice is live

## 12. Observation window

- [ ] Watch fail-closed Start errors
- [ ] Watch that Blaze WordRanger counts stay flat if freeze held
- [ ] Do not enable new flags during the window

## 13. Blaze WordRanger data retained read-only

- [ ] Keep Blaze WordRanger tables readable
- [ ] Do not delete
- [ ] Option 4 archive lives here

## 14. Later retirement

- [ ] Separate program after Auth and a stable dedicated `/train`
- [ ] Never automatic

## Rollback

### Before Vercel cutover

- [ ] Leave Production frozen or separately restore Blaze names
- [ ] Rebuild the dedicated target if the baseline is wrong
- [ ] Blaze data stays

### Immediately after a failed cutover (no new target learner writes)

- [ ] Separate authorization to point Production back at Blaze
- [ ] Redeploy that restoration
- [ ] Dedicated target may be reset
- [ ] Do not delete Blaze

### After new writes have begun on the target

- [ ] Stop further writes
- [ ] Do not overwrite Blaze with target
- [ ] Do not delete Blaze
- [ ] Forward-fix the target or accept split history

## Auth (later program — all unchecked)

- [ ] Anonymous Sign-In
- [ ] CAPTCHA / Turnstile on the dedicated project only
- [ ] Rate limits
- [ ] Cookie refresh
- [ ] Start-only mint
- [ ] Two-user isolation
- [ ] Account linking / recovery
- [ ] Abandoned anonymous retention
- [ ] `/practice` enablement (after the above, not with cutover)
