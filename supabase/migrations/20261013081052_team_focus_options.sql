-- Additive focus options and explicit team-only goal sharing.
-- Personal lifecycle, membership and accepted-time policies are unchanged.
-- Rollback: restore the previous web deployment; retain added columns/data.
alter table team_study_private.rounds alter column duration_minutes drop not null;
alter table team_study_private.rounds drop constraint rounds_duration_minutes_check;
alter table team_study_private.rounds add constraint rounds_duration_minutes_check
 check(duration_minutes is null or duration_minutes between 1 and 1440);
alter table team_study_private.members add column goal text check(goal is null or length(goal)<=160);
alter table team_study_private.members add column share_goal boolean not null default false;

create function team_study_private.mutate_focus(p_user uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare t team_study_private.teams%rowtype; minutes integer; goal_value text;
begin
 insert into team_study_private.identities(user_id)values(p_user)on conflict do nothing;
 perform 1 from team_study_private.identities where user_id=p_user for update;
 select tt.* into t from team_study_private.teams tt join team_study_private.members m on m.team_id=tt.id
 where m.user_id=p_user and tt.closed_at is null for update of tt;
 if t.id is null then return jsonb_build_object('ok',false,'error','TEAM_REQUIRED');end if;
 if p_action='propose_round' then
  if not(p_payload ? 'duration_minutes') or jsonb_typeof(p_payload->'duration_minutes') not in('number','null') then
   return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
  if jsonb_typeof(p_payload->'duration_minutes')='number' then
   if (p_payload->>'duration_minutes')::numeric<>trunc((p_payload->>'duration_minutes')::numeric)
    or (p_payload->>'duration_minutes')::numeric not between 1 and 1440 then
    return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
   minutes:=(p_payload->>'duration_minutes')::numeric::integer;
  end if;
  update team_study_private.rounds set closed_at=now()where team_id=t.id and closed_at is null and ends_at<=now();
  if exists(select 1 from team_study_private.rounds where team_id=t.id and closed_at is null)then
   return jsonb_build_object('ok',false,'error','ROUND_EXISTS');end if;
  insert into team_study_private.rounds(team_id,duration_minutes,proposed_by)values(t.id,minutes,p_user);
 elsif p_action='set_goal' then
  if jsonb_typeof(p_payload->'share') is distinct from 'boolean' or not(p_payload ? 'goal')
   or jsonb_typeof(p_payload->'goal') not in('string','null') then
   return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
  goal_value:=nullif(btrim(p_payload->>'goal'),'');
  if length(goal_value)>160 then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
  update team_study_private.members set goal=goal_value,share_goal=(p_payload->>'share')::boolean where user_id=p_user;
 else return jsonb_build_object('ok',false,'error','INVALID_ACTION');end if;
 perform team_study_private.bump(t.id);
 return jsonb_build_object('ok',true,'team_id',t.id);
end $$;
revoke all on function team_study_private.mutate_focus(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.team_study_action(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='10s' as $$
declare u uuid:=auth.uid(); attempts integer; result jsonb;
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
  if p_action in('propose_round','set_goal')then result:=team_study_private.mutate_focus(u,p_action,p_payload);
  else result:=team_study_private.mutate(u,p_action,p_payload);end if;
 exception
  when unique_violation then return jsonb_build_object('ok',false,'error','CONFLICT');
  when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');
  when lock_not_available or deadlock_detected then return jsonb_build_object('ok',false,'error','RETRY');
 end;
 return result;
end $$;

create or replace function public.team_study_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); t team_study_private.teams%rowtype; tag_value text; members jsonb:='[]'; invites jsonb; invite_links jsonb:='[]'; round_value jsonb; connection_value jsonb; accepted bigint:=0; pending integer:=0;
begin
 if not team_study_private.registered(u)then return jsonb_build_object('ok',false,'error','ACCOUNT_REQUIRED');end if;
 select tag into tag_value from team_study_private.identities where user_id=u;
 select tt.* into t from team_study_private.teams tt join team_study_private.members m on m.team_id=tt.id where m.user_id=u and tt.closed_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'team_name',tt.name,'member_count',(select count(*)from team_study_private.members where team_id=tt.id),'expires_at',i.expires_at)order by i.created_at),'[]')into invites
 from team_study_private.invitations i join team_study_private.teams tt on tt.id=i.team_id
 where i.recipient_id=u and i.responded_at is null and i.revoked_at is null and i.expires_at>now()and tt.closed_at is null;
 if t.id is not null then
  if t.owner_id=u then
   select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'expires_at',i.expires_at)order by i.created_at),'[]')into invite_links
   from team_study_private.invitations i where i.team_id=t.id and i.recipient_id is null and i.revoked_at is null and i.expires_at>now();
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',coalesce(split_part(i.tag,'#',1),'팀원'),
   'state',case when ss.id is null then 'ready' when ss.paused_at is not null then 'resting' else 'studying'end,
   'title',case when m.share_title and ss.id is not null then todo.title end,'share_title',m.share_title,
   'goal',case when m.user_id=u or m.share_goal then m.goal end,'share_goal',m.share_goal,
   'started_at',ss.started_at,'paused_seconds',coalesce(ss.paused_seconds,0),'paused_at',ss.paused_at)order by m.joined_at,m.user_id),'[]')into members
  from team_study_private.members m left join team_study_private.identities i on i.user_id=m.user_id
  left join public.study_sessions ss on ss.user_id=m.user_id and ss.status='active' and now()<coalesce(ss.lease_expires_at,ss.started_at+interval '1 hour')
  left join public.study_actual_sessions a on a.session_id=ss.id
  left join public.study_todos todo on todo.id=a.current_todo_id and todo.user_id=m.user_id where m.team_id=t.id;
  select jsonb_build_object('id',r.id,'duration_minutes',r.duration_minutes,'proposed_by',r.proposed_by,'started_at',r.started_at,'ends_at',r.ends_at,
    'joined',exists(select 1 from team_study_private.connections c where c.user_id=u and c.round_id=r.id and c.ended_at is null))into round_value
  from team_study_private.rounds r where r.team_id=t.id and r.closed_at is null;
  select jsonb_build_object('id',c.id,'session_id',c.session_id)into connection_value from team_study_private.connections c
  join public.study_sessions ss on ss.id=c.session_id where c.team_id=t.id and c.user_id=u and c.ended_at is null and ss.status='active'
  and now()<coalesce(ss.lease_expires_at,ss.started_at+interval '1 hour');
  with linked as(
   select distinct g.id,g.session_id,g.accepted_seconds from team_study_private.connections c
   join public.study_sessions ss on ss.id=c.session_id and ss.user_id=c.user_id
   join public.study_todo_segments g on g.session_id=ss.id and g.user_id=c.user_id
   where c.team_id=t.id and ss.status<>'active' and ss.ended_at is not null and g.ended_at is not null
    and g.started_at>=c.started_at and g.ended_at<=least(coalesce(c.ended_at,ss.ended_at),ss.ended_at,coalesce(ss.lease_expires_at,ss.started_at+interval '1 hour'))
  ), per_session as(select l.session_id,least(sum(l.accepted_seconds),greatest(0,ss.duration_seconds)) seconds
    from linked l join public.study_sessions ss on ss.id=l.session_id group by l.session_id,ss.duration_seconds)
  select coalesce(sum(seconds),0)into accepted from per_session;
  select count(distinct c.session_id)::integer into pending from team_study_private.connections c join public.study_sessions ss on ss.id=c.session_id
  where c.team_id=t.id and ss.status='active';
 end if;
 return jsonb_build_object('tag',tag_value,'team',case when t.id is not null then jsonb_build_object('id',t.id,'name',t.name,'owner_id',t.owner_id,'time_zone',t.time_zone,'member_count',jsonb_array_length(members))end,
  'members',members,'invitations',invites,'invite_links',invite_links,'round',round_value,'connection',connection_value,
  'forest',jsonb_build_object('accepted_seconds',accepted,'pending_sessions',pending,'trees',accepted/7200,'progress_seconds',accepted%7200),'server_now',now());
end $$;
revoke all on function public.team_study_action(text,jsonb),public.team_study_snapshot() from public,anon;
grant execute on function public.team_study_action(text,jsonb),public.team_study_snapshot() to authenticated;
notify pgrst,'reload schema';
