-- Apply after schema.sql. Existing users and results are preserved.
begin;

alter table public.profiles add column if not exists self_registered boolean not null default false;
alter table public.profiles drop constraint if exists profiles_check;
alter table public.profiles add constraint profiles_check check (
  (role = 'teacher' and teacher_id is null and not self_registered)
  or (role = 'student' and (teacher_id is not null or self_registered))
);

-- This is an explicit administrator allowlist, never writable through signup.
create table if not exists public.registration_administrators (
  teacher_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.registration_administrators enable row level security;
revoke all on public.registration_administrators from public, anon, authenticated;
insert into public.registration_administrators(teacher_id)
select id from public.profiles where role = 'teacher' and lower(username) = 'jacob'
on conflict do nothing;

create or replace function public.can_manage_self_registered()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.registration_administrators a
    join public.profiles p on p.id = a.teacher_id
    where a.teacher_id = (select auth.uid()) and p.role = 'teacher'
  );
$$;
revoke all on function public.can_manage_self_registered() from public, anon;
grant execute on function public.can_manage_self_registered() to authenticated;

-- Keep signup closed until the operator has disabled email confirmation for
-- username-only Auth accounts. This also protects against partial deployments.
create table if not exists public.registration_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false
);
alter table public.registration_settings enable row level security;
revoke all on public.registration_settings from public, anon, authenticated;
insert into public.registration_settings(id, enabled) values (true, false) on conflict do nothing;
create or replace function public.self_registration_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select enabled from public.registration_settings where id), false);
$$;
revoke all on function public.self_registration_enabled() from public;
grant execute on function public.self_registration_enabled() to anon, authenticated;

-- Supabase Auth owns password hashing, duplicate auth identities and rate limits.
-- Profile creation is in the same transaction as the Auth account: no orphan
-- account if profile validation fails. Metadata NEVER grants a role or a class.
create or replace function public.create_self_registered_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_username text;
  expected_email text;
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
  insert into public.profiles(id, teacher_id, role, username, name, self_registered)
  values (new.id, null, 'student', chosen_username, chosen_username, true);
  return new;
end;
$$;
revoke all on function public.create_self_registered_profile() from public, anon, authenticated;
drop trigger if exists create_self_registered_profile on auth.users;
create trigger create_self_registered_profile after insert on auth.users
for each row execute function public.create_self_registered_profile();

create index if not exists profiles_self_registered_idx on public.profiles(created_at desc, id)
where self_registered;

create or replace function public.list_self_registered(p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare response jsonb;
begin
  if not public.can_manage_self_registered() then raise exception 'Kun administratoren har adgang.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) into response from (
    select p.id, p.username, p.name, p.created_at,
      p.teacher_id is not null as assigned,
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
    order by (p.teacher_id is not null), p.created_at desc, p.id
    limit 51 offset greatest(coalesce(p_offset, 0), 0)
  ) rows;
  return response;
end;
$$;
revoke all on function public.list_self_registered(text,integer) from public, anon;
grant execute on function public.list_self_registered(text,integer) to authenticated;

-- Update ownership and the class roster together. Row locks serialize competing
-- claims, and existing results stay attached to the same immutable student ID.
create or replace function public.assign_self_registered(target_student uuid, target_class text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  school jsonb;
  student public.profiles%rowtype;
  roster jsonb;
  entry jsonb;
begin
  if not public.can_manage_self_registered() then raise exception 'Kun administratoren har adgang.' using errcode = '42501'; end if;
  select data into school from public.school_state where teacher_id = (select auth.uid()) for update;
  if school is null or not exists (
    select 1 from jsonb_array_elements(school->'classes') c where c->>'id' = target_class
  ) then raise exception 'Klassen blev ikke fundet blandt dine klasser.'; end if;
  select * into student from public.profiles where id = target_student for update;
  if not found or not student.self_registered or student.role <> 'student'
    or (student.teacher_id is not null and student.teacher_id <> (select auth.uid())) then
    raise exception 'Brugeren kan ikke placeres i din klasse.';
  end if;
  select item into entry from jsonb_array_elements(coalesce(school->'users', '[]'::jsonb)) item
  where item->>'id' = student.id::text limit 1;
  entry := coalesce(entry, '{}'::jsonb) || jsonb_build_object(
    'id', student.id, 'role', 'student', 'username', student.username,
    'name', student.name, 'classId', target_class, 'selfRegistered', true
  );
  select coalesce(jsonb_agg(item), '[]'::jsonb) into roster
  from jsonb_array_elements(coalesce(school->'users', '[]'::jsonb)) item
  where item->>'id' is distinct from student.id::text;
  update public.profiles set teacher_id = (select auth.uid()) where id = student.id;
  update public.school_state set data = jsonb_set(school, '{users}', roster || jsonb_build_array(entry)), updated_at = now()
  where teacher_id = (select auth.uid());
end;
$$;
revoke all on function public.assign_self_registered(uuid,text) from public, anon;
grant execute on function public.assign_self_registered(uuid,text) to authenticated;

-- A teacher may have an older portal open in another tab. Its next JSON save
-- must not drop a newly assigned user from the roster. Explicit account
-- deletion still works because the profile is deleted before the JSON save.
create or replace function public.preserve_newly_assigned_users()
returns trigger language plpgsql security definer set search_path = '' as $$
declare preserved jsonb;
begin
  select coalesce(jsonb_agg(item), '[]'::jsonb) into preserved
  from jsonb_array_elements(coalesce(old.data->'users', '[]'::jsonb)) item
  where exists (
    select 1 from public.profiles p where p.id::text = item->>'id'
      and p.self_registered and p.teacher_id = old.teacher_id
  ) and not exists (
    select 1 from jsonb_array_elements(coalesce(new.data->'users', '[]'::jsonb)) incoming
    where incoming->>'id' = item->>'id'
  );
  new.data := jsonb_set(new.data, '{users}', coalesce(new.data->'users', '[]'::jsonb) || preserved);
  return new;
end;
$$;
revoke all on function public.preserve_newly_assigned_users() from public, anon, authenticated;
drop trigger if exists preserve_newly_assigned_users on public.school_state;
create trigger preserve_newly_assigned_users before update on public.school_state
for each row execute function public.preserve_newly_assigned_users();

commit;
