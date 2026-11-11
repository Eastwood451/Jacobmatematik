-- Stop a deleted teacher profile from cascading into pupil profiles.
-- Pupils must still have a teacher_id, so a teacher who still has pupils
-- cannot be removed. Deleting a pupil's own auth user is unchanged and still
-- cascades to that pupil's profile, results and the pupil's own rows.

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any (con.conkey)
  where nsp.nspname = 'public'
    and rel.relname = 'profiles'
    and con.contype = 'f'
    and att.attname = 'teacher_id';
  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id) on delete restrict;
