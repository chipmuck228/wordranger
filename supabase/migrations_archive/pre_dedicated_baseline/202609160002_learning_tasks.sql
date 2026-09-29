-- Phase 03 Learning Task Protocol + Phase 02.1 tag confidence checks.

alter table lexeme_tags
  add constraint lexeme_tags_topic_confidence_range
  check (
    topic_confidence is null
    or (topic_confidence >= 0 and topic_confidence <= 1)
  );

alter table lexeme_tags
  add constraint lexeme_tags_semantic_confidence_range
  check (
    semantic_confidence is null
    or (semantic_confidence >= 0 and semantic_confidence <= 1)
  );

alter table lexeme_tags
  add constraint lexeme_tags_game_confidence_range
  check (
    game_confidence is null
    or (game_confidence >= 0 and game_confidence <= 1)
  );

create table if not exists learning_tasks (
  id uuid primary key,
  user_id uuid,
  session_id uuid,
  learning_need_id text,
  lexeme_id uuid not null references lexemes (id),
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

create index if not exists learning_tasks_lexeme_id_idx
  on learning_tasks (lexeme_id);
create index if not exists learning_tasks_user_id_idx
  on learning_tasks (user_id);

alter table learning_evidence
  add column if not exists task_id uuid references learning_tasks (id);

create unique index if not exists learning_evidence_task_id_uidx
  on learning_evidence (task_id)
  where task_id is not null;
