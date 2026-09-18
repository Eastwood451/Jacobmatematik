create table if not exists public.practice_leaderboard_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  opted_in boolean not null default false,
  last_prompted_rank integer check (last_prompted_rank is null or last_prompted_rank between 1 and 10),
  updated_at timestamptz not null default now()
);

alter table public.practice_leaderboard_preferences enable row level security;
revoke all on table public.practice_leaderboard_preferences from anon, authenticated;

drop policy if exists "Deny direct practice leaderboard access" on public.practice_leaderboard_preferences;
create policy "Deny direct practice leaderboard access"
on public.practice_leaderboard_preferences
for all
to authenticated
using (false)
with check (false);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.practice_leaderboard_context()
returns table(user_id uuid, teacher_id uuid, class_id text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id,
         p.teacher_id,
         student_item->>'classId'
  from public.profiles p
  join public.school_state s on s.teacher_id = p.teacher_id
  cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
  where p.id = (select auth.uid())
    and p.role = 'student'
    and student_item->>'id' = p.id::text
    and nullif(student_item->>'classId','') is not null
  limit 1;
$$;

create or replace function private.practice_score(target_user uuid)
returns bigint
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::bigint
  from public.results r
  where r.student_id = target_user
    and r.data->>'correct' = 'true'
    and coalesce(r.data->>'recordType','') = '';
$$;

create or replace function private.get_practice_leaderboard_internal()
returns table(rank bigint, name text, score bigint, is_me boolean)
language sql
security definer
stable
set search_path = ''
as $$
  with ctx as (
    select * from private.practice_leaderboard_context()
  ),
  class_students as (
    select p.id, p.name
    from ctx
    join public.school_state s on s.teacher_id = ctx.teacher_id
    cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
    join public.profiles p on p.id::text = student_item->>'id'
    where p.role = 'student'
      and student_item->>'classId' = ctx.class_id
  ),
  participants as (
    select cs.id,
           cs.name,
           private.practice_score(cs.id) as score
    from class_students cs
    join public.practice_leaderboard_preferences pref
      on pref.user_id = cs.id and pref.opted_in = true
  ),
  ranked as (
    select dense_rank() over (order by score desc) as rank,
           id,
           name,
           score
    from participants
    where score > 0
  )
  select ranked.rank,
         ranked.name,
         ranked.score,
         ranked.id = (select user_id from ctx) as is_me
  from ranked
  where ranked.rank <= 10
  order by ranked.rank, ranked.name;
$$;

create or replace function private.get_my_practice_leaderboard_status_internal()
returns table(score bigint, prospective_rank bigint, qualifies boolean, opted_in boolean, should_prompt boolean)
language sql
security definer
stable
set search_path = ''
as $$
  with ctx as (
    select * from private.practice_leaderboard_context()
  ),
  me as (
    select ctx.user_id,
           private.practice_score(ctx.user_id) as score
    from ctx
  ),
  opted_scores as (
    select private.practice_score(p.id) as score
    from ctx
    join public.school_state s on s.teacher_id = ctx.teacher_id
    cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
    join public.profiles p on p.id::text = student_item->>'id'
    join public.practice_leaderboard_preferences pref
      on pref.user_id = p.id and pref.opted_in = true
    where p.role = 'student'
      and p.id <> ctx.user_id
      and student_item->>'classId' = ctx.class_id
  ),
  calc as (
    select me.score,
           (1 + (select count(*) from opted_scores os where os.score > me.score))::bigint as prospective_rank,
           coalesce(pref.opted_in,false) as opted_in,
           pref.last_prompted_rank
    from me
    left join public.practice_leaderboard_preferences pref on pref.user_id = me.user_id
  )
  select calc.score,
         calc.prospective_rank,
         (calc.score > 0 and calc.prospective_rank <= 10) as qualifies,
         calc.opted_in,
         (calc.score > 0
          and calc.prospective_rank <= 10
          and not calc.opted_in
          and (calc.last_prompted_rank is null or calc.prospective_rank < calc.last_prompted_rank)) as should_prompt
  from calc;
$$;

create or replace function private.set_practice_leaderboard_consent_internal(p_opt_in boolean, p_prompted_rank integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'student') then
    raise exception 'Student profile required';
  end if;
  if p_prompted_rank is not null and (p_prompted_rank < 1 or p_prompted_rank > 10) then
    raise exception 'Invalid leaderboard rank';
  end if;

  insert into public.practice_leaderboard_preferences(user_id, opted_in, last_prompted_rank, updated_at)
  values (v_user_id, coalesce(p_opt_in,false), p_prompted_rank, now())
  on conflict (user_id) do update
    set opted_in = excluded.opted_in,
        last_prompted_rank = case
          when excluded.opted_in then excluded.last_prompted_rank
          else coalesce(excluded.last_prompted_rank, public.practice_leaderboard_preferences.last_prompted_rank)
        end,
        updated_at = now();
end;
$$;

revoke all on function private.practice_leaderboard_context() from public, anon;
revoke all on function private.practice_score(uuid) from public, anon;
revoke all on function private.get_practice_leaderboard_internal() from public, anon;
revoke all on function private.get_my_practice_leaderboard_status_internal() from public, anon;
revoke all on function private.set_practice_leaderboard_consent_internal(boolean,integer) from public, anon;
grant execute on function private.practice_leaderboard_context() to authenticated;
grant execute on function private.practice_score(uuid) to authenticated;
grant execute on function private.get_practice_leaderboard_internal() to authenticated;
grant execute on function private.get_my_practice_leaderboard_status_internal() to authenticated;
grant execute on function private.set_practice_leaderboard_consent_internal(boolean,integer) to authenticated;

create or replace function public.get_practice_leaderboard()
returns table(rank bigint, name text, score bigint, is_me boolean)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_practice_leaderboard_internal();
$$;

create or replace function public.get_my_practice_leaderboard_status()
returns table(score bigint, prospective_rank bigint, qualifies boolean, opted_in boolean, should_prompt boolean)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_my_practice_leaderboard_status_internal();
$$;

create or replace function public.set_practice_leaderboard_consent(p_opt_in boolean, p_prompted_rank integer default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_practice_leaderboard_consent_internal(p_opt_in, p_prompted_rank);
$$;

revoke all on function public.get_practice_leaderboard() from public, anon;
revoke all on function public.get_my_practice_leaderboard_status() from public, anon;
revoke all on function public.set_practice_leaderboard_consent(boolean,integer) from public, anon;
grant execute on function public.get_practice_leaderboard() to authenticated;
grant execute on function public.get_my_practice_leaderboard_status() to authenticated;
grant execute on function public.set_practice_leaderboard_consent(boolean,integer) to authenticated;
