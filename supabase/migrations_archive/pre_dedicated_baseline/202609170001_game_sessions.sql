-- Phase 05.1 generic game session orchestration.
-- Does not replace learning_tasks, learning_evidence, or student_lexeme_models.

create table if not exists game_sessions (
  id uuid primary key,
  user_id uuid not null,
  game_type text not null,
  plan_id text not null,
  status text not null
    check (status in ('active', 'completed', 'failed')),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_sessions_user_id_idx
  on game_sessions (user_id);
create index if not exists game_sessions_game_type_idx
  on game_sessions (game_type);
create index if not exists game_sessions_updated_at_idx
  on game_sessions (updated_at);

comment on table game_sessions is
  'Orchestration state for a student game session. Not learning truth.';
