-- Dedicated WordRanger consolidated production baseline V0.
-- Apply once to a truly empty database. This is not a replay of
-- Blaze history and does not insert learner or vocabulary rows.

create extension if not exists pgcrypto;

create table public.vocabulary_source_entries (
  id uuid primary key,
  canonical_key text not null unique,
  source_index integer not null unique,
  section text,
  source_page_start integer,
  source_page_end integer,
  source_word_raw text not null,
  starred boolean not null default false,
  source_ipa_raw text,
  source_pos_raw text,
  source_meaning_raw text not null default '',
  raw_entry text,
  parse_status text,
  parse_issues jsonb not null default '[]'::jsonb,
  source_review_note text,
  created_at timestamptz not null default now()
);

create table public.lexemes (
  id uuid primary key,
  canonical_key text not null unique,
  source_entry_id uuid not null references public.vocabulary_source_entries (id),
  source_index integer not null,
  lemma text not null,
  display text not null,
  role text not null,
  starred boolean not null,
  parts_of_speech text[] not null,
  ipa text[] not null,
  meanings_zh jsonb not null,
  forms text[] not null,
  variants text[] not null,
  abbreviation_of_lexeme_id uuid references public.lexemes (id),
  quality_status text not null,
  quality_issues jsonb not null default '[]'::jsonb,
  correction_applied boolean not null default false,
  correction_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lexemes_lemma_idx on public.lexemes (lemma);
create index lexemes_source_entry_id_idx on public.lexemes (source_entry_id);
create index lexemes_source_index_idx on public.lexemes (source_index);

create table public.lexeme_relations (
  id uuid primary key,
  canonical_key text unique,
  type text not null,
  from_lexeme_id uuid not null references public.lexemes (id),
  to_lexeme_id uuid not null references public.lexemes (id),
  is_symmetric boolean not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  provenance text not null,
  note text,
  created_at timestamptz not null default now(),
  check (from_lexeme_id <> to_lexeme_id),
  unique (type, from_lexeme_id, to_lexeme_id, provenance)
);

create table public.lexeme_tags (
  lexeme_id uuid primary key references public.lexemes (id),
  topics text[] not null,
  semantic_categories text[] not null,
  game_tags text[] not null,
  topic_confidence numeric,
  semantic_confidence numeric,
  game_confidence numeric,
  constraint lexeme_tags_topic_confidence_range check (
    topic_confidence is null
    or (topic_confidence >= 0 and topic_confidence <= 1)
  ),
  constraint lexeme_tags_semantic_confidence_range check (
    semantic_confidence is null
    or (semantic_confidence >= 0 and semantic_confidence <= 1)
  ),
  constraint lexeme_tags_game_confidence_range check (
    game_confidence is null
    or (game_confidence >= 0 and game_confidence <= 1)
  )
);

create table public.student_lexeme_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lexeme_id uuid not null references public.lexemes (id),
  policy_version text not null,
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
  unique (user_id, lexeme_id)
);

create index student_lexeme_models_user_id_idx
  on public.student_lexeme_models (user_id);
create index student_lexeme_models_lexeme_id_idx
  on public.student_lexeme_models (lexeme_id);
create index student_lexeme_models_next_review_at_idx
  on public.student_lexeme_models (next_review_at);
create index student_lexeme_models_mastery_stage_idx
  on public.student_lexeme_models (mastery_stage);

create table public.student_lexeme_skill_states (
  id uuid primary key default gen_random_uuid(),
  student_lexeme_model_id uuid not null references public.student_lexeme_models (id) on delete cascade,
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
  unique (student_lexeme_model_id, skill)
);

create table public.student_lexeme_weaknesses (
  id uuid primary key default gen_random_uuid(),
  student_lexeme_model_id uuid not null references public.student_lexeme_models (id) on delete cascade,
  type text not null,
  skill text,
  severity numeric not null check (severity >= 0 and severity <= 1),
  related_lexeme_id uuid references public.lexemes (id),
  reason jsonb not null,
  detected_at timestamptz not null,
  last_triggered_at timestamptz not null,
  resolved_at timestamptz
);

create index student_lexeme_weaknesses_model_idx
  on public.student_lexeme_weaknesses (student_lexeme_model_id);

create table public.learning_tasks (
  id uuid primary key,
  user_id uuid,
  session_id uuid,
  learning_need_id text,
  lexeme_id uuid not null references public.lexemes (id),
  target_skill text not null,
  task_type text not null,
  protocol_version text not null,
  generator_version text not null,
  prompt_mode text not null,
  answer_mode text not null,
  difficulty numeric not null check (difficulty >= 0 and difficulty <= 1),
  public_payload jsonb not null,
  answer_key jsonb not null,
  generation_trace jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index learning_tasks_lexeme_id_idx
  on public.learning_tasks (lexeme_id);
create index learning_tasks_user_id_idx
  on public.learning_tasks (user_id);

create table public.game_sessions (
  id uuid primary key,
  user_id uuid not null,
  game_type text not null,
  plan_id text not null,
  status text not null
    check (status in ('active', 'completed', 'failed')),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 0,
  constraint game_sessions_revision_nonnegative check (revision >= 0)
);

create index game_sessions_user_id_idx
  on public.game_sessions (user_id);
create index game_sessions_game_type_idx
  on public.game_sessions (game_type);
create index game_sessions_updated_at_idx
  on public.game_sessions (updated_at);

comment on table public.game_sessions is
  'Orchestration state for a student game session. Not learning truth.';
comment on column public.game_sessions.revision is
  'Optimistic concurrency token. Not JSON schema version and not scheduler policy version.';

create table public.learning_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lexeme_id uuid not null references public.lexemes (id),
  session_id uuid,
  game_id text,
  task_type text,
  skill text not null,
  prompt_mode text not null,
  answer_mode text not null,
  outcome text not null check (
    outcome in (
      'INDEPENDENT_CORRECT',
      'ASSISTED_CORRECT',
      'INCORRECT',
      'SKIPPED',
      'TIMEOUT'
    )
  ),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  hint_count integer not null default 0 check (hint_count >= 0),
  difficulty numeric not null check (difficulty >= 0 and difficulty <= 1),
  distractor_lexeme_ids uuid[] not null default '{}',
  selected_lexeme_id uuid references public.lexemes (id),
  typed_answer text,
  expected_answer text,
  error_type text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  task_id uuid references public.learning_tasks (id),
  check (
    (outcome <> 'INDEPENDENT_CORRECT' or hint_count = 0)
    and (outcome <> 'ASSISTED_CORRECT' or hint_count > 0)
  )
);

create index learning_evidence_user_lexeme_occurred_idx
  on public.learning_evidence (user_id, lexeme_id, occurred_at);
create index learning_evidence_session_id_idx
  on public.learning_evidence (session_id);
create index learning_evidence_skill_idx
  on public.learning_evidence (skill);
create index learning_evidence_outcome_idx
  on public.learning_evidence (outcome);
create unique index learning_evidence_task_id_uidx
  on public.learning_evidence (task_id)
  where task_id is not null;

comment on column public.learning_evidence.session_id is
  'Optional session correlation. Game renderers use game_sessions.id. Not a learning-sessions ownership FK.';

create or replace function public.prevent_learning_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'learning_evidence is append-only';
end;
$$;

create trigger learning_evidence_no_update
  before update or delete on public.learning_evidence
  for each row
  execute procedure public.prevent_learning_evidence_mutation();

-- Vocabulary tables are server/admin importer + service-role runtime
-- reference data. Student /train and free-play still read the bundled
-- dataset. No client RLS policies. Dedicated does not rely on a fresh
-- Supabase project starting with no service_role table grants. Each
-- vocabulary table first revokes ALL from PUBLIC, anon, authenticated,
-- and service_role (clearing default/existing ALL, including DELETE),
-- then grants only SELECT, INSERT, UPDATE. DELETE, TRUNCATE,
-- REFERENCES, and TRIGGER are not granted. The importer does not need
-- DELETE. V0 remains empty-target seed plus deterministic upsert, not
-- stale-row reconciliation.
grant usage on schema public to service_role;
grant usage on schema public to anon;
grant usage on schema public to authenticated;

revoke all on table public.vocabulary_source_entries from public;
revoke all on table public.vocabulary_source_entries from anon;
revoke all on table public.vocabulary_source_entries from authenticated;
revoke all on table public.vocabulary_source_entries from service_role;
grant select, insert, update on table public.vocabulary_source_entries to service_role;

revoke all on table public.lexemes from public;
revoke all on table public.lexemes from anon;
revoke all on table public.lexemes from authenticated;
revoke all on table public.lexemes from service_role;
grant select, insert, update on table public.lexemes to service_role;

revoke all on table public.lexeme_relations from public;
revoke all on table public.lexeme_relations from anon;
revoke all on table public.lexeme_relations from authenticated;
revoke all on table public.lexeme_relations from service_role;
grant select, insert, update on table public.lexeme_relations to service_role;

revoke all on table public.lexeme_tags from public;
revoke all on table public.lexeme_tags from anon;
revoke all on table public.lexeme_tags from authenticated;
revoke all on table public.lexeme_tags from service_role;
grant select, insert, update on table public.lexeme_tags to service_role;

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
