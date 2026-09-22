-- Experimental Candidate V0 content release Phase 2.
-- Atomic publish + independent active-release pointer.
-- Not Evidence, mastery, AnswerKey, or /train storage.
-- Candidate / Experimental / Not a Standard.
-- This file is committed only. Do not apply it to a remote database in this task.
--
-- Persistence invariant for contextual_content_releases:
-- After every committed write, indexed columns MUST equal the same fields
-- inside manifest JSON. Manifest is the full domain snapshot. Columns are
-- constrained index/CAS copies. The write transaction constructs the final
-- manifest.status/revision (and lifecycle timestamps) in the database.
-- Memory and File adapters must expose the same observable semantics.

alter table contextual_content_releases
  add column if not exists published_at timestamptz,
  add column if not exists published_by text,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_release_id text;

comment on column contextual_content_releases.published_at is
  'Lifecycle metadata only. Snapshot content remains immutable after publish.';

comment on column contextual_content_releases.manifest is
  'Full domain snapshot. After every write, manifest.status/revision/identity/lifecycle fields must equal the indexed row columns.';

alter table contextual_content_releases
  drop constraint if exists contextual_content_releases_row_manifest_parity;

alter table contextual_content_releases
  add constraint contextual_content_releases_row_manifest_parity
  check (
    release_id is not distinct from manifest->>'releaseId'
    and scene_id is not distinct from manifest->>'sceneId'
    and status is not distinct from manifest->>'status'
    and revision is not distinct from (manifest->>'revision')::bigint
    and schema_version is not distinct from manifest->>'schemaVersion'
    and published_at is not distinct from (nullif(manifest->>'publishedAt', ''))::timestamptz
    and published_by is not distinct from nullif(manifest->>'publishedBy', '')
    and superseded_at is not distinct from (nullif(manifest->>'supersededAt', ''))::timestamptz
    and superseded_by_release_id is not distinct from nullif(manifest->>'supersededByReleaseId', '')
  );

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
  'Independent experimental active-release pointer. One row per scene. Not a release status. ACTIVE is never a manifest.status.';

alter table contextual_content_active_release_pointers enable row level security;

revoke all on table contextual_content_active_release_pointers from public;
revoke all on table contextual_content_active_release_pointers from anon;
revoke all on table contextual_content_active_release_pointers from authenticated;
grant select, insert, update, delete on table contextual_content_active_release_pointers to service_role;

create or replace function contextual_content_release_row_manifest_consistent(
  r contextual_content_releases
)
returns boolean
language sql
immutable
as $$
  select
    r.release_id is not distinct from r.manifest->>'releaseId'
    and r.scene_id is not distinct from r.manifest->>'sceneId'
    and r.status is not distinct from r.manifest->>'status'
    and r.revision is not distinct from (r.manifest->>'revision')::bigint
    and r.schema_version is not distinct from r.manifest->>'schemaVersion'
    and r.published_at is not distinct from (nullif(r.manifest->>'publishedAt', ''))::timestamptz
    and r.published_by is not distinct from nullif(r.manifest->>'publishedBy', '')
    and r.superseded_at is not distinct from (nullif(r.manifest->>'supersededAt', ''))::timestamptz
    and r.superseded_by_release_id is not distinct from nullif(r.manifest->>'supersededByReleaseId', '');
$$;

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
  supersede_row contextual_content_releases%rowtype;
  pointer_row contextual_content_active_release_pointers%rowtype;
  pointer_found boolean := false;
  next_revision bigint;
  next_pointer_revision bigint;
  next_supersede_revision bigint;
  final_manifest jsonb;
  supersede_manifest jsonb;
  published_at_text text;
  published_by_text text;
  superseded_at_text text;
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

  if not contextual_content_release_row_manifest_consistent(current_row) then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_RUNTIME_INVALID');
  end if;

  select * into pointer_row
  from contextual_content_active_release_pointers
  where scene_id = coalesce(p_pointer->>'sceneId', current_row.scene_id)
  for update;
  pointer_found := found;

  if current_row.status = 'PUBLISHED'
     and pointer_found
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

  if p_published_manifest is null
     or p_published_manifest->>'releaseId' is distinct from p_release_id
     or p_published_manifest->>'releaseId' is distinct from current_row.release_id
     or p_published_manifest->>'sceneId' is distinct from current_row.scene_id
     or p_published_manifest->>'schemaVersion' is distinct from current_row.schema_version
     or p_published_manifest->>'releaseFingerprint' is distinct from current_row.manifest->>'releaseFingerprint'
     or p_published_manifest->>'packFingerprint' is distinct from current_row.manifest->>'packFingerprint'
     or p_published_manifest->>'contextModelFingerprint' is distinct from current_row.manifest->>'contextModelFingerprint'
     or p_published_manifest->>'status' is distinct from 'PUBLISHED' then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
  end if;

  if p_pointer is null
     or p_pointer->>'sceneId' is distinct from current_row.scene_id
     or p_pointer->>'releaseId' is distinct from current_row.release_id
     or p_pointer->>'releaseFingerprint' is distinct from current_row.manifest->>'releaseFingerprint' then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
  end if;

  if pointer_found then
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

  published_at_text := p_published_manifest->>'publishedAt';
  published_by_text := p_published_manifest->>'publishedBy';
  if published_at_text is null or published_at_text = ''
     or published_by_text is null or published_by_text = '' then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
  end if;

  next_revision := current_row.revision + 1;
  final_manifest := current_row.manifest;
  final_manifest := jsonb_set(final_manifest, '{status}', to_jsonb('PUBLISHED'::text), true);
  final_manifest := jsonb_set(final_manifest, '{revision}', to_jsonb(next_revision), true);
  final_manifest := jsonb_set(final_manifest, '{publishedAt}', to_jsonb(published_at_text), true);
  final_manifest := jsonb_set(final_manifest, '{publishedBy}', to_jsonb(published_by_text), true);

  if final_manifest->>'releaseFingerprint' is distinct from p_pointer->>'releaseFingerprint'
     or final_manifest->>'releaseId' is distinct from p_pointer->>'releaseId'
     or final_manifest->>'sceneId' is distinct from p_pointer->>'sceneId' then
    raise exception 'pointer fingerprint mismatch';
  end if;

  if p_supersede_release_id is not null then
    select * into supersede_row
    from contextual_content_releases
    where release_id = p_supersede_release_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_FOUND');
    end if;
    if not contextual_content_release_row_manifest_consistent(supersede_row) then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_RUNTIME_INVALID');
    end if;
    if supersede_row.revision is distinct from p_supersede_expected_revision
       or supersede_row.scene_id is distinct from current_row.scene_id then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_CONFLICT');
    end if;
    if p_supersede_manifest is not null
       and (
         p_supersede_manifest->>'releaseId' is distinct from supersede_row.release_id
         or p_supersede_manifest->>'sceneId' is distinct from supersede_row.scene_id
         or p_supersede_manifest->>'releaseFingerprint' is distinct from supersede_row.manifest->>'releaseFingerprint'
       ) then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
    end if;
    superseded_at_text := coalesce(p_supersede_manifest->>'supersededAt', published_at_text);
    next_supersede_revision := supersede_row.revision + 1;
    supersede_manifest := supersede_row.manifest;
    supersede_manifest := jsonb_set(supersede_manifest, '{status}', to_jsonb('SUPERSEDED'::text), true);
    supersede_manifest := jsonb_set(supersede_manifest, '{revision}', to_jsonb(next_supersede_revision), true);
    supersede_manifest := jsonb_set(supersede_manifest, '{supersededAt}', to_jsonb(superseded_at_text), true);
    supersede_manifest := jsonb_set(supersede_manifest, '{supersededByReleaseId}', to_jsonb(p_release_id), true);
    update contextual_content_releases
    set
      status = 'SUPERSEDED',
      revision = next_supersede_revision,
      manifest = supersede_manifest,
      superseded_at = superseded_at_text::timestamptz,
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
    revision = next_revision,
    manifest = final_manifest,
    published_at = published_at_text::timestamptz,
    published_by = published_by_text,
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
    final_manifest->>'releaseFingerprint',
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
  outgoing_row contextual_content_releases%rowtype;
  restored_manifest jsonb;
  outgoing_manifest jsonb;
  next_target_revision bigint;
  next_outgoing_revision bigint;
  activated_at_text text;
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

  if not contextual_content_release_row_manifest_consistent(target_row) then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_RUNTIME_INVALID');
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

  if p_pointer is null
     or p_pointer->>'sceneId' is distinct from p_scene_id
     or p_pointer->>'releaseId' is distinct from p_target_release_id
     or p_pointer->>'releaseFingerprint' is distinct from target_row.manifest->>'releaseFingerprint' then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
  end if;

  activated_at_text := p_pointer->>'activatedAt';
  if activated_at_text is null or activated_at_text = '' then
    return jsonb_build_object('ok', false, 'code', 'RELEASE_INVALID');
  end if;

  if pointer_row.release_id is distinct from p_target_release_id then
    select * into outgoing_row
    from contextual_content_releases
    where release_id = pointer_row.release_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_FOUND');
    end if;
    if not contextual_content_release_row_manifest_consistent(outgoing_row) then
      return jsonb_build_object('ok', false, 'code', 'RELEASE_RUNTIME_INVALID');
    end if;
    next_outgoing_revision := outgoing_row.revision + 1;
    outgoing_manifest := outgoing_row.manifest;
    outgoing_manifest := jsonb_set(outgoing_manifest, '{status}', to_jsonb('SUPERSEDED'::text), true);
    outgoing_manifest := jsonb_set(outgoing_manifest, '{revision}', to_jsonb(next_outgoing_revision), true);
    outgoing_manifest := jsonb_set(outgoing_manifest, '{supersededAt}', to_jsonb(activated_at_text), true);
    outgoing_manifest := jsonb_set(outgoing_manifest, '{supersededByReleaseId}', to_jsonb(p_target_release_id), true);
    update contextual_content_releases
    set
      status = 'SUPERSEDED',
      revision = next_outgoing_revision,
      manifest = outgoing_manifest,
      superseded_at = activated_at_text::timestamptz,
      superseded_by_release_id = p_target_release_id,
      updated_at = now()
    where release_id = outgoing_row.release_id
      and revision = outgoing_row.revision;
    if not found then
      raise exception 'rollback outgoing conflict';
    end if;
  end if;

  next_target_revision := target_row.revision + 1;
  restored_manifest := target_row.manifest;
  restored_manifest := jsonb_set(restored_manifest, '{status}', to_jsonb('PUBLISHED'::text), true);
  restored_manifest := jsonb_set(restored_manifest, '{revision}', to_jsonb(next_target_revision), true);
  restored_manifest := jsonb_set(restored_manifest, '{supersededAt}', 'null'::jsonb, true);
  restored_manifest := jsonb_set(restored_manifest, '{supersededByReleaseId}', 'null'::jsonb, true);

  update contextual_content_releases
  set
    status = 'PUBLISHED',
    revision = next_target_revision,
    manifest = restored_manifest,
    superseded_at = null,
    superseded_by_release_id = null,
    updated_at = now()
  where release_id = p_target_release_id
    and revision = target_row.revision;
  if not found then
    raise exception 'rollback target conflict';
  end if;

  update contextual_content_active_release_pointers
  set
    release_id = p_target_release_id,
    release_fingerprint = target_row.manifest->>'releaseFingerprint',
    revision = p_expected_pointer_revision + 1,
    activated_at = activated_at_text::timestamptz,
    activated_by = p_pointer->>'activatedBy'
  where scene_id = p_scene_id
    and revision = p_expected_pointer_revision;
  if not found then
    raise exception 'rollback pointer conflict';
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
grant execute on function contextual_content_release_row_manifest_consistent(
  contextual_content_releases
) to service_role;
