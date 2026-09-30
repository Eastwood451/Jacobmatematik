-- Self-created accounts keep progress only on their own device.
begin;
alter policy "Student records own result" on public.results with check (
 student_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='student' and not p.self_registered and p.teacher_id is not null)
);
drop policy if exists "Only teacher-created results are visible" on public.results;
create policy "Only teacher-created results are visible" on public.results as restrictive for select to authenticated using (
 exists (select 1 from public.profiles p where p.id=results.student_id and p.role='student' and not p.self_registered and p.teacher_id is not null)
);
CREATE OR REPLACE FUNCTION private.submit_fps_score_internal(p_score integer)
 RETURNS TABLE(best_score integer, improved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_previous integer;
  v_improved boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then
    raise exception 'Invalid FPS score';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role = 'student' and not self_registered and teacher_id is not null) then
    raise exception 'Profile not found';
  end if;

  select h.best_score into v_previous
  from public.fps_highscores h
  where h.user_id = v_user_id;
  v_improved := v_previous is null or p_score > v_previous;

  insert into public.fps_highscores as h (user_id, best_score, achieved_at, updated_at)
  values (v_user_id, p_score, now(), now())
  on conflict (user_id) do update
    set best_score = greatest(h.best_score, excluded.best_score),
        achieved_at = case when excluded.best_score > h.best_score then now() else h.achieved_at end,
        updated_at = now();

  return query
  select h.best_score, v_improved
  from public.fps_highscores h
  where h.user_id = v_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_my_fps_highscore_internal()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_score integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select h.best_score into v_score
  from public.fps_highscores h
  where h.user_id = v_user_id and exists (select 1 from public.profiles p where p.id=v_user_id and p.role='student' and not p.self_registered and p.teacher_id is not null);
  return coalesce(v_score, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_fps_leaderboard_internal()
 RETURNS TABLE(rank bigint, username text, best_score integer, achieved_at timestamp with time zone, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select ranked.rank,
         ranked.username,
         ranked.best_score,
         ranked.achieved_at,
         ranked.user_id = auth.uid() as is_me
  from (
    select row_number() over (order by h.best_score desc, h.achieved_at asc, p.username asc) as rank,
           h.user_id,
           p.username,
           h.best_score,
           h.achieved_at
    from public.fps_highscores h
    join public.profiles p on p.id = h.user_id and p.role='student' and not p.self_registered and p.teacher_id is not null
    order by h.best_score desc, h.achieved_at asc, p.username asc
    limit 5
  ) ranked
  where auth.uid() is not null
  order by ranked.rank;
$function$;

CREATE OR REPLACE FUNCTION private.practice_leaderboard_context()
 RETURNS TABLE(user_id uuid, teacher_id uuid, class_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id,
         p.teacher_id,
         student_item->>'classId'
  from public.profiles p
  join public.school_state s on s.teacher_id = p.teacher_id
  cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
  where p.id = (select auth.uid())
    and p.role = 'student' and not p.self_registered and p.teacher_id is not null
    and student_item->>'id' = p.id::text
    and nullif(student_item->>'classId','') is not null
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.get_practice_leaderboard_internal()
 RETURNS TABLE(rank bigint, name text, score bigint, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ctx as (
    select * from private.practice_leaderboard_context()
  ),
  class_students as (
    select p.id, p.name
    from ctx
    join public.school_state s on s.teacher_id = ctx.teacher_id
    cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
    join public.profiles p on p.id::text = student_item->>'id'
    where p.role = 'student' and not p.self_registered and p.teacher_id is not null
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
$function$;

CREATE OR REPLACE FUNCTION private.get_my_practice_leaderboard_status_internal()
 RETURNS TABLE(score bigint, prospective_rank bigint, qualifies boolean, opted_in boolean, should_prompt boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where p.role = 'student' and not p.self_registered and p.teacher_id is not null
      and p.id <> ctx.user_id
      and student_item->>'classId' = ctx.class_id
  ),
  calc as (
    select me.score,
           (1 + (select count(distinct os.score) from opted_scores os where os.score > me.score))::bigint as prospective_rank,
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
$function$;

CREATE OR REPLACE FUNCTION private.set_practice_leaderboard_consent_internal(p_opt_in boolean, p_prompted_rank integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'student' and not p.self_registered and p.teacher_id is not null) then
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
$function$;

CREATE OR REPLACE FUNCTION private.get_practice_topic_leaderboard_internal(p_topic text)
 RETURNS TABLE(rank bigint, name text, score bigint, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ctx as (
    select * from private.practice_leaderboard_context()
  ),
  class_students as (
    select p.id, p.name
    from ctx
    join public.school_state s on s.teacher_id = ctx.teacher_id
    cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
    join public.profiles p on p.id::text = student_item->>'id'
    where p.role = 'student' and not p.self_registered and p.teacher_id is not null
      and student_item->>'classId' = ctx.class_id
  ),
  participants as (
    select cs.id,
           cs.name,
           (
             select count(*)::bigint
             from public.results r
             where r.student_id = cs.id
               and r.data->>'topic' = p_topic
               and r.data->>'correct' = 'true'
               and coalesce(r.data->>'recordType','') = ''
           ) as score
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
$function$;

CREATE OR REPLACE FUNCTION private.get_teacher_practice_topic_leaderboard_internal(p_topic text, p_class_id text)
 RETURNS TABLE(rank bigint, name text, score bigint, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with teacher as (
    select p.id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'teacher'
  ),
  class_students as (
    select p.id, p.name
    from teacher t
    join public.school_state s on s.teacher_id = t.id
    cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) student_item
    join public.profiles p on p.id::text = student_item->>'id'
    where p.role = 'student' and not p.self_registered and p.teacher_id is not null
      and student_item->>'classId' = p_class_id
  ),
  participants as (
    select cs.id,
           cs.name,
           (
             select count(*)::bigint
             from public.results r
             where r.student_id = cs.id
               and r.data->>'topic' = p_topic
               and r.data->>'correct' = 'true'
               and coalesce(r.data->>'recordType','') = ''
           ) as score
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
         false as is_me
  from ranked
  where ranked.rank <= 10
  order by ranked.rank, ranked.name;
$function$;

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
  if new.raw_user_meta_data->>'local_results_consent' is distinct from '2026-09-30' then
    raise exception 'Samtykke til lokal resultatlagring mangler.';
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


commit;

