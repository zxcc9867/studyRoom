alter table public.study_presence_events
  drop constraint if exists study_presence_events_event_type_check;

alter table public.study_presence_events
  add constraint study_presence_events_event_type_check check (
    event_type in (
      'camera_started',
      'camera_stopped',
      'absence_warning',
      'camera_permission_denied',
      'camera_required_warning'
    )
  );
