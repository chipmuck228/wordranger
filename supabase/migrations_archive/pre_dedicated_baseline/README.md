# Pre-dedicated baseline archive

These twelve files are the historical WordRanger migration
lineage. They are **not** an active Supabase CLI migration
directory.

Active lineage is only:

`supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`

Do not copy these files back into `supabase/migrations/`.
Do not treat this folder as `schema_migrations` history.
Do not invent Blaze history rows from these filenames.

`cleanup_progress_test_user` stays archived here. It is
test-only and is not part of the Dedicated production
baseline.
