-- Experimental Candidate V0 content release records.
-- Phase 1 dry-run / validation only. Not an active runtime pointer.
-- Not Evidence, mastery, AnswerKey, or /train storage.
-- Candidate / Experimental / Not a Standard.

create table if not exists contextual_content_releases (
  release_id text primary key,
  user_id uuid not null,
  schema_version text not null,
  scene_id text not null,
  status text not null,
  revision bigint not null default 0,
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contextual_content_releases_revision_nonnegative
    check (revision >= 0),
  constraint contextual_content_releases_schema_version_known
    check (schema_version = 'candidate-v0'),
  constraint contextual_content_releases_status_known
    check (status in (
      'DRAFT',
      'PREFLIGHT_VALIDATED',
      'PUBLISHED',
      'SUPERSEDED',
      'ROLLED_BACK'
    )),
  constraint contextual_content_releases_no_answer_key
    check (
      not (manifest ? 'answerKey')
      and not (manifest ? 'LearningEvidence')
      and not (manifest ? 'StudentLexemeModel')
    )
);

create index if not exists contextual_content_releases_user_id_idx
  on contextual_content_releases (user_id);

comment on table contextual_content_releases is
  'Experimental Candidate V0 content release manifests. Phase 1 stores drafts and preflight results only. Not an active runtime pointer.';

comment on column contextual_content_releases.revision is
  'Optimistic concurrency token. Not JSON schema version.';

comment on column contextual_content_releases.manifest is
  'Immutable release snapshot JSON. Must not contain AnswerKey, Evidence, or learner-state fields.';

alter table contextual_content_releases enable row level security;

revoke all on table contextual_content_releases from public;
revoke all on table contextual_content_releases from anon;
revoke all on table contextual_content_releases from authenticated;
grant select, insert, update, delete on table contextual_content_releases to service_role;
