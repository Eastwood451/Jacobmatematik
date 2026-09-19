create or replace function private.get_practice_topic_leaderboard_internal(p_topic text)
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
$$;

revoke all on function private.get_practice_topic_leaderboard_internal(text) from public, anon;
grant execute on function private.get_practice_topic_leaderboard_internal(text) to authenticated;

create or replace function public.get_practice_topic_leaderboard(p_topic text)
returns table(rank bigint, name text, score bigint, is_me boolean)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_practice_topic_leaderboard_internal(p_topic);
$$;

revoke all on function public.get_practice_topic_leaderboard(text) from public, anon;
grant execute on function public.get_practice_topic_leaderboard(text) to authenticated;

