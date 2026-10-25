-- Deploy this preparation first, then both new Edge functions; drain old workers before applying the attendance policy.
-- Recheck the canonical attendance inside the same transaction as recovery creation.
create function public.ensure_missed_attendance_recovery(p_user_id uuid,p_local_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; rr public.study_recovery_requests%rowtype; made boolean:=false;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('attendance-start:'||p_user_id::text,0));
  select * into p from public.profiles where user_id=p_user_id;
  if not found or p_local_date>=public.study_day_at(now(),p.time_zone) then
    return jsonb_build_object('request',null,'created',false); end if;
  perform 1 from public.attendance_days ad where ad.user_id=p_user_id and ad.local_date=p_local_date and ad.status='missed' for update;
  if not found then return jsonb_build_object('request',null,'created',false); end if;
  select * into rr from public.study_recovery_requests s where s.user_id=p_user_id
    and s.trigger_type='missed_attendance' and s.status='pending' for update;
  if found then
    if p_local_date<rr.covered_start_date or p_local_date>rr.covered_end_date then
      update public.study_recovery_requests s set covered_start_date=least(s.covered_start_date,p_local_date),
        covered_end_date=greatest(s.covered_end_date,p_local_date),covered_missed_days=s.covered_missed_days+1
        where s.id=rr.id and s.status='pending' returning s.* into rr;
    end if;
  else
    if exists(select 1 from public.study_recovery_requests s where s.user_id=p_user_id and s.trigger_type='missed_attendance'
      and s.status='submitted' and p_local_date between s.covered_start_date and s.covered_end_date) then
      return jsonb_build_object('request',null,'created',false); end if;
    insert into public.study_recovery_requests(user_id,local_date,trigger_type,status,covered_start_date,covered_end_date,covered_missed_days)
      values(p_user_id,p_local_date,'missed_attendance','pending',p_local_date,p_local_date,1) returning * into rr;
    made:=true;
  end if;
  return jsonb_build_object('request',to_jsonb(rr),'created',made);
end; $$;
revoke all on function public.ensure_missed_attendance_recovery(uuid,date) from public,anon,authenticated;
grant execute on function public.ensure_missed_attendance_recovery(uuid,date) to service_role;

create or replace function public.submit_slack_study_recovery_request(
  p_request_id uuid,
  p_user_id uuid,
  p_slack_submitter_id text,
  p_reason text,
  p_makeup_todo_title text,
  p_pledge_todo_title text
)
returns public.study_recovery_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
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
    return v_request; -- resolved/submitted stale modal: no todo and no rewrite
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
      slack_submitter_id = p_slack_submitter_id,
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
revoke all on function public.submit_slack_study_recovery_request(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_slack_study_recovery_request(uuid,uuid,text,text,text,text) to service_role;

notify pgrst,'reload schema';
