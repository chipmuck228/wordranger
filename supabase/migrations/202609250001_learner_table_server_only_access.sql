-- Free Practice Candidate / production security hardening (Slice 1).
-- Server-only learner-data access: browser Supabase clients must not read
-- or write these tables, especially learning_tasks.answer_key.
--
-- This file is committed for review. It is NOT applied remotely in this
-- slice. Do not treat "file exists" as "applied on blaze".
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

alter table learning_tasks enable row level security;
alter table game_sessions enable row level security;
alter table learning_evidence enable row level security;
alter table student_lexeme_models enable row level security;
alter table student_lexeme_skill_states enable row level security;
alter table student_lexeme_weaknesses enable row level security;

revoke all on table learning_tasks from public;
revoke all on table learning_tasks from anon;
revoke all on table learning_tasks from authenticated;
grant select, insert, update, delete on table learning_tasks to service_role;

revoke all on table game_sessions from public;
revoke all on table game_sessions from anon;
revoke all on table game_sessions from authenticated;
grant select, insert, update, delete on table game_sessions to service_role;

revoke all on table learning_evidence from public;
revoke all on table learning_evidence from anon;
revoke all on table learning_evidence from authenticated;
grant select, insert, update, delete on table learning_evidence to service_role;

revoke all on table student_lexeme_models from public;
revoke all on table student_lexeme_models from anon;
revoke all on table student_lexeme_models from authenticated;
grant select, insert, update, delete on table student_lexeme_models to service_role;

revoke all on table student_lexeme_skill_states from public;
revoke all on table student_lexeme_skill_states from anon;
revoke all on table student_lexeme_skill_states from authenticated;
grant select, insert, update, delete on table student_lexeme_skill_states to service_role;

revoke all on table student_lexeme_weaknesses from public;
revoke all on table student_lexeme_weaknesses from anon;
revoke all on table student_lexeme_weaknesses from authenticated;
grant select, insert, update, delete on table student_lexeme_weaknesses to service_role;

-- These tables use uuid primary keys. Repo migrations define no sequences
-- for them, so no sequence GRANT/REVOKE is issued.

comment on table learning_tasks is
  'Generated task public payload + server-only answer_key. Client roles revoked. Not applied remotely until an authorized migrate.';
