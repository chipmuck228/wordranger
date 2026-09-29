-- Experimental Candidate V0 batch promotion records.
-- Fingerprint-bound CAS only. Not a release, active pointer, Evidence, or /train row.
-- Candidate / Experimental / Not a Standard.

create table if not exists contextual_content_batch_promotions (
  scene_id text not null,
  pack_id text not null,
  schema_version text not null,
  revision bigint not null,
  pack_fingerprint text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scene_id, pack_id),
  constraint contextual_content_batch_promotions_revision_positive
    check (revision >= 1),
  constraint contextual_content_batch_promotions_schema_version_known
    check (schema_version = 'candidate-v0'),
  constraint contextual_content_batch_promotions_no_learning_state
    check (
      not (record ? 'answerKey')
      and not (record ? 'LearningEvidence')
      and not (record ? 'StudentLexemeModel')
      and not (record ? 'score')
      and not (record ? 'mastery')
    ),
  constraint contextual_content_batch_promotions_row_record_parity
    check (
      scene_id is not distinct from record->>'sceneId'
      and pack_id is not distinct from record->>'packId'
      and schema_version is not distinct from record->>'schemaVersion'
      and revision is not distinct from (record->>'revision')::bigint
      and pack_fingerprint is not distinct from record->>'packFingerprint'
      and record->>'kind' = 'CONTEXTUAL_CONTENT_BATCH_PROMOTION'
      and record->>'decision' = 'PROMOTED'
    )
);

comment on table contextual_content_batch_promotions is
  'Experimental Candidate V0 batch promotions. One effective row per scene+pack. Not a release or active pointer.';

alter table contextual_content_batch_promotions enable row level security;

revoke all on table contextual_content_batch_promotions from public;
revoke all on table contextual_content_batch_promotions from anon;
revoke all on table contextual_content_batch_promotions from authenticated;
grant select, insert, update, delete on table contextual_content_batch_promotions to service_role;

create or replace function promote_contextual_content_batch(
  p_scene_id text,
  p_pack_id text,
  p_expected_revision bigint,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row contextual_content_batch_promotions%rowtype;
  next_revision bigint;
  final_record jsonb;
  idempotent boolean := false;
begin
  if p_record ? 'answerKey'
     or p_record ? 'LearningEvidence'
     or p_record ? 'StudentLexemeModel'
     or coalesce(p_record->>'kind', '') <> 'CONTEXTUAL_CONTENT_BATCH_PROMOTION'
     or coalesce(p_record->>'decision', '') <> 'PROMOTED'
     or coalesce(p_record->>'sceneId', '') <> p_scene_id
     or coalesce(p_record->>'packId', '') <> p_pack_id
     or coalesce(p_record->>'schemaVersion', '') <> 'candidate-v0'
     or coalesce(p_record->>'packFingerprint', '') = ''
  then
    raise exception 'PROMOTION_INVALID';
  end if;

  select * into current_row
  from contextual_content_batch_promotions
  where scene_id = p_scene_id and pack_id = p_pack_id
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'PROMOTION_STALE';
    end if;
    next_revision := 1;
    final_record := jsonb_set(p_record, '{revision}', to_jsonb(next_revision), true);
    insert into contextual_content_batch_promotions (
      scene_id,
      pack_id,
      schema_version,
      revision,
      pack_fingerprint,
      record
    ) values (
      p_scene_id,
      p_pack_id,
      'candidate-v0',
      next_revision,
      final_record->>'packFingerprint',
      final_record
    );
    return jsonb_build_object('record', final_record, 'idempotent', false);
  end if;

  if current_row.pack_fingerprint is not distinct from p_record->>'packFingerprint'
     and current_row.record->>'lineageFingerprint' is not distinct from p_record->>'lineageFingerprint'
     and current_row.record->'targetApprovalBindings' is not distinct from p_record->'targetApprovalBindings'
  then
    return jsonb_build_object('record', current_row.record, 'idempotent', true);
  end if;

  if current_row.revision is distinct from p_expected_revision then
    raise exception 'PROMOTION_CONFLICT';
  end if;

  next_revision := current_row.revision + 1;
  final_record := jsonb_set(p_record, '{revision}', to_jsonb(next_revision), true);
  update contextual_content_batch_promotions
  set
    schema_version = 'candidate-v0',
    revision = next_revision,
    pack_fingerprint = final_record->>'packFingerprint',
    record = final_record,
    updated_at = now()
  where scene_id = p_scene_id and pack_id = p_pack_id;

  return jsonb_build_object('record', final_record, 'idempotent', false);
end;
$$;

revoke all on function promote_contextual_content_batch(text, text, bigint, jsonb) from public;
revoke all on function promote_contextual_content_batch(text, text, bigint, jsonb) from anon;
revoke all on function promote_contextual_content_batch(text, text, bigint, jsonb) from authenticated;
grant execute on function promote_contextual_content_batch(text, text, bigint, jsonb) to service_role;
