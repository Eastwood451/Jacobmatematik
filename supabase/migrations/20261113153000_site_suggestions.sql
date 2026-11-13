-- Site-wide suggestions inbox for Jacob (registration administrator).
-- Insert is open to guests and signed-in users via a security-definer RPC.
-- Select/delete is limited to registration administrators (Jacob).
-- Do NOT apply this to production until Jacob gives Go.

begin;

create table if not exists public.site_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint site_suggestions_display_name_len
    check (char_length(display_name) between 1 and 80),
  constraint site_suggestions_message_len
    check (char_length(message) between 1 and 2000)
);

create index if not exists site_suggestions_created_at_idx
  on public.site_suggestions (created_at desc, id desc);

alter table public.site_suggestions enable row level security;
revoke all on table public.site_suggestions from public, anon, authenticated;

-- Guests and signed-in users may only insert through the RPC below.
-- Direct table insert/select/update/delete stay revoked for anon/authenticated.

create or replace function public.submit_site_suggestion(p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
  v_recent integer;
begin
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'Beskeden skal være mellem 1 og 2000 tegn.' using errcode = '22023';
  end if;

  if v_uid is not null then
    select p.username into v_name
    from public.profiles p
    where p.id = v_uid;
    v_name := nullif(btrim(coalesce(v_name, '')), '');
    if v_name is null then
      v_name := 'Gæst';
      v_uid := null;
    end if;

    -- Basic spam protection for signed-in accounts: max 5 suggestions / hour.
    select count(*) into v_recent
    from public.site_suggestions s
    where s.user_id = v_uid
      and s.created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      raise exception 'Du har sendt for mange forslag. Prøv igen senere.' using errcode = 'P0001';
    end if;
  else
    v_name := 'Gæst';
  end if;

  if char_length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;

  insert into public.site_suggestions(user_id, display_name, message)
  values (v_uid, v_name, v_message)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_site_suggestion(text) from public;
grant execute on function public.submit_site_suggestion(text) to anon, authenticated;

create or replace function public.list_site_suggestions()
returns table (
  id uuid,
  display_name text,
  message text,
  created_at timestamptz,
  user_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_self_registered() then
    raise exception 'Kun administratoren har adgang.' using errcode = '42501';
  end if;
  return query
  select s.id, s.display_name, s.message, s.created_at, s.user_id
  from public.site_suggestions s
  order by s.created_at desc, s.id desc
  limit 500;
end;
$$;

revoke all on function public.list_site_suggestions() from public, anon;
grant execute on function public.list_site_suggestions() to authenticated;

create or replace function public.delete_site_suggestion(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if not public.can_manage_self_registered() then
    raise exception 'Kun administratoren har adgang.' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Ugyldigt forslag.' using errcode = '22023';
  end if;
  delete from public.site_suggestions s where s.id = p_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.delete_site_suggestion(uuid) from public, anon;
grant execute on function public.delete_site_suggestion(uuid) to authenticated;

commit;
