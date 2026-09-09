-- Integration checks after the migration. Synthetic data, always rolled back.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception '%', message; end if; end; $$;

insert into auth.users(id, email) values
('e9892ea2-6818-46d0-8720-568a9f91c101', 'registration-test-admin@example.invalid'),
('e9892ea2-6818-46d0-8720-568a9f91c102', 'registration-test-teacher@example.invalid');
insert into public.profiles(id, role, username, name) values
('e9892ea2-6818-46d0-8720-568a9f91c101', 'teacher', 'registration-test-admin', 'Test administrator'),
('e9892ea2-6818-46d0-8720-568a9f91c102', 'teacher', 'registration-test-teacher', 'Test teacher');
insert into public.registration_administrators values ('e9892ea2-6818-46d0-8720-568a9f91c101');
insert into public.school_state(teacher_id, data) values
('e9892ea2-6818-46d0-8720-568a9f91c101', '{"classes":[{"id":"test-7","name":"7. test"},{"id":"test-8","name":"8. test"}],"users":[]}'),
('e9892ea2-6818-46d0-8720-568a9f91c102', '{"classes":[{"id":"other-class","name":"Other"}],"users":[]}');
update public.registration_settings set enabled = true where id;

-- Simulates native Auth insertion. Caller-supplied role/teacher are ignored.
insert into auth.users(id, email, raw_user_meta_data) values (
  'e9892ea2-6818-46d0-8720-568a9f91c103',
  encode(sha256(convert_to('test-søren-9', 'UTF8')), 'hex') || '@unicode.users.jacobmatematik.invalid',
  '{"registration_source":"self","username":" TEST-SØREN-9 ","role":"teacher","teacher_id":"e9892ea2-6818-46d0-8720-568a9f91c102"}'
);
select pg_temp.assert_true((select role = 'student' and teacher_id is null and self_registered and username = 'test-søren-9'
from public.profiles where id = 'e9892ea2-6818-46d0-8720-568a9f91c103'), 'Signup must ignore forged role and teacher');

-- Invalid mapping rolls back the Auth insertion as well as the profile.
do $$ begin
  begin
    insert into auth.users(id, email, raw_user_meta_data) values ('e9892ea2-6818-46d0-8720-568a9f91c104',
      'wrong@users.jacobmatematik.invalid', '{"registration_source":"self","username":"different-name"}');
    raise exception 'Invalid alias accepted';
  exception when others then
    if sqlerrm = 'Invalid alias accepted' then raise; end if;
  end;
end; $$;
select pg_temp.assert_true(not exists(select 1 from auth.users where id = 'e9892ea2-6818-46d0-8720-568a9f91c104'), 'No orphan Auth account');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.list_self_registered(text,integer)', 'execute'), 'Anon cannot list');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.assign_self_registered(uuid,text)', 'execute'), 'Anon cannot assign');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.registration_administrators', 'insert'), 'Cannot self-promote');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e9892ea2-6818-46d0-8720-568a9f91c103', true);
insert into public.results(id, student_id, data) values ('e9892ea2-6818-46d0-8720-568a9f91c105', 'e9892ea2-6818-46d0-8720-568a9f91c103', '{"topic":"addition","correct":true}');
select pg_temp.assert_true((select count(*) = 1 from public.results), 'Unassigned student can read and save own results');
select pg_temp.assert_true(not public.can_manage_self_registered(), 'Student is not an administrator');
do $$ begin
  begin
    perform public.list_self_registered();
    raise exception 'Student listed registry';
  exception when insufficient_privilege then null; end;
end; $$;

select set_config('request.jwt.claim.sub', 'e9892ea2-6818-46d0-8720-568a9f91c102', true);
select pg_temp.assert_true((select count(*) = 0 from public.results), 'Unrelated teacher cannot read results');
do $$ begin
  begin
    perform public.assign_self_registered('e9892ea2-6818-46d0-8720-568a9f91c103', 'other-class');
    raise exception 'Unapproved teacher claimed student';
  exception when insufficient_privilege then null; end;
end; $$;

select set_config('request.jwt.claim.sub', 'e9892ea2-6818-46d0-8720-568a9f91c101', true);
select pg_temp.assert_true((select count(*) = 0 from public.results), 'Administrator cannot read results before assignment');
select pg_temp.assert_true(jsonb_array_length(public.list_self_registered('test-søren-9')) = 1, 'Search lists unassigned user');
do $$ begin
  begin
    perform public.assign_self_registered('e9892ea2-6818-46d0-8720-568a9f91c103', 'other-class');
    raise exception 'Foreign class accepted';
  exception when others then
    if sqlerrm = 'Foreign class accepted' then raise; end if;
  end;
end; $$;
select public.assign_self_registered('e9892ea2-6818-46d0-8720-568a9f91c103', 'test-7');
select pg_temp.assert_true((select count(*) = 1 from public.results), 'Teacher sees pre-assignment results');
select public.assign_self_registered('e9892ea2-6818-46d0-8720-568a9f91c103', 'test-7');
select pg_temp.assert_true((select jsonb_array_length(data->'users') = 1 from public.school_state), 'Repeat assignment is idempotent');
select public.assign_self_registered('e9892ea2-6818-46d0-8720-568a9f91c103', 'test-8');
select pg_temp.assert_true(public.list_self_registered('test-søren-9')->0->>'class_id' = 'test-8', 'Move updates class');

-- An older browser's save cannot drop the assigned student.
update public.school_state set data = jsonb_set(data, '{users}', '[]') where teacher_id = 'e9892ea2-6818-46d0-8720-568a9f91c101';
select pg_temp.assert_true((select jsonb_array_length(data->'users') = 1 from public.school_state), 'Preserves concurrent assignment');
select set_config('request.jwt.claim.sub', 'e9892ea2-6818-46d0-8720-568a9f91c103', true);
select pg_temp.assert_true(public.get_my_student_state()->'users'->0->>'classId' = 'test-8', 'Student receives new class');
select pg_temp.assert_true((select count(*) = 1 from public.results), 'Results are preserved after move');
reset role;
rollback;
