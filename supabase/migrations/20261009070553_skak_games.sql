-- Skak med regnestykker: online-kampe mellem to indloggede brugere.
-- Kun de to spillere kan læse kampen. Alle skrivninger sker via security definer-funktioner,
-- som kontrollerer spiller, tur og version. Skak-reglerne og regnestykkerne valideres i klienten (v1).

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  white_id uuid not null references public.profiles(id) on delete cascade,
  black_id uuid references public.profiles(id) on delete cascade,
  white_name text not null check (char_length(white_name) <= 80),
  black_name text check (black_name is null or char_length(black_name) <= 80),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    check (char_length(fen) between 20 and 120),
  moves jsonb not null default '[]'::jsonb check (jsonb_typeof(moves) = 'array'),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  status text not null default 'waiting' check (status in ('waiting','active','finished')),
  result text check (result is null or result in ('1-0','0-1','1/2-1/2')),
  result_reason text check (result_reason is null or char_length(result_reason) <= 40),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (black_id is null or black_id <> white_id)
);

create index if not exists chess_games_white_id_idx on public.chess_games (white_id);
create index if not exists chess_games_black_id_idx on public.chess_games (black_id);

alter table public.chess_games enable row level security;
revoke all on table public.chess_games from anon, authenticated;
grant select on table public.chess_games to authenticated;

drop policy if exists "Players read own chess games" on public.chess_games;
create policy "Players read own chess games" on public.chess_games
  for select to authenticated
  using ((select auth.uid()) = white_id or (select auth.uid()) = black_id);

create or replace function public.create_chess_game()
returns public.chess_games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_code text;
  v_row public.chess_games;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select p.name into v_name from public.profiles p where p.id = v_uid;
  if v_name is null then raise exception 'Profile not found'; end if;

  -- Ryd brugerens egne gamle ventende invitationer.
  delete from public.chess_games where white_id = v_uid and status = 'waiting';

  for i in 1..20 loop
    v_code := '';
    for j in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into public.chess_games (code, white_id, white_name, meta)
      values (v_code, v_uid, left(v_name, 80), '{"w":{"turns":0,"buys":0,"lastBuyTurn":null},"b":{"turns":0,"buys":0,"lastBuyTurn":null}}'::jsonb)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      -- prøv en ny kode
    end;
  end loop;
  raise exception 'Could not create game code';
end;
$$;

create or replace function public.join_chess_game(p_code text)
returns public.chess_games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.chess_games;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select p.name into v_name from public.profiles p where p.id = v_uid;
  if v_name is null then raise exception 'Profile not found'; end if;

  select * into v_row from public.chess_games
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found then raise exception 'Game not found'; end if;
  if v_row.black_id = v_uid or (v_row.white_id = v_uid and v_row.status <> 'waiting') then
    return v_row; -- genindtræden i egen kamp
  end if;
  if v_row.white_id = v_uid then raise exception 'Cannot join own game'; end if;
  if v_row.status <> 'waiting' or v_row.black_id is not null then raise exception 'Game already started'; end if;
  if v_row.created_at < now() - interval '1 day' then raise exception 'Game expired'; end if;

  update public.chess_games
  set black_id = v_uid, black_name = left(v_name, 80), status = 'active',
      version = version + 1, updated_at = now()
  where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.submit_chess_move(
  p_game uuid,
  p_version integer,
  p_fen text,
  p_move jsonb,
  p_meta jsonb,
  p_status text default 'active',
  p_result text default null,
  p_reason text default null
)
returns public.chess_games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.chess_games;
  v_side text;
  v_next text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_row from public.chess_games where id = p_game for update;
  if not found or v_uid not in (v_row.white_id, coalesce(v_row.black_id, v_row.white_id)) then
    raise exception 'Game not found';
  end if;
  if v_row.status <> 'active' then raise exception 'Game is not active'; end if;
  if v_row.version <> p_version then raise exception 'version_conflict'; end if;

  v_side := split_part(v_row.fen, ' ', 2);
  v_next := case when v_side = 'w' then 'b' else 'w' end;
  if (v_side = 'w' and v_uid <> v_row.white_id) or (v_side = 'b' and v_uid <> v_row.black_id) then
    raise exception 'Not your turn';
  end if;
  if p_fen is null or char_length(p_fen) < 20 or char_length(p_fen) > 120
     or split_part(p_fen, ' ', 2) <> v_next then
    raise exception 'Invalid position';
  end if;
  if p_move is null or jsonb_typeof(p_move) <> 'object' or pg_column_size(p_move) > 500 then
    raise exception 'Invalid move';
  end if;
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' or pg_column_size(p_meta) > 1000 then
    raise exception 'Invalid meta';
  end if;
  if jsonb_array_length(v_row.moves) >= 800 then raise exception 'Game too long'; end if;
  if coalesce(p_status, 'active') not in ('active', 'finished') then raise exception 'Invalid status'; end if;
  if p_status = 'finished' and (p_result is null or p_result not in ('1-0','0-1','1/2-1/2')) then
    raise exception 'Invalid result';
  end if;

  update public.chess_games
  set fen = p_fen,
      moves = moves || jsonb_build_array(p_move),
      meta = p_meta,
      status = coalesce(p_status, 'active'),
      result = case when p_status = 'finished' then p_result else null end,
      result_reason = case when p_status = 'finished' then left(p_reason, 40) else null end,
      version = version + 1,
      updated_at = now()
  where id = p_game
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.resign_chess_game(p_game uuid)
returns public.chess_games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.chess_games;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_row from public.chess_games where id = p_game for update;
  if not found or v_uid not in (v_row.white_id, coalesce(v_row.black_id, v_row.white_id)) then
    raise exception 'Game not found';
  end if;
  if v_row.status = 'finished' then return v_row; end if;

  update public.chess_games
  set status = 'finished',
      result = case when v_row.status = 'waiting' then null when v_uid = v_row.white_id then '0-1' else '1-0' end,
      result_reason = case when v_row.status = 'waiting' then 'aflyst' else 'opgivet' end,
      version = version + 1,
      updated_at = now()
  where id = p_game
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_chess_game() from public, anon;
revoke all on function public.join_chess_game(text) from public, anon;
revoke all on function public.submit_chess_move(uuid, integer, text, jsonb, jsonb, text, text, text) from public, anon;
revoke all on function public.resign_chess_game(uuid) from public, anon;
grant execute on function public.create_chess_game() to authenticated;
grant execute on function public.join_chess_game(text) to authenticated;
grant execute on function public.submit_chess_move(uuid, integer, text, jsonb, jsonb, text, text, text) to authenticated;
grant execute on function public.resign_chess_game(uuid) to authenticated;
