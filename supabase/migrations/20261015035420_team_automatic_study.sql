-- Automatic membership contribution. No personal lifecycle or attendance changes.
-- Old private goals are retained; only a new save without a share flag shares a goal.
-- Serialize membership acceptance with the INSERT that makes a new session visible.
-- This lock is deliberately never acquired by UPDATE/resume (which already holds a row).
create function team_study_private.start_membership_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-study-member:'||new.user_id::text,0));
 return new;
end $$;
revoke all on function team_study_private.start_membership_lock() from public,anon,authenticated;
create trigger team_study_start_membership_lock before insert on public.study_sessions
 for each row execute function team_study_private.start_membership_lock();

create function team_study_private.auto_connect(p_session uuid,p_checkpoint boolean default false) returns void
language plpgsql set search_path='' as $$
declare s public.study_sessions%rowtype; t team_study_private.teams%rowtype;
 c team_study_private.connections%rowtype; r team_study_private.rounds%rowtype;
begin
 select * into s from public.study_sessions where id=p_session for update;
 if s.id is null or s.status<>'active' or s.paused_at is not null
  or now()>=coalesce(s.lease_expires_at,s.started_at+interval '1 hour') then return;end if;
 perform 1 from public.study_actual_sessions where session_id=s.id and user_id=s.user_id and current_todo_id is not null for update;
 if not found or not team_study_private.registered(s.user_id) then return;end if;
 select tt.* into t from team_study_private.teams tt join team_study_private.members m on m.team_id=tt.id
  where m.user_id=s.user_id and tt.closed_at is null for update of tt;
 if t.id is null then return;end if;
 select * into c from team_study_private.connections where user_id=s.user_id and ended_at is null;
 -- Never reuse a different session/team or fabricate its end boundary.
 if c.id is not null and (c.session_id<>s.id or c.team_id<>t.id) then return;end if;
 select * into r from team_study_private.rounds where team_id=t.id and closed_at is null and (ends_at is null or ends_at>now());
 if r.id is not null and r.started_at is null then
  update team_study_private.rounds set started_at=now(),ends_at=now()+make_interval(mins=>duration_minutes)where id=r.id returning * into r;
 end if;
 if c.id is null then
  if p_checkpoint then perform team_study_private.checkpoint(s.id,now());end if;
  -- A checkpoint can insert a segment and re-enter this helper through its trigger.
  insert into team_study_private.connections(team_id,user_id,session_id,round_id)
   values(t.id,s.user_id,s.id,r.id) on conflict(user_id)where ended_at is null do nothing;
  perform team_study_private.bump(t.id);
 elsif r.id is not null and c.round_id is distinct from r.id then
  update team_study_private.connections set round_id=r.id where id=c.id;
  perform team_study_private.bump(t.id);
 end if;
end $$;
revoke all on function team_study_private.auto_connect(uuid,boolean) from public,anon,authenticated;

create function team_study_private.segment_auto_connect() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Only the authoritative, open actual-study segment can initiate contribution.
 if new.ended_at is null and not exists(select 1 from team_study_private.connections where session_id=new.session_id and ended_at is null)
  then perform team_study_private.auto_connect(new.session_id);end if;
 return new;
end $$;
revoke all on function team_study_private.segment_auto_connect() from public,anon,authenticated;
create trigger team_study_segment_auto_connect after insert on public.study_todo_segments
 for each row execute function team_study_private.segment_auto_connect();

-- Start inserts precede actual tracking. Emit the start revision only after auto-connect
-- takes the team lock, so the lifecycle never holds signal -> waits for team.
create or replace function team_study_private.session_signal() returns trigger
language plpgsql security definer set search_path='' as $$
declare team uuid;
begin
 if tg_op='INSERT' then return new;end if;
 if old.paused_at is not null and new.paused_at is null and new.status='active'
  and not exists(select 1 from team_study_private.connections where session_id=new.id and ended_at is null)
  then perform team_study_private.auto_connect(new.id);end if;
 if new.status is not distinct from old.status and new.paused_at is not distinct from old.paused_at
  and new.paused_seconds is not distinct from old.paused_seconds
  and (now()<coalesce(new.lease_expires_at,new.started_at+interval '1 hour'))=(now()<coalesce(old.lease_expires_at,old.started_at+interval '1 hour'))then return new;end if;
 if new.status is distinct from old.status and new.status<>'active' then
  update team_study_private.connections set ended_at=greatest(started_at,least(coalesce(new.ended_at,now()),coalesce(new.lease_expires_at,new.started_at+interval '1 hour')))
  where session_id=new.id and ended_at is null;
 end if;
 select team_id into team from team_study_private.members where user_id=new.user_id;
 if team is not null then perform team_study_private.bump(team);end if;
 return new;
end $$;
create or replace function team_study_private.title_signal() returns trigger
language plpgsql security definer set search_path='' as $$
declare team uuid;
begin
 if tg_table_name='study_actual_sessions' then
  if not exists(select 1 from team_study_private.connections where session_id=new.session_id and ended_at is null)
   then perform team_study_private.auto_connect(new.session_id);end if;
  -- Resume's focus is set while still paused. Its AFTER-session hook publishes after connecting.
  if not exists(select 1 from team_study_private.connections where session_id=new.session_id and ended_at is null)then return new;end if;
 end if;
 select team_id into team from team_study_private.members where user_id=new.user_id and share_title;
 if team is not null then perform team_study_private.bump(team);end if;
 return new;
end $$;

create or replace function public.team_study_action(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='10s' as $$
declare u uuid:=auth.uid(); attempts integer; result jsonb; x record; locked_sessions uuid[]:='{}';
begin
 if not team_study_private.registered(u)then return jsonb_build_object('ok',false,'error','ACCOUNT_REQUIRED');end if;
 if p_action is null or p_action not in('set_tag','lookup_tag','create_team','create_invite','revoke_invite','preview_invite','accept_invite','invite_tag','respond_invite','leave_team','set_share_title','set_goal','propose_round','cancel_round','connect','disconnect')then return jsonb_build_object('ok',false,'error','INVALID_ACTION');end if;
 if p_action in('lookup_tag','invite_tag','preview_invite','accept_invite','respond_invite','create_invite','set_tag')then
  insert into team_study_private.rate_limits(user_id,window_at,attempts)values(u,date_trunc('minute',now()),1)
  on conflict(user_id)do update set
   attempts=case when rate_limits.window_at=date_trunc('minute',now())then rate_limits.attempts+1 else 1 end,
   window_at=date_trunc('minute',now())returning rate_limits.attempts into attempts;
  if attempts>20 then return jsonb_build_object('ok',false,'error','RATE_LIMITED');end if;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>4096 then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
 begin
  if p_action in('create_team','accept_invite','respond_invite','propose_round')then
   -- Same identity -> ordered session -> tracking -> team order as existing team mutations.
   insert into team_study_private.identities(user_id)values(u)on conflict do nothing;
   perform 1 from team_study_private.identities where user_id=u for update;
   if p_action in('create_team','accept_invite','respond_invite')then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-study-member:'||u::text,0));
   end if;
   for x in select ss.id from public.study_sessions ss where ss.status='active' and
    (ss.user_id=u or (p_action='propose_round' and ss.user_id in(select user_id from team_study_private.members
      where team_id=(select team_id from team_study_private.members where user_id=u))))order by ss.id for update
   loop
    locked_sessions:=array_append(locked_sessions,x.id);
    perform 1 from public.study_actual_sessions where session_id=x.id for update;
   end loop;
  end if;
  if p_action in('propose_round','set_goal')then
   result:=team_study_private.mutate_focus(u,p_action,
    case when p_action='set_goal' and not(p_payload ? 'share') then p_payload||'{"share":true}'::jsonb else p_payload end);
  elsif p_action='connect' then
   -- Compatibility with older hosted UI; do not recurse through the old checkpoint insert.
   if not exists(select 1 from public.study_sessions s where s.id=(p_payload->>'session_id')::uuid and s.user_id=u
     and s.status='active' and s.paused_at is null and now()<coalesce(s.lease_expires_at,s.started_at+interval '1 hour'))then
    return jsonb_build_object('ok',false,'error','SESSION_REQUIRED');end if;
   if not exists(select 1 from public.study_actual_sessions where session_id=(p_payload->>'session_id')::uuid and current_todo_id is not null)then
    return jsonb_build_object('ok',false,'error','TRACKING_REQUIRED');end if;
   if not exists(select 1 from team_study_private.members where user_id=u)then return jsonb_build_object('ok',false,'error','TEAM_REQUIRED');end if;
   perform team_study_private.auto_connect((p_payload->>'session_id')::uuid,true);
   result:=jsonb_build_object('ok',true);
  else result:=team_study_private.mutate(u,p_action,p_payload);end if;
  if (result->>'ok')::boolean and p_action in('create_team','accept_invite','respond_invite','propose_round')then
   for x in select ss.id from public.study_sessions ss join team_study_private.members m on m.user_id=ss.user_id
    where ss.status='active' and (ss.user_id=u or (p_action='propose_round' and m.team_id=(select team_id from team_study_private.members where user_id=u)))order by ss.id
   loop
    -- A start may commit between prelock and team lock. Never lock it in reverse order.
    -- Raise into the subtransaction handler so the proposal/join is rolled back too.
    if not(x.id=any(locked_sessions))then raise lock_not_available;end if;
    perform team_study_private.auto_connect(x.id,true);
   end loop;
  end if;
 exception
  when unique_violation then return jsonb_build_object('ok',false,'error','CONFLICT');
  when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');
  when lock_not_available or deadlock_detected then return jsonb_build_object('ok',false,'error','RETRY');
 end;
 return result;
end $$;
revoke all on function public.team_study_action(text,jsonb) from public,anon;
grant execute on function public.team_study_action(text,jsonb) to authenticated;

-- Existing active members start at this release checkpoint, not at session start.
-- Lock all candidate sessions before taking any team locks.
do $$declare x record; locked_sessions uuid[]:='{}'; sid uuid;begin
 for x in select ss.id from public.study_sessions ss join team_study_private.members m on m.user_id=ss.user_id
  where ss.status='active' order by ss.id for update of ss
 loop
  locked_sessions:=array_append(locked_sessions,x.id);
  perform 1 from public.study_actual_sessions where session_id=x.id for update;
 end loop;
 foreach sid in array locked_sessions loop perform team_study_private.auto_connect(sid,true);end loop;
end $$;
notify pgrst,'reload schema';
