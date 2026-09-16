-- WordRanger Learning Core v1
-- Event log + snapshot model. learning_evidence is append-only.

create extension if not exists pgcrypto;

create table if not exists words (
  id uuid primary key default gen_random_uuid(),
  lemma text not null,
  display_word text not null,
  difficulty numeric check (difficulty is null or (difficulty >= 0 and difficulty <= 1)),
  frequency_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists student_word_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  word_id uuid not null references words (id),
  mastery_stage text not null,
  retention_state text not null,
  mastery_score numeric not null check (mastery_score >= 0 and mastery_score <= 1),
  mastery_confidence numeric not null check (mastery_confidence >= 0 and mastery_confidence <= 1),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  next_review_at timestamptz,
  review_interval_days numeric not null default 0,
  evidence_count integer not null default 0,
  distinct_practice_days integer not null default 0,
  distinct_task_types integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);

create index if not exists student_word_models_user_id_idx
  on student_word_models (user_id);
create index if not exists student_word_models_word_id_idx
  on student_word_models (word_id);
create index if not exists student_word_models_next_review_at_idx
  on student_word_models (next_review_at);
create index if not exists student_word_models_mastery_stage_idx
  on student_word_models (mastery_stage);

create table if not exists student_word_skill_states (
  id uuid primary key default gen_random_uuid(),
  student_word_model_id uuid not null references student_word_models (id) on delete cascade,
  skill text not null,
  score numeric not null check (score >= 0 and score <= 1),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  total_attempts integer not null default 0,
  correct_attempts integer not null default 0,
  incorrect_attempts integer not null default 0,
  assisted_attempts integer not null default 0,
  consecutive_independent_successes integer not null default 0,
  last_practiced_at timestamptz,
  last_independent_success_at timestamptz,
  recent_performance jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (student_word_model_id, skill)
);

create table if not exists student_word_weaknesses (
  id uuid primary key default gen_random_uuid(),
  student_word_model_id uuid not null references student_word_models (id) on delete cascade,
  type text not null,
  skill text,
  severity numeric not null check (severity >= 0 and severity <= 1),
  related_word_id uuid references words (id),
  reason jsonb not null,
  detected_at timestamptz not null,
  last_triggered_at timestamptz not null,
  resolved_at timestamptz
);

create index if not exists student_word_weaknesses_model_idx
  on student_word_weaknesses (student_word_model_id);

create table if not exists learning_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  word_id uuid not null references words (id),
  session_id uuid references learning_sessions (id),
  game_id text,
  task_type text,
  skill text not null,
  prompt_mode text not null,
  answer_mode text not null,
  outcome text not null,
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  hint_count integer not null default 0 check (hint_count >= 0),
  difficulty numeric not null check (difficulty >= 0 and difficulty <= 1),
  distractor_word_ids uuid[] not null default '{}',
  selected_word_id uuid,
  typed_answer text,
  expected_answer text,
  error_type text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists learning_evidence_user_word_occurred_idx
  on learning_evidence (user_id, word_id, occurred_at);
create index if not exists learning_evidence_session_id_idx
  on learning_evidence (session_id);
create index if not exists learning_evidence_skill_idx
  on learning_evidence (skill);
create index if not exists learning_evidence_outcome_idx
  on learning_evidence (outcome);

-- Append-only invariant: refuse UPDATE/DELETE even before auth/RLS exists.
create or replace function prevent_learning_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'learning_evidence is append-only';
end;
$$;

drop trigger if exists learning_evidence_no_update on learning_evidence;
create trigger learning_evidence_no_update
  before update or delete on learning_evidence
  for each row
  execute procedure prevent_learning_evidence_mutation();

-- TODO(auth): when Supabase Auth is introduced, enable RLS and add
-- policies that let a student insert their own evidence and read their
-- own snapshots, while denying evidence updates. Do not open write
-- access with a permissive `true` policy in the meantime.
