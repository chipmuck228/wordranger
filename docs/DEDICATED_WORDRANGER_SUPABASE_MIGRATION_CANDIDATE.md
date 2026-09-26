# Dedicated WordRanger Supabase Migration Candidate

Candidate / Not a Standard. **Design only.**

- Date: **2026-09-26**
- Base: `origin/main` @ `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Local branch: `design/dedicated-wordranger-supabase-migration-candidate`
- This branch is **local only**. It must not be pushed. A push can create
  a Preview deployment against `TARGET_EMPTY`.
- Target project: **already exists**. This pass did **not** create a
  Supabase project.
- Vercel Marketplace Integration: **already exists**. This pass did
  **not** modify Integration or environment variables.
- No schema baseline, data export/import, Auth toggle, `/practice`
  enablement, Homepage change, or production-readiness claim.

## 0. Confirmed emergency state (rechecked read-only)

| Fact | Recheck |
| --- | --- |
| `origin/main` | unchanged at the expected SHA |
| Active production snapshot | `ACTIVE_PRODUCTION_TARGET_NOT_VERIFIED` |
| Production deployment vs Integration write | `PRODUCTION_DEPLOYMENT_PREDATES_INTEGRATION` |
| Current Production configuration | `POINTS_TO_DEDICATED_TARGET` |
| Current Preview configuration | `POINTS_TO_DEDICATED_TARGET` |
| Current Development configuration | `NOT_CONFIGURED` |
| Dedicated target WordRanger schema | `TARGET_EMPTY` |
| Automatic Git deployments | `ENABLED` |
| `/practice` | disabled |
| Context Lab | disabled |
| Deployment freeze | `ACTIVE` |
| New deploy / env edit / schema write / main drift since the emergency check | **none observed** |

Temporary Production env files used only to classify hostnames in
memory were deleted (`TEMP_DELETED`). Values were not printed or
committed.

## 1. Ownership boundary

| Role | Classification | Meaning |
| --- | --- | --- |
| Linked CLI project named `blaze` | `LEGACY_SOURCE_MATCH` | Legacy / shared source. Holds current WordRanger schema and learner history. Also holds campus, enrollment, newsletter, traffic, and `public.users`. |
| Dedicated WordRanger Supabase project | `DEDICATED_TARGET_MATCH` | Proposed WordRanger-only target. Live Auth/API host is not `blaze`. WordRanger runtime tables are absent. |
| Vercel project named `wordranger` | connected | Git `main` production branch. Integration wrote Preview + Production secrets. |

Do not copy shared Blaze application objects onto the target.

## 2. Critical Vercel Integration finding

**`PRODUCTION_TARGET_SWITCHED_BEFORE_MIGRATION`** applies to **current
Vercel Production configuration**, not to a proven live-runtime
snapshot.

Application names that win:

1. `NEXT_PUBLIC_SUPABASE_URL` — no fallback to `SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser and SSR Auth; optional
   fallback only inside `createSupabaseServerClient`
3. `SUPABASE_SERVICE_ROLE_KEY` — wins over anon for student-game
   server clients; required with no anon fallback for Context Lab,
   curated placement, and promotion

Integration also wrote unused aliases (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, publishable/secret/JWT names, `POSTGRES_*`).
Those aliases do not change application precedence. Host identity of
the two URL names agrees (`DEDICATED_TARGET`).

If a production or preview deploy happens now, `/train` Start uses
`createSupabaseServerClient` against `TARGET_EMPTY` and fail-closes.
Affected runtime paths after an unauthorized deploy:

- Daily Training `/train` (Start / submit / continue / resume)
- Free-play `/play/*` durable adapters
- Any later `/practice` supabase runtime
- Context Lab supabase runtime (still flag-gated)
- Vocabulary import `--apply` and curated-placement apply/export

This design continues as read-only. Recovery of Vercel env or a
rollback remains a **separately authorized** decision. Do not change
env here. Keep the freeze.

## 3. Repository migration inventory (summary)

Twelve files under `supabase/migrations/`. File presence is **not**
authorization to apply. Detail is in
`docs/DEDICATED_WORDRANGER_SUPABASE_OBJECT_INVENTORY.md`.

| File | Target class |
| --- | --- |
| `202609160001_vocabulary_domain.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609160002_learning_tasks.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170001_game_sessions.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170002_game_sessions_revision.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170003_learning_evidence_session_correlation.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170004_cleanup_progress_test_user.sql` | `TARGET_TEST_ONLY` |
| `202609170005_vocabulary_placement_reviews.sql` | `TARGET_OPTIONAL_EXPERIMENTAL` until Scheduler consumes curated placement |
| `202609200001_context_lab_runs.sql` | `TARGET_OPTIONAL_EXPERIMENTAL` |
| `202609220001_contextual_content_releases.sql` | `TARGET_OPTIONAL_EXPERIMENTAL` |
| `202609220002_contextual_content_active_releases.sql` | `TARGET_OPTIONAL_EXPERIMENTAL` |
| `202609220003_contextual_content_batch_promotions.sql` | `TARGET_OPTIONAL_EXPERIMENTAL` |
| `202609250001_learner_table_server_only_access.sql` | `TARGET_BASELINE_REQUIRED` (grants/RLS; assumes learner tables exist) |

Blaze history table `supabase_migrations.schema_migrations` is
**absent**. Management API migration list was empty at the last
authorized catalog. Objects were inferred as present or absent.

Present on Blaze by object inference, not history:

- vocabulary / learner / game session / Context Lab / contextual-content
  objects from the files above except the two noted next
- Dashboard-applied `202609250001` (SHA-256 pinned in apply-evidence
  docs). History was **not** repaired.

Absent on Blaze:

- `cleanup_progress_test_user`
- `vocabulary_placement_reviews`

`202609250001` would fail on an empty project if applied first. In
chronological order after the learner-table creates, it is valid SQL.
It names only the six WordRanger learner tables and must not be
generalized onto shared Blaze objects.

No repo migration references campus / enrollment / newsletter /
traffic tables.

## 4. Recommended migration-history strategy

**C. Hybrid — reviewed consolidated baseline, then chronological
future files.**

Not chosen for this pass (no SQL authored):

- **A.** Replay the twelve existing files in order on the empty
  target. Reproducible and closest to current concat tests, but it
  re-applies blaze-oriented comments, split experimental files, and
  two files Blaze never had, and it still leaves history as a later
  CLI concern.
- **B.** Baseline only, with no rule for later files.

### Why C

- The target is empty. It should receive a **WordRanger-only** schema,
  including Dashboard-applied server-only grants, without importing
  shared Blaze objects.
- Honest history means recording **only versions that are actually
  applied to the dedicated project**. Do not insert fake rows for
  `20260916*` / `20260925*` as if Blaze history were copied.
- Current repo tests read the existing files. Those files remain
  **historical reference** until a later authorized task adds the
  baseline file and updates tests.
- Future `db push` becomes discussable only after: (1) the reviewed
  baseline is applied on the dedicated project, (2) history is created
  from that baseline forward, (3) CLI is linked to the dedicated
  project by a separate authorization. Until then `db push`,
  `migration up`, and history repair stay **forbidden**.

### Inputs for a later baseline authoring task

- The twelve repository files
- Blaze object catalog (WordRanger tables only)
- Apply-evidence catalog for the six-table revoke
- Explicit exclusion list of shared Blaze objects
- Decision on whether experimental Context Lab / content-release
  objects belong in the first baseline or a later optional file

### Validation gates (later, not this pass)

1. Apply to an isolated empty database, never to Blaze.
2. Catalog: required `/train` objects exist; shared Blaze names
   absent.
3. Anon `limit=0` on learner tables is denied; service-role DML
   remains.
4. Append-only evidence trigger present.
5. History contains only the new baseline version (plus later real
   files).
6. No learner rows yet unless a retention option is authorized.

### Rollback of an unapplied baseline

Delete or replace the unreleased baseline file in git. Do not delete
Blaze data. Do not fabricate compensating history.

## 5. Data ownership and recommended retention

See the object inventory for the full matrix.

Reference data:

- `vocabulary_source_entries`, `lexemes`, `lexeme_relations`,
  `lexeme_tags` → **`REBUILD_FROM_REPO`** via
  `npm run import:vocabulary` (`--validate` / `--dry-run` first;
  `--apply` only after schema exists). Authoritative source is the
  bundled vocabulary dataset, not Blaze rows.
- `vocabulary_placement_reviews` → **`REBUILD_FROM_REPO`** from the
  curated JSON if a later task wants the review table. Blaze does not
  have this table. Scheduler / Daily Training must not consume it
  until a contract-changing step.

Learner data (Blaze; V1 placeholder identity; real `/train` events):

- `learning_tasks`, `learning_evidence`, `student_lexeme_models`,
  `student_lexeme_skill_states`, `student_lexeme_weaknesses`,
  `game_sessions`
- Row-count class from the last authorized `/train` smoke:
  **SMALL** (evidence low hundreds; tasks low hundreds; sessions
  tens). Not exported here.
- Rebuildable from Evidence: snapshots yes; tasks/sessions no.
- Placeholder pollution: **yes**. This does **not** make the history
  disposable.

**Recommended retention (Candidate, pending explicit
authorization): Option 4 — archive on Blaze, do not load into the
dedicated production learner model.**

| Option | Verdict |
| --- | --- |
| 1. Start dedicated with no learner history | Compatible with a clean Auth future; weaker as an archive story |
| 2. Migrate all learner history exactly | Copies placeholder identity into the new production model |
| 3. Evidence + required tasks, then replay snapshots | Correctness-friendly but still placeholder-bound |
| 4. Archive on Blaze; do not import | **Recommended Candidate.** Pedagogical continuity is already identity-less. Keeps Blaze as the read-only archive. Lowest verification risk for first `/train` on the dedicated project |

`learning_sessions` is a leftover Core stub. Schema may exist empty.
**`DO_NOT_MIGRATE`** rows.

Experimental Context Lab / contextual-content tables:
**`DO_NOT_MIGRATE`** unless a later program authorizes them. Production
flags are off. They are not required for `/train`.

## 6. Staged plan (not executed)

Order. Writes stay paused on WordRanger Blaze paths from stage 7.

1. **Schema baseline** on dedicated target only. Isolated apply.
   Stop if any shared Blaze object name appears or `/train` objects
   are missing.
2. **Static vocabulary rebuild** from repo. Compare lexeme /
   relation / tag counts and `canonical_key` fingerprints to the
   bundled dataset, not to Blaze as authority.
3. **Optional curated placement** from repo JSON. Only if the review
   table is in baseline.
4. **Learner-history migration** — skipped unless the user rejects
   Option 4 and authorizes Option 2 or 3.
5. **Snapshot replay** — only if Option 3 is authorized.
6. **Experimental data** — default omit.
7. **Final incremental sync** — only if learner migration was
   authorized and Blaze still received `/train` writes.
8. **Vercel cutover** — separate Production env authorization. Not
   this branch. Preview must not be created by pushing this branch.
9. **Runtime smoke** — controlled `/train` Start on an authorized
   preview or a later production window. GET `/train` is not a DB
   smoke test.
10. **Auth activation** — independent later program. Not bundled.

Failure stop: any catalog mismatch, fingerprint mismatch, unexpected
row-count class, or deploy against `TARGET_EMPTY`.

Recovery: leave Blaze untouched; drop or rebuild only the dedicated
target (separately authorized); keep Vercel frozen until ready.

## 7. Cutover and rollback (design)

Checklist: `docs/DEDICATED_WORDRANGER_SUPABASE_CUTOVER_CHECKLIST.md`.

Rollback:

- **Before Vercel cutover:** keep Production configuration frozen or
  separately restore Blaze names. Do not delete Blaze data.
- **Failed cutover before new target writes:** restore Production
  env to Blaze (separate authorization) and redeploy. Target may be
  wiped and rebuilt.
- **After new writes on target:** stop writes; do not overwrite Blaze
  with target; do not delete Blaze; decide forward-fix vs dual-read
  archive.

Never automatic destructive rollback.

## 8. Future Auth separation (not enabled)

The dedicated project can receive WordRanger Auth without changing
Blaze campus `public.users` or project-wide Blaze CAPTCHA.

Later independent stages, each separately authorized:

1. Anonymous Sign-In
2. CAPTCHA / Turnstile (project-wide on the dedicated project only)
3. Rate limits
4. Cookie refresh / `Sb-Forwarded-For` if required
5. Explicit Start-only mint
6. Two-user isolation
7. Account linking / recovery
8. Abandoned anonymous-user retention

Do not enable any of these with schema baseline or Vercel cutover.
`/practice` stays disabled until that later program.

## 9. Explicit non-claims

- No migration executed
- No migration history fabricated
- No Vercel cutover
- No production-readiness
- No Free Practice enablement
- No Homepage change
- No frozen learning-semantics change
- No Blaze deletion
- No second Supabase project
- No CLI relink
- No push / PR / merge / deploy
