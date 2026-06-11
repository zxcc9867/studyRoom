insert into public.attendance_days (
  user_id,
  local_date,
  status,
  reminder_at,
  deadline_at,
  qualifying_session_id,
  marked_at
)
select distinct on (ss.user_id, ss.local_date)
  ss.user_id,
  ss.local_date,
  'present',
  public.local_reminder_at(ss.local_date, p.reminder_time, p.time_zone),
  public.local_reminder_at(ss.local_date, p.reminder_time, p.time_zone) + interval '15 minutes',
  ss.id,
  ss.started_at
from public.study_sessions ss
join public.profiles p on p.user_id = ss.user_id
where ss.status in ('active', 'completed')
order by ss.user_id, ss.local_date, ss.started_at asc
on conflict (user_id, local_date) do update
  set status = 'present',
      reminder_at = excluded.reminder_at,
      deadline_at = excluded.deadline_at,
      qualifying_session_id = coalesce(public.attendance_days.qualifying_session_id, excluded.qualifying_session_id),
      marked_at = least(public.attendance_days.marked_at, excluded.marked_at);
