begin;
-- Registration origin is not a storage policy: preserve existing class students.
alter table public.profiles add column local_results_only boolean not null default false;
update public.profiles p set local_results_only = true
where p.role='student' and p.self_registered and not exists (
 select 1 from public.school_state s
 cross join lateral jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) u
 join lateral jsonb_array_elements(coalesce(s.data->'classes','[]'::jsonb)) c on c->>'id'=u->>'classId'
 where s.teacher_id=p.teacher_id and u->>'id'=p.id::text
);
comment on column public.profiles.local_results_only is 'Server-controlled storage policy. Existing enrolled students retain central results regardless of registration origin. New self registrations are device-only.';

do $migration$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
 and p.proname in ('submit_fps_score_internal','get_my_fps_highscore_internal','get_fps_leaderboard_internal','practice_leaderboard_context','get_practice_leaderboard_internal','get_my_practice_leaderboard_status_internal','set_practice_leaderboard_consent_internal','get_practice_topic_leaderboard_internal','get_teacher_practice_topic_leaderboard_internal')
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(replace(definition,'not p.self_registered','not p.local_results_only'),'not self_registered','not local_results_only');
  execute definition;
 end loop;
 definition:=pg_get_functiondef('public.create_self_registered_profile()'::regprocedure);
 if position('name, self_registered)' in definition)=0 then raise exception 'Unexpected signup function'; end if;
 definition:=replace(definition,'name, self_registered)','name, self_registered, local_results_only)');
 definition:=replace(definition,'chosen_username, chosen_username, true);','chosen_username, chosen_username, true, true);');
 execute definition;
end;
$migration$;
alter policy "Student records own result" on public.results with check (
 student_id=(select auth.uid()) and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='student' and not p.local_results_only and p.teacher_id is not null)
);
alter policy "Only teacher-created results are visible" on public.results using (
 exists (select 1 from public.profiles p where p.id=results.student_id and p.role='student' and p.teacher_id is not null and (not p.local_results_only or p.teacher_id=(select auth.uid())))
);
commit;
