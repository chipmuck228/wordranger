-- Experimental Candidate V0 Context Lab orchestration.
-- Not a learning table. Not Evidence, mastery, or AnswerKey storage.
-- Candidate / Experimental / Not a Standard.

create table if not exists context_lab_runs (
  id uuid primary key,
  user_id uuid not null,
  schema_version text not null,
  experience_id text not null,
  run_state jsonb not null,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint context_lab_runs_revision_nonnegative
    check (revision >= 0),
  constraint context_lab_runs_schema_version_known
    check (schema_version = 'candidate-v0')
);

create index if not exists context_lab_runs_user_id_idx
  on context_lab_runs (user_id);

create index if not exists context_lab_runs_id_user_id_idx
  on context_lab_runs (id, user_id);

comment on table context_lab_runs is
  'Experimental Candidate V0 Context Lab orchestration. Not learning truth. Abandoned runs are a later cleanup concern.';

comment on column context_lab_runs.revision is
  'Optimistic concurrency token. Not JSON schema version and not scheduler policy version.';

comment on column context_lab_runs.run_state is
  'Candidate ExperienceRun orchestration JSON. Must not contain AnswerKey, Evidence, or learner-state fields.';

alter table context_lab_runs enable row level security;

revoke all on table context_lab_runs from public;
revoke all on table context_lab_runs from anon;
revoke all on table context_lab_runs from authenticated;
grant select, insert, update on table context_lab_runs to service_role;
