create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('teacher','student')),
  username text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  check ((role = 'teacher' and teacher_id is null) or (role = 'student' and teacher_id is not null))
);

create table if not exists public.school_state (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{"classes":[],"users":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_teacher_id_idx on public.profiles(teacher_id);
create index if not exists results_student_id_idx on public.results(student_id);

alter table public.profiles enable row level security;
alter table public.school_state enable row level security;
alter table public.results enable row level security;

revoke all on public.profiles, public.school_state, public.results from anon;
grant select on public.profiles, public.school_state, public.results to authenticated;
grant insert on public.results to authenticated;
grant insert, update on public.school_state to authenticated;
grant delete on public.results to authenticated;

create policy "Read own profile" on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Teacher reads school" on public.school_state for select to authenticated
using (teacher_id = (select auth.uid()));

create policy "Teacher creates school state" on public.school_state for insert to authenticated
with check (teacher_id = (select auth.uid()));

create policy "Teacher updates school state" on public.school_state for update to authenticated
using (teacher_id = (select auth.uid()))
with check (teacher_id = (select auth.uid()));

create policy "Read permitted results" on public.results for select to authenticated
using (
  student_id = (select auth.uid()) or exists (
    select 1 from public.profiles p
    where p.id = results.student_id and p.teacher_id = (select auth.uid())
  )
);

create policy "Student records own result" on public.results for insert to authenticated
with check (
  student_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'
  )
);

create policy "Teacher deletes student results" on public.results for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = results.student_id and p.teacher_id = (select auth.uid())
));

create or replace function public.delete_topic_results(target_student uuid, target_topic text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.results
  where student_id = target_student and data->>'topic' = target_topic;
$$;

revoke all on function public.delete_topic_results(uuid,text) from public, anon;
grant execute on function public.delete_topic_results(uuid,text) to authenticated;

create or replace function public.get_my_student_state()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with school as (
    select s.data
    from public.profiles p
    join public.school_state s on s.teacher_id = p.teacher_id
    where p.id = (select auth.uid()) and p.role = 'student'
  ), own_user as (
    select item
    from school, jsonb_array_elements(school.data->'users') item
    where item->>'id' = (select auth.uid())::text
  )
  select jsonb_build_object(
    'classes', coalesce((
      select jsonb_agg(class_item)
      from school, own_user, jsonb_array_elements(school.data->'classes') class_item
      where class_item->>'id' = own_user.item->>'classId'
    ), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(item) from own_user), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_student_state() from public, anon;
grant execute on function public.get_my_student_state() to authenticated;

-- Første lærer oprettes efter Auth-brugeren er lavet i Supabase-dashboardet.
-- Erstat mailadressen og kør derefter disse to statements:
-- insert into public.profiles(id,role,username,name)
-- select id,'teacher','Jacob','Jacob' from auth.users where email='jacob@users.jacobmatematik.invalid';
-- insert into public.school_state(teacher_id,data)
-- select id,'{"classes":[],"users":[]}'::jsonb from auth.users where email='jacob@users.jacobmatematik.invalid';
