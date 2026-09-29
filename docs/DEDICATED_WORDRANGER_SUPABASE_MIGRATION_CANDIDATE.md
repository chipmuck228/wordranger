# Dedicated WordRanger Supabase Migration Candidate

Candidate / Not a Standard. **Design only.**

- Date: **2026-09-26**
- Base: `origin/main` @ `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Branch: `design/dedicated-wordranger-supabase-migration-candidate`
- This design branch **has been pushed** and **has already triggered
  Vercel Preview**. Automatic Git deployments remain `ENABLED`, so
  later pushes may trigger additional Preview builds.
- Preview count and the latest Preview commit are **observations**,
  not a stable contract of this Candidate. Historical first observed
  Preview: design commit `dfd46ec` (Ready). That SHA is not required
  to remain the latest Preview.
- **No** Preview of this branch is schema or `/train` runtime
  acceptance. While the Dedicated target is `TARGET_EMPTY`, do not
  Start `/train` or write learner data from any such Preview.
- Production / `main` deployment freeze remains **ACTIVE**.
  Production has **not** been redeployed because of this Candidate.
  `main` was **not** merged.
- Target project: **already exists**. This program did **not** create
  a Supabase project and did **not** run Supabase DDL/DML.
- Vercel Marketplace Integration: **already exists**. Env names were
  **not** added, removed, or edited after Integration write.
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
| Production / `main` deployment freeze | **ACTIVE** |
| Design-branch Preview | **has occurred**; later pushes may add more. Not acceptance. |
| Production redeploy after Integration or after this push | **none** |
| `main` merge | **none** |
| Supabase DDL/DML after Integration | **none** |
| Vercel env edit after Integration | **none** |

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

This design branch already has Preview deployment(s) whose
configuration points at `TARGET_EMPTY`. Later pushes may create
more. Production has not been redeployed for this Candidate. If
Production redeploys, or if anyone Starts `/train` on any such
Preview while the target is empty, the server client talks to an
empty schema and fail-closes. Do not Start `/train` on those
Previews. Affected runtime paths if writes are attempted:

- Daily Training `/train` (Start / submit / continue / resume)
- Free-play `/play/*` durable adapters
- Any later `/practice` supabase runtime
- Context Lab supabase runtime (still flag-gated)
- Vocabulary import `--apply` and curated-placement apply/export

This design continues as documentation only. Recovery of Vercel env
or a Production rollback remains a **separately authorized**
decision. Do not change env here. Keep the Production / `main`
freeze. Do not treat any branch Preview as a runtime gate.

## 3. Repository migration inventory (summary)

Twelve historical files now live under
`supabase/migrations_archive/pre_dedicated_baseline/`. File
presence is **not** authorization to apply. Detail is in
`docs/DEDICATED_WORDRANGER_SUPABASE_OBJECT_INVENTORY.md`.

| File | Target class |
| --- | --- |
| `202609160001_vocabulary_domain.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609160002_learning_tasks.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170001_game_sessions.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170002_game_sessions_revision.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170003_learning_evidence_session_correlation.sql` | `TARGET_BASELINE_REQUIRED` |
| `202609170004_cleanup_progress_test_user.sql` | `TARGET_TEST_ONLY` — **exclude from Dedicated production baseline** |
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

**C. Hybrid — one reviewed consolidated baseline becomes the
Dedicated target's active lineage, then chronological future files.**

This design pass wrote the rule only. The later local authoring
task now lives on `migration/dedicated-wordranger-baseline-candidate-v0`
and is documented in
`docs/DEDICATED_WORDRANGER_CONSOLIDATED_BASELINE_CANDIDATE_V0.md`.
Remote Dedicated apply is still **not** authorized.

Not chosen:

- **A.** Replay the twelve existing files in order on the empty
  target. Leaves two lineages in play and keeps Blaze-oriented split
  files as the active history.
- **B.** Baseline only, with no archival rule for the twelve files.

### Active vs archival files

1. Dedicated target **active** migration lineage starts from **one**
   reviewed consolidated baseline in `supabase/migrations/`.
2. The twelve historical files have left the active
   `supabase/migrations/` directory and now live in
   `supabase/migrations_archive/pre_dedicated_baseline/`.
3. Old files and the consolidated baseline **must not** both remain
   in the active migration directory.
4. Do **not** copy or invent Blaze `schema_migrations` rows. Blaze
   history stays empty/absent. Dedicated history starts only when
   the baseline is actually applied there.
5. `db push` may be discussed only after that baseline is applied
   on the Dedicated target **and** real Dedicated migration history
   exists. Until then these stay **forbidden**:
   - `supabase db push`
   - `migration up`
   - history repair
   - manually inserting fake migration-history rows
6. `cleanup_progress_test_user` is **not** part of the Dedicated
   production baseline. See §4a.

Local authoring created
`supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`.
It has **not** been applied to the Dedicated target.

### Inputs for that later baseline authoring task

- The twelve repository files (then archived)
- Blaze object catalog (WordRanger tables only)
- Apply-evidence catalog for the six-table revoke
- Explicit exclusion list of shared Blaze objects
- Decision on whether experimental Context Lab / content-release
  objects belong in the first baseline or a later optional file
- Explicit exclusion of the test-only cleanup RPC

### Validation gates (later, not this pass)

1. Apply to an isolated empty database, never to Blaze.
2. Catalog: required `/train` objects exist; shared Blaze names
   absent; cleanup RPC absent on the production target.
3. Anon `limit=0` on learner tables is denied; service-role DML
   remains.
4. Append-only evidence trigger present.
5. Dedicated history contains only the new baseline version (plus
   later real files). No fabricated Blaze versions.
6. No learner rows yet unless a retention option is authorized.

### Rollback of an unapplied baseline

Delete or replace the unreleased baseline file in git. Do not delete
Blaze data. Do not fabricate compensating history.

## 4a. Production baseline excludes the test cleanup RPC

`cleanup_progress_test_user` is `TARGET_TEST_ONLY`.

- It does **not** enter the Dedicated **production** baseline.
- Production `/train` smoke must **not** depend on it.
- Do **not** copy this RPC onto the production Dedicated target.
- If a later program needs disposable test-row cleanup, use only:
  1. a separate test Supabase project, or
  2. a separately authorized test-only migration that is never
     applied to production.

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
8. **Vercel Production cutover** — separate Production
   authorization. Not this design revision. Branch Preview
   deployment(s) already exist and later pushes may add more; they
   are **not** acceptance environments and must not receive `/train`
   writes while `TARGET_EMPTY`.
9. **Runtime smoke** — only after schema + vocabulary exist, and
   only under a later authorization. GET `/train` is not a DB smoke
   test. Any empty-target Preview of this branch is forbidden for
   Start.
10. **Auth activation** — independent later program. Not bundled.

Failure stop: any catalog mismatch, fingerprint mismatch, unexpected
row-count class, Production deploy against `TARGET_EMPTY`, or
`/train` writes on any empty-target Preview of this branch.

Recovery: leave Blaze untouched; drop or rebuild only the dedicated
target (separately authorized); keep Production / `main` frozen
until ready.

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

- No schema/data migration executed
- No migration history fabricated
- No Vercel Production cutover
- No production-readiness
- No Free Practice enablement
- No Homepage change
- No frozen learning-semantics change
- No Blaze deletion
- No Supabase project was created by this design pass.
- The Dedicated WordRanger target pre-existed this design pass and
  was observed as `DEDICATED_TARGET_MATCH` / `TARGET_EMPTY`.
- No CLI relink
- No PR / no merge to `main`
- Design branch **was pushed** and Preview **has occurred**; later
  pushes may trigger additional Preview. Preview count is not a
  contract.
- Production has **not** been redeployed because of this Candidate
- Do not claim there were zero deployments of any kind
