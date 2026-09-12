create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create policy "Deny direct FPS highscore table access"
on public.fps_highscores
for all
to authenticated
using (false)
with check (false);

create or replace function private.submit_fps_score_internal(p_score integer)
returns table(best_score integer, improved boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  if not exists (select 1 from public.profiles where id = v_user_id) then
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
$$;

create or replace function private.get_my_fps_highscore_internal()
returns integer
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_score integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select h.best_score into v_score
  from public.fps_highscores h
  where h.user_id = v_user_id;
  return coalesce(v_score, 0);
end;
$$;

create or replace function private.get_fps_leaderboard_internal()
returns table(rank bigint, username text, best_score integer, achieved_at timestamptz, is_me boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
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
    join public.profiles p on p.id = h.user_id
    order by h.best_score desc, h.achieved_at asc, p.username asc
    limit 5
  ) ranked
  where auth.uid() is not null
  order by ranked.rank;
$$;

revoke all on function private.submit_fps_score_internal(integer) from public, anon;
revoke all on function private.get_my_fps_highscore_internal() from public, anon;
revoke all on function private.get_fps_leaderboard_internal() from public, anon;
grant execute on function private.submit_fps_score_internal(integer) to authenticated;
grant execute on function private.get_my_fps_highscore_internal() to authenticated;
grant execute on function private.get_fps_leaderboard_internal() to authenticated;

create or replace function public.submit_fps_score(p_score integer)
returns table(best_score integer, improved boolean)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.submit_fps_score_internal(p_score);
$$;

create or replace function public.get_my_fps_highscore()
returns integer
language sql
security invoker
stable
set search_path = public, private, pg_temp
as $$
  select private.get_my_fps_highscore_internal();
$$;

create or replace function public.get_fps_leaderboard()
returns table(rank bigint, username text, best_score integer, achieved_at timestamptz, is_me boolean)
language sql
security invoker
stable
set search_path = public, private, pg_temp
as $$
  select * from private.get_fps_leaderboard_internal();
$$;

revoke all on function public.submit_fps_score(integer) from public, anon;
revoke all on function public.get_my_fps_highscore() from public, anon;
revoke all on function public.get_fps_leaderboard() from public, anon;
grant execute on function public.submit_fps_score(integer) to authenticated;
grant execute on function public.get_my_fps_highscore() to authenticated;
grant execute on function public.get_fps_leaderboard() to authenticated;
