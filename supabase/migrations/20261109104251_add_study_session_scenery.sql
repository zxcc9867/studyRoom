create table public.study_session_scenery (
  session_id uuid primary key references public.study_sessions (id) on delete cascade,
  theme_id text not null,
  constraint study_session_scenery_theme_id_check
    check (theme_id collate "C" ~ '^[a-z][a-z0-9-]{0,47}$')
);

alter table public.study_session_scenery enable row level security;

revoke all on table public.study_session_scenery from public, anon, authenticated, service_role;
grant select, insert, update on table public.study_session_scenery to authenticated;

create policy "Active session owner can read scenery"
  on public.study_session_scenery for select to authenticated
  using (exists (
    select 1
    from public.study_sessions as session
    where session.id = study_session_scenery.session_id
      and (select auth.uid()) = session.user_id
      and session.status = 'active'
      and session.ended_at is null
  ));

create policy "Active session owner can insert scenery"
  on public.study_session_scenery for insert to authenticated
  with check (exists (
    select 1
    from public.study_sessions as session
    where session.id = study_session_scenery.session_id
      and (select auth.uid()) = session.user_id
      and session.status = 'active'
      and session.ended_at is null
  ));

create policy "Active session owner can update scenery"
  on public.study_session_scenery for update to authenticated
  using (exists (
    select 1
    from public.study_sessions as session
    where session.id = study_session_scenery.session_id
      and (select auth.uid()) = session.user_id
      and session.status = 'active'
      and session.ended_at is null
  ))
  with check (exists (
    select 1
    from public.study_sessions as session
    where session.id = study_session_scenery.session_id
      and (select auth.uid()) = session.user_id
      and session.status = 'active'
      and session.ended_at is null
  ));
