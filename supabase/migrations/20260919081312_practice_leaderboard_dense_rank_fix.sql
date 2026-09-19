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
$$;
