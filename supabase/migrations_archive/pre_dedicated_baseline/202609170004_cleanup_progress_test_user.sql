-- Test/ops hygiene only. Application repositories remain append-only.
-- The learning_evidence trigger is unchanged; this function skips it for one
-- randomized test user inside a single transaction via replica role.

create or replace function cleanup_progress_test_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user is null then
    raise exception 'cleanup_progress_test_user requires target_user';
  end if;

  if target_user = '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'cleanup_progress_test_user refuses the V1 placeholder student user';
  end if;

  -- Transaction-local: skip append-only trigger without disabling it globally.
  perform set_config('session_replication_role', 'replica', true);

  delete from student_lexeme_weaknesses
    where student_lexeme_model_id in (
      select id from student_lexeme_models where user_id = target_user
    );

  delete from student_lexeme_skill_states
    where student_lexeme_model_id in (
      select id from student_lexeme_models where user_id = target_user
    );

  -- Evidence references learning_tasks; delete evidence first.
  delete from learning_evidence where user_id = target_user;

  delete from student_lexeme_models where user_id = target_user;
  delete from learning_tasks where user_id = target_user;
  delete from game_sessions where user_id = target_user;
end;
$$;

comment on function cleanup_progress_test_user(uuid) is
  'Deletes learner rows for one non-placeholder test user. Not an application API.';

revoke all on function cleanup_progress_test_user(uuid) from public;
revoke all on function cleanup_progress_test_user(uuid) from anon;
revoke all on function cleanup_progress_test_user(uuid) from authenticated;
grant execute on function cleanup_progress_test_user(uuid) to service_role;
