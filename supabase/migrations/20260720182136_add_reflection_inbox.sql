drop policy if exists "Users can read their study session reflections"
  on public.study_session_reflections;
drop policy if exists "Users can insert their study session reflections"
  on public.study_session_reflections;
drop policy if exists "Users can update their study session reflections"
  on public.study_session_reflections;
drop policy if exists "Users can read owned session reflections"
  on public.study_session_reflections;
drop policy if exists "Users can insert owned completed session reflections"
  on public.study_session_reflections;
drop policy if exists "Users can update owned completed session reflections"
  on public.study_session_reflections;

create policy "Users can read owned session reflections"
  on public.study_session_reflections
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_sessions as session
      where session.id = study_session_reflections.session_id
        and session.user_id = (select auth.uid())
    )
  );

create policy "Users can insert owned completed session reflections"
  on public.study_session_reflections
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_sessions as session
      where session.id = study_session_reflections.session_id
        and session.user_id = (select auth.uid())
        and session.status = 'completed'
    )
  );

create policy "Users can update owned completed session reflections"
  on public.study_session_reflections
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_sessions as session
      where session.id = study_session_reflections.session_id
        and session.user_id = (select auth.uid())
        and session.status = 'completed'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_sessions as session
      where session.id = study_session_reflections.session_id
        and session.user_id = (select auth.uid())
        and session.status = 'completed'
    )
  );

revoke all on table public.study_session_reflections from public, anon;
revoke all on table public.study_session_reflections from authenticated;
grant select, insert, update on table public.study_session_reflections to authenticated;

comment on table public.study_session_reflections is
  'User-owned study session reflections, including follow-up entries for completed sessions.';
