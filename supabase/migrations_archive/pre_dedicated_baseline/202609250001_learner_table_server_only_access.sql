-- Free Practice Candidate / production security hardening (Slice 1).
-- Server-only learner-data access: browser Supabase clients must not read
-- or write these tables, especially public.learning_tasks.answer_key.
--
-- Tables are schema-qualified as public.<name> so a shared blaze
-- search_path cannot resolve a different schema's objects.
-- Do not write deployment status into database object comments.
--
-- Explicit table list only. Do not scan information_schema or touch
-- campus / enrollment / newsletter / other shared blaze objects.
-- These six tables are the WordRanger learner subsystem confirmed by
-- repo migrations and the remote inventory.
--
-- RLS is ENABLE only, not FORCE:
--   - Matches vocabulary_placement_reviews / context_lab_runs convention.
--   - service_role already BYPASSRLS, so FORCE is not required for the
--     server data client.
--   - FORCE plus zero policies would subject the table owner and
--     SECURITY DEFINER cleanup_progress_test_user to RLS lockout.
--
-- No anon/authenticated policies. If a later contract allows browser
-- direct access, design auth.uid() policies in a new slice.
--
-- These tables use uuid primary keys. Repo migrations define no sequences
-- for them, so no sequence GRANT/REVOKE is issued.

begin;

alter table public.learning_tasks enable row level security;
alter table public.game_sessions enable row level security;
alter table public.learning_evidence enable row level security;
alter table public.student_lexeme_models enable row level security;
alter table public.student_lexeme_skill_states enable row level security;
alter table public.student_lexeme_weaknesses enable row level security;

revoke all on table public.learning_tasks from public;
revoke all on table public.learning_tasks from anon;
revoke all on table public.learning_tasks from authenticated;
grant select, insert, update, delete on table public.learning_tasks to service_role;

revoke all on table public.game_sessions from public;
revoke all on table public.game_sessions from anon;
revoke all on table public.game_sessions from authenticated;
grant select, insert, update, delete on table public.game_sessions to service_role;

revoke all on table public.learning_evidence from public;
revoke all on table public.learning_evidence from anon;
revoke all on table public.learning_evidence from authenticated;
grant select, insert, update, delete on table public.learning_evidence to service_role;

revoke all on table public.student_lexeme_models from public;
revoke all on table public.student_lexeme_models from anon;
revoke all on table public.student_lexeme_models from authenticated;
grant select, insert, update, delete on table public.student_lexeme_models to service_role;

revoke all on table public.student_lexeme_skill_states from public;
revoke all on table public.student_lexeme_skill_states from anon;
revoke all on table public.student_lexeme_skill_states from authenticated;
grant select, insert, update, delete on table public.student_lexeme_skill_states to service_role;

revoke all on table public.student_lexeme_weaknesses from public;
revoke all on table public.student_lexeme_weaknesses from anon;
revoke all on table public.student_lexeme_weaknesses from authenticated;
grant select, insert, update, delete on table public.student_lexeme_weaknesses to service_role;

commit;
