create or replace function private.get_teacher_practice_topic_leaderboard_internal(p_topic text, p_class_id text)
returns table(rank bigint, name text, score bigint, is_me boolean)
language sql
security definer
stable
set search_path = ''
as $$
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
    where p.role = 'student'
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
$$;

revoke all on function private.get_teacher_practice_topic_leaderboard_internal(text,text) from public, anon;
grant execute on function private.get_teacher_practice_topic_leaderboard_internal(text,text) to authenticated;

create or replace function public.get_teacher_practice_topic_leaderboard(p_topic text, p_class_id text)
returns table(rank bigint, name text, score bigint, is_me boolean)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_teacher_practice_topic_leaderboard_internal(p_topic, p_class_id);
$$;

revoke all on function public.get_teacher_practice_topic_leaderboard(text,text) from public, anon;
grant execute on function public.get_teacher_practice_topic_leaderboard(text,text) to authenticated;

