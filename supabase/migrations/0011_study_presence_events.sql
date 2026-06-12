create table if not exists public.study_presence_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  event_type text not null,
  absence_seconds integer not null default 0,
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint study_presence_events_event_type_check check (
    event_type in ('camera_started', 'camera_stopped', 'absence_warning', 'camera_permission_denied')
  ),
  constraint study_presence_events_absence_seconds_check check (absence_seconds >= 0),
  constraint study_presence_events_metadata_no_media_check check (
    not (metadata ? 'image')
    and not (metadata ? 'video')
    and not (metadata ? 'frame')
    and not (metadata ? 'faceEmbedding')
    and not (metadata ? 'landmarks')
  )
);

create index if not exists study_presence_events_user_detected_idx
  on public.study_presence_events (user_id, detected_at desc);

create index if not exists study_presence_events_session_detected_idx
  on public.study_presence_events (session_id, detected_at desc);

alter table public.study_presence_events enable row level security;

drop policy if exists "Users can read their study presence events" on public.study_presence_events;
create policy "Users can read their study presence events"
  on public.study_presence_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their study presence events" on public.study_presence_events;
create policy "Users can insert their study presence events"
  on public.study_presence_events for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.study_sessions ss
      where ss.id = session_id
        and ss.user_id = auth.uid()
    )
  );

grant select, insert on public.study_presence_events to authenticated;
