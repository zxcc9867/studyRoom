create or replace function public.get_due_reminders(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  time_zone text,
  local_date date,
  reminder_at timestamptz,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select
      p.user_id,
      p.email,
      p.time_zone,
      (p_now at time zone p.time_zone)::date as local_date,
      public.local_reminder_at((p_now at time zone p.time_zone)::date, p.reminder_time, p.time_zone) as reminder_at
    from public.profiles p
  ),
  due_now as (
    select
      d.user_id,
      d.email,
      d.time_zone,
      d.local_date,
      d.reminder_at,
      d.reminder_at + interval '15 minutes' as deadline_at
    from due d
    where p_now >= d.reminder_at
      and p_now < d.reminder_at + interval '1 minute'
      and not exists (
        select 1
        from public.attendance_days ad
        where ad.user_id = d.user_id
          and ad.local_date = d.local_date
          and ad.status in ('present', 'missed')
      )
  )
  insert into public.attendance_days (user_id, local_date, status, reminder_at, deadline_at, marked_at)
  select dn.user_id, dn.local_date, 'pending', dn.reminder_at, dn.deadline_at, p_now
  from due_now dn
  on conflict on constraint attendance_days_pkey do update
    set reminder_at = excluded.reminder_at,
        deadline_at = excluded.deadline_at,
        marked_at = excluded.marked_at
  returning attendance_days.user_id,
            (select profiles.email from public.profiles where profiles.user_id = attendance_days.user_id),
            (select profiles.time_zone from public.profiles where profiles.user_id = attendance_days.user_id),
            attendance_days.local_date,
            attendance_days.reminder_at,
            attendance_days.deadline_at;
end;
$$;

grant execute on function public.get_due_reminders(timestamptz) to service_role;
