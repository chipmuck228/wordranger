-- Phase 05.2 optimistic concurrency for game session orchestration.
-- revision is a row CAS token, not stateVersion and not scheduler policy version.

alter table game_sessions
  add column if not exists revision bigint not null default 0;

alter table game_sessions
  drop constraint if exists game_sessions_revision_nonnegative;

alter table game_sessions
  add constraint game_sessions_revision_nonnegative
  check (revision >= 0);

comment on column game_sessions.revision is
  'Optimistic concurrency token. Not JSON schema version and not scheduler policy version.';
