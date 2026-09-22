-- Experimental Candidate V0 content release Phase 2.
-- Atomic publish + independent active-release pointer.
-- Not Evidence, mastery, AnswerKey, or /train storage.
-- Candidate / Experimental / Not a Standard.
-- This file is committed only. Do not apply it to a remote database in this task.

alter table contextual_content_releases
  add column if not exists published_at timestamptz,
  add column if not exists published_by text,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_release_id text;

comment on column contextual_content_releases.published_at is
  'Lifecycle metadata only. Snapshot content remains immutable after publish.';

create table if not exists contextual_content_active_release_pointers (
  scene_id text primary key,
  schema_version text not null,
  release_id text not null,
  release_fingerprint text not null,
  revision bigint not null default 0,
  activated_at timestamptz not null default now(),
  activated_by text not null,
  constraint contextual_content_active_release_pointers_revision_nonnegative
    check (revision >= 0),
  constraint contextual_content_active_release_pointers_schema_version_known
    check (schema_version = 'candidate-v0'),
  constraint contextual_content_active_release_pointers_release_fk
    foreign key (release_id) references contextual_content_releases (release_id)
);

comment on table contextual_content_active_release_pointers is
  'Independent experimental active-release pointer. One row per scene. Not a release status.';

alter table contextual_content_active_release_pointers enable row level security;

revoke all on table contextual_content_active_release_pointers from public;
revoke all on table contextual_content_active_release_pointers from anon;
revoke all on table contextual_content_active_release_pointers from authenticated;
grant select, insert, update, delete on table contextual_content_active_release_pointers to service_role;

create or replace function publish_contextual_content_release(
  p_release_id text,
  p_expected_revision bigint,
  p_published_manifest jsonb,
  p_pointer jsonb,
  p_expected_pointer_revision bigint,
  p_supersede_release_id text default null,
  p_supersede_expected_revision bigint default null,
  p_supersede_manifest jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row contextual_content_releases%rowtype;
  pointer_row contextual_content_active_release_pointers%rowtype;
  next_pointer_revision bigint;
begin
  if current_setting('role', true) is distinct from 'service_role'
     and current_user is distinct from 'service_role' then
    raise exception 'service_role required';
  end if;

  select * into current_row
  from contextual_content_releases
  where release_id = p_release_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_FOUND');
  end if;

  select * into pointer_row
  from contextual_content_active_release_pointers
  where scene_id = p_pointer->>'sceneId'
  for update;

  if current_row.status = 'PUBLISHED'
     and found
     and pointer_row.release_id = p_release_id
     and pointer_row.release_fingerprint = current_row.manifest->>'releaseFingerprint' then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  if current_row.revision is distinct from p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_CONFLICT');
  end if;

  if current_row.status is distinct from 'PREFLIGHT_VALIDATED' then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
  end if;

  if found then
    if pointer_row.revision is distinct from p_expected_pointer_revision then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_CONFLICT');
    end if;
    next_pointer_revision := pointer_row.revision + 1;
  else
    if p_expected_pointer_revision is not null then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_CONFLICT');
    end if;
    next_pointer_revision := 0;
  end if;

  if p_supersede_release_id is not null then
    update contextual_content_releases
    set
      status = 'SUPERSEDED',
      revision = p_supersede_expected_revision + 1,
      manifest = p_supersede_manifest,
      superseded_at = (p_supersede_manifest->>'supersededAt')::timestamptz,
      superseded_by_release_id = p_release_id,
      updated_at = now()
    where release_id = p_supersede_release_id
      and revision = p_supersede_expected_revision;
    if not found then
      raise exception 'supersede conflict';
    end if;
  end if;

  update contextual_content_releases
  set
    status = 'PUBLISHED',
    revision = p_expected_revision + 1,
    manifest = p_published_manifest,
    published_at = (p_published_manifest->>'publishedAt')::timestamptz,
    published_by = p_published_manifest->>'publishedBy',
    updated_at = now()
  where release_id = p_release_id
    and revision = p_expected_revision;
  if not found then
    raise exception 'publish conflict';
  end if;

  insert into contextual_content_active_release_pointers (
    scene_id,
    schema_version,
    release_id,
    release_fingerprint,
    revision,
    activated_at,
    activated_by
  ) values (
    p_pointer->>'sceneId',
    'candidate-v0',
    p_release_id,
    p_pointer->>'releaseFingerprint',
    next_pointer_revision,
    (p_pointer->>'activatedAt')::timestamptz,
    p_pointer->>'activatedBy'
  )
  on conflict (scene_id) do update
  set
    release_id = excluded.release_id,
    release_fingerprint = excluded.release_fingerprint,
    revision = excluded.revision,
    activated_at = excluded.activated_at,
    activated_by = excluded.activated_by;

  return jsonb_build_object('ok', true, 'idempotent', false);
end;
$$;

create or replace function rollback_contextual_content_active_release(
  p_scene_id text,
  p_expected_pointer_revision bigint,
  p_target_release_id text,
  p_pointer jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pointer_row contextual_content_active_release_pointers%rowtype;
  target_row contextual_content_releases%rowtype;
begin
  if current_setting('role', true) is distinct from 'service_role'
     and current_user is distinct from 'service_role' then
    raise exception 'service_role required';
  end if;

  select * into pointer_row
  from contextual_content_active_release_pointers
  where scene_id = p_scene_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_FOUND');
  end if;

  select * into target_row
  from contextual_content_releases
  where release_id = p_target_release_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_FOUND');
  end if;

  if pointer_row.release_id = p_target_release_id
     and pointer_row.release_fingerprint = target_row.manifest->>'releaseFingerprint' then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  if pointer_row.revision is distinct from p_expected_pointer_revision then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_CONFLICT');
  end if;

  if target_row.status not in ('PUBLISHED', 'SUPERSEDED')
     or target_row.published_at is null
     or target_row.scene_id is distinct from p_scene_id then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_PUBLISHED');
  end if;

  if target_row.status = 'SUPERSEDED' then
    update contextual_content_releases
    set
      status = 'PUBLISHED',
      revision = target_row.revision + 1,
      updated_at = now()
    where release_id = p_target_release_id;
  end if;

  update contextual_content_active_release_pointers
  set
    release_id = p_target_release_id,
    release_fingerprint = p_pointer->>'releaseFingerprint',
    revision = p_expected_pointer_revision + 1,
    activated_at = (p_pointer->>'activatedAt')::timestamptz,
    activated_by = p_pointer->>'activatedBy'
  where scene_id = p_scene_id
    and revision = p_expected_pointer_revision;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_CONFLICT');
  end if;

  return jsonb_build_object('ok', true, 'idempotent', false);
end;
$$;

revoke all on function publish_contextual_content_release(
  text, bigint, jsonb, jsonb, bigint, text, bigint, jsonb
) from public, anon, authenticated;
revoke all on function rollback_contextual_content_active_release(
  text, bigint, text, jsonb
) from public, anon, authenticated;
grant execute on function publish_contextual_content_release(
  text, bigint, jsonb, jsonb, bigint, text, bigint, jsonb
) to service_role;
grant execute on function rollback_contextual_content_active_release(
  text, bigint, text, jsonb
) to service_role;
