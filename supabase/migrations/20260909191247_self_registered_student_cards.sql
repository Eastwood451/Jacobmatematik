-- Give self-registered students the existing teacher backend, without choosing a class.
begin;

alter table public.registration_settings add column if not exists teacher_id uuid
  references public.registration_administrators(teacher_id) on delete set null;
-- Operator-owned configuration: signup metadata cannot choose the administrator.
update public.registration_settings s set teacher_id = p.id
from public.profiles p join public.registration_administrators a on a.teacher_id = p.id
where s.id and s.teacher_id is null and p.role = 'teacher' and lower(p.username) = 'jacob';

do $$ begin
  if not exists(select 1 from public.registration_settings r join public.school_state s on s.teacher_id=r.teacher_id where r.id) then
    raise exception 'Configure registration_settings.teacher_id with a registration administrator who has a school_state row.';
  end if;
end $$;

-- Preserve the account IDs and results of existing users such as Testkaj.
update public.profiles p set teacher_id = s.teacher_id
from public.registration_settings s
where s.id and p.role = 'student' and p.self_registered and p.teacher_id is null;

update public.school_state s
set data = jsonb_set(s.data, '{users}', coalesce(s.data->'users', '[]'::jsonb) || coalesce((
  select jsonb_agg(jsonb_build_object('id',p.id,'role',p.role,'username',p.username,
    'name',p.name,'classId',null,'selfRegistered',true) order by p.created_at,p.id)
  from public.profiles p
  where p.teacher_id=s.teacher_id and p.self_registered and not exists (
    select 1 from jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) u where u->>'id'=p.id::text
  )
), '[]'::jsonb)), updated_at = now()
where s.teacher_id=(select teacher_id from public.registration_settings where id);

create or replace function public.create_self_registered_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_username text;
  expected_email text;
  signup_teacher uuid;
begin
  if new.raw_user_meta_data->>'registration_source' is distinct from 'self' then return new; end if;
  if not public.self_registration_enabled() then
    raise exception 'Selvoprettelse er ikke aktiveret endnu.';
  end if;
  chosen_username := lower(normalize(btrim(coalesce(new.raw_user_meta_data->>'username', '')), NFC));
  if chosen_username !~ '^[a-zæøå0-9._-]{1,40}$' then
    raise exception 'Ugyldigt brugernavn.';
  end if;
  expected_email := case when chosen_username ~ '[æøå]'
    then encode(sha256(convert_to(chosen_username, 'UTF8')), 'hex') || '@unicode.users.jacobmatematik.invalid'
    else chosen_username || '@users.jacobmatematik.invalid' end;
  if new.email is distinct from expected_email then raise exception 'Ugyldig loginadresse.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(chosen_username, 0));
  if exists (select 1 from public.profiles where lower(username) = chosen_username) then
    raise exception 'Brugernavnet er allerede i brug.' using errcode = '23505';
  end if;
  select s.teacher_id into signup_teacher
  from public.registration_settings s
  join public.registration_administrators a on a.teacher_id = s.teacher_id
  join public.profiles p on p.id = a.teacher_id and p.role = 'teacher'
  where s.id;
  if signup_teacher is null then raise exception 'Registreringsadministratoren mangler.'; end if;
  insert into public.profiles(id, teacher_id, role, username, name, self_registered)
  values (new.id, signup_teacher, 'student', chosen_username, chosen_username, true);
  -- Same roster and teacher relationship as teacher-created students, no class yet.
  -- The row update serializes simultaneous signups with teacher saves.
  update public.school_state
  set data = jsonb_set(data, '{users}', coalesce(data->'users', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('id', new.id, 'role', 'student', 'username', chosen_username,
      'name', chosen_username, 'classId', null, 'selfRegistered', true)
  )), updated_at = now()
  where teacher_id = signup_teacher;
  if not found then raise exception 'Registreringsadministratorens elevoversigt mangler.'; end if;
  return new;
end;
$$;
revoke all on function public.create_self_registered_profile() from public, anon, authenticated;

create or replace function public.list_self_registered(p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare response jsonb;
begin
  if not public.can_manage_self_registered() then raise exception 'Kun administratoren har adgang.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) into response from (
    select p.id, p.username, p.name, p.created_at,
      own_user.item->>'classId' is not null as assigned,
      own_user.item->>'classId' as class_id, own_class.item->>'name' as class_name
    from public.profiles p
    left join public.school_state s on s.teacher_id = p.teacher_id
    left join lateral (
      select item from jsonb_array_elements(coalesce(s.data->'users', '[]'::jsonb)) item
      where item->>'id' = p.id::text limit 1
    ) own_user on true
    left join lateral (
      select item from jsonb_array_elements(coalesce(s.data->'classes', '[]'::jsonb)) item
      where item->>'id' = own_user.item->>'classId' limit 1
    ) own_class on true
    where p.self_registered and p.role = 'student'
      and (p.teacher_id is null or p.teacher_id = (select auth.uid()))
      and (strpos(lower(p.username), lower(left(coalesce(p_search, ''), 40))) > 0
        or strpos(lower(p.name), lower(left(coalesce(p_search, ''), 40))) > 0)
    order by (own_user.item->>'classId' is not null), p.created_at desc, p.id
    limit 51 offset greatest(coalesce(p_offset, 0), 0)
  ) rows;
  return response;
end;
$$;
revoke all on function public.list_self_registered(text,integer) from public, anon;
grant execute on function public.list_self_registered(text,integer) to authenticated;

commit;
