-- consolidate_pending_attendance_recovery
-- Keep one active recovery routine for all unresolved attendance misses.

alter table public.study_recovery_requests
  add column if not exists covered_start_date date,
  add column if not exists covered_end_date date,
  add column if not exists covered_missed_days integer,
  add column if not exists consolidated_into_id uuid references public.study_recovery_requests(id),
  add column if not exists consolidated_at timestamptz;

update public.study_recovery_requests
set covered_start_date = coalesce(covered_start_date, local_date),
    covered_end_date = coalesce(covered_end_date, local_date),
    covered_missed_days = coalesce(covered_missed_days, 1)
where covered_start_date is null
   or covered_end_date is null
   or covered_missed_days is null;

alter table public.study_recovery_requests
  alter column covered_start_date set not null,
  alter column covered_end_date set not null,
  alter column covered_missed_days set not null,
  alter column covered_start_date set default current_date,
  alter column covered_end_date set default current_date,
  alter column covered_missed_days set default 1;

alter table public.study_recovery_requests
  drop constraint if exists study_recovery_requests_status_check;

alter table public.study_recovery_requests
  add constraint study_recovery_requests_status_check
  check (status in ('pending', 'submitted', 'consolidated'));

alter table public.study_recovery_requests
  drop constraint if exists study_recovery_requests_coverage_dates_check;

alter table public.study_recovery_requests
  add constraint study_recovery_requests_coverage_dates_check
  check (
    covered_start_date <= covered_end_date
    and covered_missed_days >= 1
  );

with pending_attendance as (
  select
    recovery.id,
    min(recovery.local_date) over (partition by recovery.user_id) as coverage_start_date,
    max(recovery.local_date) over (partition by recovery.user_id) as coverage_end_date,
    count(*) over (partition by recovery.user_id)::integer as coverage_missed_days,
    first_value(recovery.id) over (
      partition by recovery.user_id
      order by recovery.local_date asc, recovery.created_at asc, recovery.id asc
    ) as primary_id
  from public.study_recovery_requests recovery
  where recovery.status = 'pending'
    and recovery.trigger_type = 'missed_attendance'
)
update public.study_recovery_requests recovery
set covered_start_date = pending_attendance.coverage_start_date,
    covered_end_date = pending_attendance.coverage_end_date,
    covered_missed_days = pending_attendance.coverage_missed_days,
    status = case
      when recovery.id = pending_attendance.primary_id then 'pending'
      else 'consolidated'
    end,
    consolidated_into_id = case
      when recovery.id = pending_attendance.primary_id then null
      else pending_attendance.primary_id
    end,
    consolidated_at = case
      when recovery.id = pending_attendance.primary_id then null
      else now()
    end
from pending_attendance
where recovery.id = pending_attendance.id;

-- one_pending_attendance: protects the aggregate against concurrent cron runs.
create unique index if not exists study_recovery_requests_one_pending_attendance_idx
  on public.study_recovery_requests (user_id)
  where status = 'pending'
    and trigger_type = 'missed_attendance';

create or replace function public.submit_study_recovery_request(
  p_request_id uuid,
  p_reason text,
  p_makeup_todo_title text,
  p_pledge_todo_title text
)
returns public.study_recovery_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.study_recovery_requests%rowtype;
  v_updated public.study_recovery_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_makeup_title text := nullif(btrim(coalesce(p_makeup_todo_title, '')), '');
  v_pledge_title text := nullif(btrim(coalesce(p_pledge_todo_title, '')), '');
  v_makeup_todo_id uuid;
  v_makeup_position integer;
  v_time_zone text;
  v_makeup_local_date date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_reason is null then
    raise exception 'Recovery reason is required';
  end if;
  if length(v_reason) > 400 then
    raise exception 'Recovery reason must be 400 characters or fewer';
  end if;
  if v_makeup_title is null then
    raise exception 'Makeup todo title is required';
  end if;
  if length(v_makeup_title) > 120 then
    raise exception 'Makeup todo title must be 120 characters or fewer';
  end if;
  if v_pledge_title is null then
    raise exception 'Pledge is required';
  end if;
  if length(v_pledge_title) > 120 then
    raise exception 'Pledge must be 120 characters or fewer';
  end if;

  select * into v_request
  from public.study_recovery_requests
  where id = p_request_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Recovery request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Recovery request already submitted';
  end if;

  select time_zone into v_time_zone
  from public.profiles
  where user_id = v_user_id;
  v_makeup_local_date := (now() at time zone coalesce(nullif(v_time_zone, ''), 'Asia/Seoul'))::date;

  select coalesce(max(position), -1) + 1 into v_makeup_position
  from public.study_todos
  where user_id = v_user_id
    and local_date = v_makeup_local_date;

  insert into public.study_todos (user_id, local_date, title, position)
  values (v_user_id, v_makeup_local_date, v_makeup_title, v_makeup_position)
  returning id into v_makeup_todo_id;

  update public.study_recovery_requests
  set status = 'submitted',
      reason = v_reason,
      makeup_todo_title = v_makeup_title,
      pledge_todo_title = v_pledge_title,
      makeup_todo_id = v_makeup_todo_id,
      pledge_todo_id = null,
      submitted_at = now()
  where id = v_request.id
    and user_id = v_user_id
    and status = 'pending'
  returning * into v_updated;

  if not found then
    raise exception 'Recovery request already submitted';
  end if;
  return v_updated;
end;
$$;

revoke all on function public.submit_study_recovery_request(uuid, text, text, text) from public;
revoke all on function public.submit_study_recovery_request(uuid, text, text, text) from anon;
grant execute on function public.submit_study_recovery_request(uuid, text, text, text) to authenticated;
