-- Skak: "Nuclear strike!" (atomangreb) i online-kampe som valgfri regel.
-- * chess_games.nuke: reglen vælges af den, der laver kampen (create_chess_game(p_nuke)). Default fra.
-- * chess_games.damage: skade pr. felt ({"d8": 1}) – serveren ejer den.
-- * submit_chess_strike: serveren validerer cooldown, mål (fjendtlig brik, ikke kongen), at man ikke står i skak,
--   og at et dræbende angreb ikke giver skak. Serveren beregner selv den nye stilling, skaden og meta.
-- * submit_chess_move: holder skade og meta (turns/strikes/lastStrikeTurn) autoritative. Skak-trækkene selv
--   valideres fortsat i klienten (v1), præcis som før.
-- Regnestykkerne løses i klienten.

alter table public.chess_games add column if not exists nuke boolean not null default false;
alter table public.chess_games add column if not exists damage jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.chess_games add constraint chess_games_damage_object check (jsonb_typeof(damage) = 'object');
exception when duplicate_object then null; end $$;

-- ---------- interne hjælpefunktioner (kun til brug i RPC'erne) ----------
-- Brættet som text[64]; indeks 1 = a8, 8 = h8, 57 = a1, 64 = h1. Tomt felt = ''.
create or replace function public.skak_board(p_fen text)
returns text[]
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_place text := split_part(p_fen, ' ', 1);
  v_board text[] := '{}';
  v_ch text;
begin
  for i in 1..char_length(v_place) loop
    v_ch := substr(v_place, i, 1);
    if v_ch = '/' then continue;
    elsif v_ch ~ '^[1-8]$' then
      for j in 1..v_ch::int loop v_board := v_board || ''::text; end loop;
    elsif v_ch ~ '^[pnbrqkPNBRQK]$' then
      v_board := v_board || v_ch;
    else
      raise exception 'Invalid position';
    end if;
  end loop;
  if coalesce(array_length(v_board, 1), 0) <> 64 then raise exception 'Invalid position'; end if;
  return v_board;
end;
$$;

create or replace function public.skak_placement(p_board text[])
returns text
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_out text := '';
  v_empty int;
begin
  for r in 0..7 loop
    v_empty := 0;
    for f in 0..7 loop
      if p_board[r * 8 + f + 1] = '' then v_empty := v_empty + 1;
      else
        if v_empty > 0 then v_out := v_out || v_empty::text; v_empty := 0; end if;
        v_out := v_out || p_board[r * 8 + f + 1];
      end if;
    end loop;
    if v_empty > 0 then v_out := v_out || v_empty::text; end if;
    if r < 7 then v_out := v_out || '/'; end if;
  end loop;
  return v_out;
end;
$$;

-- 'e4' -> 0-baseret indeks (0 = a8, 63 = h1); null ved ugyldigt felt.
create or replace function public.skak_sq(p_sq text)
returns integer
language sql immutable
set search_path = public, pg_temp
as $$
  select case when p_sq ~ '^[a-h][1-8]$'
    then (8 - substr(p_sq, 2, 1)::int) * 8 + (ascii(substr(p_sq, 1, 1)) - 97) end;
$$;

create or replace function public.skak_sqname(p_idx integer)
returns text
language sql immutable
set search_path = public, pg_temp
as $$ select chr(97 + p_idx % 8) || (8 - p_idx / 8)::text; $$;

-- Angribes felt p_idx (0-baseret) af farven p_by ('w'/'b')?
create or replace function public.skak_attacked(p_board text[], p_idx integer, p_by text)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  tr int := p_idx / 8;
  tf int := p_idx % 8;
  r int; f int; pc text;
  up boolean := p_by = 'w';
  pP text := case when up then 'P' else 'p' end;
  pN text := case when up then 'N' else 'n' end;
  pB text := case when up then 'B' else 'b' end;
  pR text := case when up then 'R' else 'r' end;
  pQ text := case when up then 'Q' else 'q' end;
  pK text := case when up then 'K' else 'k' end;
  d int[];
  knight int[] := array[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  king int[] := array[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  orth int[] := array[[-1,0],[1,0],[0,-1],[0,1]];
  diag int[] := array[[-1,-1],[-1,1],[1,-1],[1,1]];
begin
  -- bønder: hvide bønder står én række "under" (højere r) feltet, sorte én række over
  r := tr + case when up then 1 else -1 end;
  if r between 0 and 7 then
    foreach f in array array[tf - 1, tf + 1] loop
      if f between 0 and 7 and p_board[r * 8 + f + 1] = pP then return true; end if;
    end loop;
  end if;
  for i in 1..8 loop
    r := tr + knight[i][1]; f := tf + knight[i][2];
    if r between 0 and 7 and f between 0 and 7 and p_board[r * 8 + f + 1] = pN then return true; end if;
    r := tr + king[i][1]; f := tf + king[i][2];
    if r between 0 and 7 and f between 0 and 7 and p_board[r * 8 + f + 1] = pK then return true; end if;
  end loop;
  for i in 1..4 loop
    r := tr; f := tf;
    loop
      r := r + orth[i][1]; f := f + orth[i][2];
      exit when r < 0 or r > 7 or f < 0 or f > 7;
      pc := p_board[r * 8 + f + 1];
      if pc <> '' then
        if pc = pR or pc = pQ then return true; end if;
        exit;
      end if;
    end loop;
    r := tr; f := tf;
    loop
      r := r + diag[i][1]; f := f + diag[i][2];
      exit when r < 0 or r > 7 or f < 0 or f > 7;
      pc := p_board[r * 8 + f + 1];
      if pc <> '' then
        if pc = pB or pc = pQ then return true; end if;
        exit;
      end if;
    end loop;
  end loop;
  return false;
end;
$$;

-- Står kongen af farven p_color i skak?
create or replace function public.skak_in_check(p_board text[], p_color text)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_k int := array_position(p_board, case when p_color = 'w' then 'K' else 'k' end);
begin
  if v_k is null then return false; end if;
  return public.skak_attacked(p_board, v_k - 1, case when p_color = 'w' then 'b' else 'w' end);
end;
$$;

create or replace function public.skak_max_hp(p_piece text)
returns integer
language sql immutable
set search_path = public, pg_temp
as $$ select case lower(coalesce(p_piece, '')) when 'p' then 1 when 'n' then 2 when 'b' then 2 when 'r' then 3 when 'q' then 5 else 0 end; $$;

-- Behold kun gyldige skader: felt med en ikke-konge-brik og 1 <= skade < maks-liv.
create or replace function public.skak_clean_damage(p_fen text, p_damage jsonb)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_board text[] := public.skak_board(p_fen);
  v_out jsonb := '{}'::jsonb;
  v_key text; v_val jsonb; v_idx int; v_n int; v_max int;
begin
  if p_damage is null or jsonb_typeof(p_damage) <> 'object' then return v_out; end if;
  for v_key, v_val in select * from jsonb_each(p_damage) loop
    v_idx := public.skak_sq(v_key);
    continue when v_idx is null or jsonb_typeof(v_val) <> 'number';
    v_n := floor((v_val #>> '{}')::numeric)::int;
    v_max := public.skak_max_hp(v_board[v_idx + 1]);
    if v_n >= 1 and v_n < v_max then v_out := v_out || jsonb_build_object(v_key, v_n); end if;
  end loop;
  return v_out;
end;
$$;

-- Flyt skade med brikken ved et almindeligt træk/indsat brik (spejler SkakCore.moveDamage).
create or replace function public.skak_move_damage(p_old_fen text, p_new_fen text, p_damage jsonb, p_move jsonb)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_board text[] := public.skak_board(p_old_fen);
  v_dmg jsonb := coalesce(p_damage, '{}'::jsonb);
  v_from text := p_move->>'from';
  v_to text := p_move->>'to';
  v_fi int := public.skak_sq(v_from);
  v_ti int := public.skak_sq(v_to);
  v_piece text; v_d jsonb; v_rf text; v_rt text; v_rd jsonb;
begin
  if p_move ? 'drop' then
    v_dmg := v_dmg - coalesce(p_move->>'square', '');
  elsif v_fi is not null and v_ti is not null then
    v_piece := v_board[v_fi + 1];
    v_d := v_dmg -> v_from;
    v_dmg := v_dmg - v_from - v_to;
    -- en passant: bonde slår diagonalt til tomt felt → den slåede bonde står på to-filen/from-rækken
    if lower(v_piece) = 'p' and v_fi % 8 <> v_ti % 8 and v_board[v_ti + 1] = '' then
      v_dmg := v_dmg - (substr(v_to, 1, 1) || substr(v_from, 2, 1));
    end if;
    -- rokade: tårnets skade følger med
    if lower(v_piece) = 'k' and abs(v_fi % 8 - v_ti % 8) = 2 then
      v_rf := case when v_ti % 8 = 6 then 'h' else 'a' end || substr(v_from, 2, 1);
      v_rt := case when v_ti % 8 = 6 then 'f' else 'd' end || substr(v_from, 2, 1);
      v_rd := v_dmg -> v_rf;
      v_dmg := v_dmg - v_rf;
      if v_rd is not null then v_dmg := v_dmg || jsonb_build_object(v_rt, v_rd); end if;
    end if;
    -- forfremmede brikker er friske
    if v_d is not null and nullif(p_move->>'promotion', '') is null
       and not (lower(v_piece) = 'p' and substr(v_to, 2, 1) in ('1', '8')) then
      v_dmg := v_dmg || jsonb_build_object(v_to, v_d);
    end if;
  end if;
  return public.skak_clean_damage(p_new_fen, v_dmg);
end;
$$;

-- Serverens meta for den side der trækker: turns +1, strikes/lastStrikeTurn kan ikke ændres af klienten.
create or replace function public.skak_next_meta(p_old jsonb, p_client jsonb, p_side text, p_struck boolean)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_old jsonb := coalesce(p_old, '{}'::jsonb);
  v_me jsonb := coalesce(v_old -> p_side, '{}'::jsonb);
  v_client jsonb := case when jsonb_typeof(p_client -> p_side) = 'object' then p_client -> p_side else v_me end;
  v_turns int := coalesce((v_me ->> 'turns')::int, 0);
  v_strikes int := coalesce((v_me ->> 'strikes')::int, 0);
  v_last int := (v_me ->> 'lastStrikeTurn')::int;
begin
  return v_old || jsonb_build_object(p_side, v_client || jsonb_build_object(
    'turns', v_turns + 1,
    'strikes', v_strikes + case when p_struck then 1 else 0 end,
    'lastStrikeTurn', case when p_struck then v_turns else v_last end));
end;
$$;

-- ---------- RPC'er ----------
drop function if exists public.create_chess_game();
create or replace function public.create_chess_game(p_nuke boolean default false)
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

  delete from public.chess_games where white_id = v_uid and status = 'waiting';

  for i in 1..20 loop
    v_code := '';
    for j in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into public.chess_games (code, white_id, white_name, meta, nuke, damage)
      values (v_code, v_uid, left(v_name, 80),
        '{"w":{"turns":0,"buys":0,"lastBuyTurn":null,"strikes":0,"lastStrikeTurn":null},"b":{"turns":0,"buys":0,"lastBuyTurn":null,"strikes":0,"lastStrikeTurn":null}}'::jsonb,
        coalesce(p_nuke, false), '{}'::jsonb)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
    end;
  end loop;
  raise exception 'Could not create game code';
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
  v_damage jsonb;
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
  if p_move ? 'strike' then raise exception 'Use submit_chess_strike'; end if;
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' or pg_column_size(p_meta) > 1000 then
    raise exception 'Invalid meta';
  end if;
  if jsonb_array_length(v_row.moves) >= 800 then raise exception 'Game too long'; end if;
  if coalesce(p_status, 'active') not in ('active', 'finished') then raise exception 'Invalid status'; end if;
  if p_status = 'finished' and (p_result is null or p_result not in ('1-0','0-1','1/2-1/2')) then
    raise exception 'Invalid result';
  end if;

  v_damage := case when v_row.nuke then public.skak_move_damage(v_row.fen, p_fen, v_row.damage, p_move) else '{}'::jsonb end;

  update public.chess_games
  set fen = p_fen,
      moves = moves || jsonb_build_array(p_move),
      meta = public.skak_next_meta(v_row.meta, p_meta, v_side, false),
      damage = v_damage,
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

create or replace function public.submit_chess_strike(
  p_game uuid,
  p_version integer,
  p_square text,
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
  v_side text; v_opp text;
  v_tokens text[];
  v_board text[];
  v_idx int; v_piece text; v_type text;
  v_max int; v_dmg int; v_hp int; v_killed boolean;
  v_me jsonb; v_turns int; v_last int; v_since int;
  v_damage jsonb; v_castle text; v_half int; v_full int;
  v_fen text; v_move jsonb;
  c_cooldown constant int := 3; -- SkakCore.STRIKE.cooldownTurns
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_row from public.chess_games where id = p_game for update;
  if not found or v_uid not in (v_row.white_id, coalesce(v_row.black_id, v_row.white_id)) then
    raise exception 'Game not found';
  end if;
  if v_row.status <> 'active' then raise exception 'Game is not active'; end if;
  if not v_row.nuke then raise exception 'Nuclear strike is off'; end if;
  if v_row.version <> p_version then raise exception 'version_conflict'; end if;

  v_tokens := string_to_array(v_row.fen, ' ');
  v_side := v_tokens[2];
  v_opp := case when v_side = 'w' then 'b' else 'w' end;
  if (v_side = 'w' and v_uid <> v_row.white_id) or (v_side = 'b' and v_uid <> v_row.black_id) then
    raise exception 'Not your turn';
  end if;
  if jsonb_array_length(v_row.moves) >= 800 then raise exception 'Game too long'; end if;

  -- cooldown (samme regel som SkakCore.strikeStatus)
  v_me := coalesce(v_row.meta -> v_side, '{}'::jsonb);
  v_turns := coalesce((v_me ->> 'turns')::int, 0);
  v_last := (v_me ->> 'lastStrikeTurn')::int;
  v_since := case when v_last is null then v_turns else v_turns - v_last - 1 end;
  if v_since < c_cooldown then raise exception 'Strike cooling down'; end if;

  v_board := public.skak_board(v_row.fen);
  if public.skak_in_check(v_board, v_side) then raise exception 'Cannot strike while in check'; end if;

  v_idx := public.skak_sq(p_square);
  if v_idx is null then raise exception 'Invalid target'; end if;
  v_piece := v_board[v_idx + 1];
  v_type := lower(v_piece);
  if v_piece = '' or v_type = 'k'
     or (v_side = 'w' and v_piece = upper(v_piece)) or (v_side = 'b' and v_piece = lower(v_piece)) then
    raise exception 'Invalid target';
  end if;

  v_max := public.skak_max_hp(v_piece);
  v_damage := public.skak_clean_damage(v_row.fen, v_row.damage);
  v_dmg := coalesce((v_damage ->> p_square)::int, 0);
  v_hp := v_max - v_dmg - 1;
  v_killed := v_hp <= 0;
  v_half := coalesce(v_tokens[5]::int, 0);
  v_full := coalesce(v_tokens[6]::int, 1);
  v_castle := coalesce(v_tokens[3], '-');

  if v_killed then
    v_board[v_idx + 1] := '';
    v_damage := v_damage - p_square;
    -- et dræbt tårn på sit hjørne fjerner rokaderetten
    if v_piece = 'R' and p_square = 'h1' then v_castle := replace(v_castle, 'K', ''); end if;
    if v_piece = 'R' and p_square = 'a1' then v_castle := replace(v_castle, 'Q', ''); end if;
    if v_piece = 'r' and p_square = 'h8' then v_castle := replace(v_castle, 'k', ''); end if;
    if v_piece = 'r' and p_square = 'a8' then v_castle := replace(v_castle, 'q', ''); end if;
    if v_castle = '' then v_castle := '-'; end if;
    v_half := 0;
  else
    v_damage := v_damage || jsonb_build_object(p_square, v_dmg + 1);
    v_half := v_half + 1;
  end if;
  -- et angreb må aldrig give skak (og dermed heller ikke skakmat)
  if public.skak_in_check(v_board, v_opp) then raise exception 'Strike would give check'; end if;

  if v_side = 'b' then v_full := v_full + 1; end if;
  v_fen := public.skak_placement(v_board) || ' ' || v_opp || ' ' || v_castle || ' - ' || v_half || ' ' || v_full;

  -- et angreb kan kun ende kampen uafgjort (pat / for lidt materiale), aldrig med sejr
  if coalesce(p_status, 'active') not in ('active', 'finished') then raise exception 'Invalid status'; end if;
  if p_status = 'finished' and coalesce(p_result, '') <> '1/2-1/2' then raise exception 'Invalid result'; end if;

  v_move := jsonb_build_object('by', v_side, 'strike', p_square,
    'san', '☢' || case when v_killed then '×' else '' end || p_square,
    'type', v_type, 'killed', v_killed, 'hp', greatest(v_hp, 0), 'max', v_max);

  update public.chess_games
  set fen = v_fen,
      moves = moves || jsonb_build_array(v_move),
      meta = public.skak_next_meta(v_row.meta, null, v_side, true),
      damage = v_damage,
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

-- Hjælpefunktionerne er interne.
revoke all on function public.skak_board(text) from public, anon, authenticated;
revoke all on function public.skak_placement(text[]) from public, anon, authenticated;
revoke all on function public.skak_sq(text) from public, anon, authenticated;
revoke all on function public.skak_sqname(integer) from public, anon, authenticated;
revoke all on function public.skak_attacked(text[], integer, text) from public, anon, authenticated;
revoke all on function public.skak_in_check(text[], text) from public, anon, authenticated;
revoke all on function public.skak_max_hp(text) from public, anon, authenticated;
revoke all on function public.skak_clean_damage(text, jsonb) from public, anon, authenticated;
revoke all on function public.skak_move_damage(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.skak_next_meta(jsonb, jsonb, text, boolean) from public, anon, authenticated;

revoke all on function public.create_chess_game(boolean) from public, anon;
revoke all on function public.submit_chess_move(uuid, integer, text, jsonb, jsonb, text, text, text) from public, anon;
revoke all on function public.submit_chess_strike(uuid, integer, text, text, text, text) from public, anon;
grant execute on function public.create_chess_game(boolean) to authenticated;
grant execute on function public.submit_chess_move(uuid, integer, text, jsonb, jsonb, text, text, text) to authenticated;
grant execute on function public.submit_chess_strike(uuid, integer, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
