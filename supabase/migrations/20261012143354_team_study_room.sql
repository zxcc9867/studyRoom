-- Additive team boundary. Personal lifecycle and accepted-study functions remain authoritative.
create schema team_study_private;
revoke all on schema team_study_private from public,anon,authenticated;

create table team_study_private.identities (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tag text unique check(tag is null or tag ~ '^[a-z0-9가-힣_-]{2,20}#[a-z0-9가-힣_-]{2,20}$')
);
create table team_study_private.teams (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 60),
 owner_id uuid not null references auth.users(id),time_zone text not null default 'Asia/Tokyo',
 created_at timestamptz not null default now(),closed_at timestamptz
);
create table team_study_private.members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 team_id uuid not null references team_study_private.teams(id),
 share_title boolean not null default false,joined_at timestamptz not null default now()
);
create index team_study_members_team on team_study_private.members(team_id);
create table team_study_private.invitations (
 id uuid primary key default gen_random_uuid(),team_id uuid not null references team_study_private.teams(id),
 issued_by uuid not null references auth.users(id),recipient_id uuid references auth.users(id),
 token_hash text unique,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,responded_at timestamptz,accepted boolean,
 check((recipient_id is null)<>(token_hash is null))
);
create index team_study_invites_recipient on team_study_private.invitations(recipient_id) where responded_at is null and revoked_at is null;
create table team_study_private.rounds (
 id uuid primary key default gen_random_uuid(),team_id uuid not null references team_study_private.teams(id),
 duration_minutes integer not null check(duration_minutes in(25,50)),proposed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),started_at timestamptz,ends_at timestamptz,closed_at timestamptz
);
create unique index team_study_one_round on team_study_private.rounds(team_id) where closed_at is null;
create table team_study_private.connections (
 id uuid primary key default gen_random_uuid(),team_id uuid not null references team_study_private.teams(id),
 user_id uuid not null references auth.users(id),session_id uuid not null,
 round_id uuid references team_study_private.rounds(id),started_at timestamptz not null default now(),ended_at timestamptz,
 foreign key(session_id,user_id) references public.study_sessions(id,user_id) on delete cascade,
 check(ended_at is null or ended_at>=started_at)
);
create unique index team_study_one_connection on team_study_private.connections(user_id) where ended_at is null;
create index team_study_connections_forest on team_study_private.connections(team_id,session_id,started_at);
create table team_study_private.rate_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,window_at timestamptz not null,attempts integer not null
);
create table public.team_study_signals (
 team_id uuid primary key references team_study_private.teams(id),revision bigint not null default 1
);
alter table public.team_study_signals enable row level security;
revoke all on public.team_study_signals from public,anon,authenticated;
grant select on public.team_study_signals to authenticated;

create function team_study_private.registered(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from auth.users where id=p_user and is_anonymous is false)
$$;
create function team_study_private.is_member(p_team uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user=(select auth.uid()) and team_study_private.registered(p_user) and exists(select 1 from team_study_private.members m
 join team_study_private.teams t on t.id=m.team_id where m.team_id=p_team and m.user_id=p_user and t.closed_at is null)
$$;
-- RLS helper is the only private function with schema usage exposed; no raw data reads.
grant usage on schema team_study_private to authenticated;
revoke all on function team_study_private.is_member(uuid,uuid) from public,anon;
grant execute on function team_study_private.is_member(uuid,uuid) to authenticated;
create policy member_read on public.team_study_signals for select to authenticated
 using(team_study_private.is_member(team_id,(select auth.uid())));

create function team_study_private.bump(p_team uuid) returns void
language sql set search_path='' as $$
 insert into public.team_study_signals(team_id,revision) values(p_team,1)
 on conflict(team_id) do update set revision=team_study_signals.revision+1
$$;
create function team_study_private.checkpoint(p_session uuid,p_at timestamptz) returns void
language plpgsql set search_path='' as $$
declare s public.study_sessions%rowtype; a public.study_actual_sessions%rowtype; boundary timestamptz;
begin
 select * into s from public.study_sessions where id=p_session for update;
 select * into a from public.study_actual_sessions where session_id=s.id for update;
 if a.session_id is null or s.status<>'active' then return; end if;
 boundary:=least(p_at,coalesce(s.paused_at,p_at),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'));
 perform actual_study_private.close_segment(s.id,boundary);
 if s.paused_at is null and p_at<coalesce(s.lease_expires_at,s.started_at+interval '1 hour') and a.current_todo_id is not null then
  insert into public.study_todo_segments(user_id,session_id,todo_id,started_at) values(s.user_id,s.id,a.current_todo_id,p_at);
 end if;
end $$;

create function team_study_private.connections_prelocked(p_team uuid,p_sessions uuid[]) returns boolean
language sql stable set search_path='' as $$
 select not exists(select 1 from team_study_private.connections c where c.team_id=p_team and c.ended_at is null
  and not(c.session_id=any(coalesce(p_sessions,'{}'::uuid[]))))
$$;

create function team_study_private.mutate(p_user uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare
 t team_study_private.teams%rowtype; m team_study_private.members%rowtype; i team_study_private.invitations%rowtype;
 r team_study_private.rounds%rowtype; c team_study_private.connections%rowtype; s public.study_sessions%rowtype;
 tag_value text; token text; recipient uuid; successor uuid; n integer; x record; locked_sessions uuid[]:='{}';
begin
 -- Per-account lock prevents competing joins across distinct teams; never used by personal sessions.
 insert into team_study_private.identities(user_id)values(p_user)on conflict do nothing;
 perform 1 from team_study_private.identities where user_id=p_user for update;
 if p_action in('connect','disconnect','leave_team') then
  -- Personal lifecycle locks session -> tracking -> signal. Acquire session before team/signal too.
  for x in select ss.id from public.study_sessions ss where
    (ss.user_id=p_user and (ss.id=nullif(p_payload->>'session_id','')::uuid or ss.status='active'))
    or ss.id in(select cc.session_id from team_study_private.connections cc
      where cc.ended_at is null and cc.team_id=(select team_id from team_study_private.members where user_id=p_user))
    order by ss.id for update
  loop locked_sessions:=array_append(locked_sessions,x.id); end loop;
 end if;
 select * into m from team_study_private.members where user_id=p_user;
 select * into t from team_study_private.teams where id=m.team_id and closed_at is null for update;

 if p_action='set_tag' then
  tag_value:=lower(btrim(p_payload->>'tag'));
  if tag_value is null or tag_value !~ '^[a-z0-9가-힣_-]{2,20}#[a-z0-9가-힣_-]{2,20}$' then return jsonb_build_object('ok',false,'error','INVALID_TAG');end if;
  update team_study_private.identities set tag=tag_value where user_id=p_user;
  if t.id is not null then perform team_study_private.bump(t.id);end if;
  return jsonb_build_object('ok',true,'tag',tag_value);
 elsif p_action='lookup_tag' then
  tag_value:=lower(btrim(p_payload->>'tag'));
  if tag_value is null or tag_value !~ '^[a-z0-9가-힣_-]{2,20}#[a-z0-9가-힣_-]{2,20}$' then return jsonb_build_object('ok',false,'error','INVALID_TAG');end if;
  select user_id into recipient from team_study_private.identities where tag=tag_value;
  if recipient is null or not team_study_private.registered(recipient) then return jsonb_build_object('ok',false,'error','TAG_NOT_FOUND');end if;
  return jsonb_build_object('ok',true,'tag',tag_value,'display_name',split_part(tag_value,'#',1));
 elsif p_action='create_team' then
  if t.id is not null then return jsonb_build_object('ok',false,'error','ALREADY_IN_TEAM');end if;
  if length(btrim(coalesce(p_payload->>'name',''))) not between 1 and 60
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=coalesce(p_payload->>'time_zone','Asia/Tokyo')) then
   return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
  insert into team_study_private.teams(name,owner_id,time_zone)values(btrim(p_payload->>'name'),p_user,coalesce(p_payload->>'time_zone','Asia/Tokyo'))returning * into t;
  insert into team_study_private.members(user_id,team_id)values(p_user,t.id);
 elsif p_action in('preview_invite','accept_invite','respond_invite') then
  if p_action='respond_invite' then
   select * into i from team_study_private.invitations where id=(p_payload->>'invite_id')::uuid and recipient_id=p_user;
  else
   token:=p_payload->>'token';
   if token is null or token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'error','INVITE_INVALID');end if;
   select * into i from team_study_private.invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and recipient_id is null;
  end if;
  if p_action='respond_invite' and i.responded_at is not null and i.revoked_at is null and i.expires_at>now()
   and jsonb_typeof(p_payload->'accept')='boolean' and (p_payload->>'accept')::boolean=i.accepted
   and (i.accepted is false or m.team_id=i.team_id)then return jsonb_build_object('ok',true);end if;
  if i.id is null or i.revoked_at is not null or i.responded_at is not null or i.expires_at<=now() then return jsonb_build_object('ok',false,'error','INVITE_INVALID');end if;
  -- Preview does not lock or join. Accept locks team then rechecks invitation under that lock.
  select * into t from team_study_private.teams where id=i.team_id and closed_at is null for update;
  select * into i from team_study_private.invitations where id=i.id;
  if t.id is null or i.revoked_at is not null or i.responded_at is not null or i.expires_at<=now() then return jsonb_build_object('ok',false,'error','INVITE_INVALID');end if;
  select count(*) into n from team_study_private.members where team_id=t.id;
  if p_action='preview_invite' then return jsonb_build_object('ok',true,'team',jsonb_build_object('id',t.id,'name',t.name,'member_count',n),'expires_at',i.expires_at);end if;
  if p_action='respond_invite' and jsonb_typeof(p_payload->'accept') is distinct from 'boolean' then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
  if p_action='respond_invite' and (p_payload->>'accept')::boolean is false then
   update team_study_private.invitations set responded_at=now(),accepted=false where id=i.id;
   return jsonb_build_object('ok',true);
  end if;
  if m.team_id=t.id then
   if p_action='respond_invite' then update team_study_private.invitations set responded_at=now(),accepted=true where id=i.id;end if;
   return jsonb_build_object('ok',true,'team_id',t.id);
  end if;
  if m.team_id is not null then return jsonb_build_object('ok',false,'error','ALREADY_IN_TEAM');end if;
  if n>=6 then return jsonb_build_object('ok',false,'error','TEAM_FULL');end if;
  insert into team_study_private.members(user_id,team_id)values(p_user,t.id);
  if p_action='respond_invite' then update team_study_private.invitations set responded_at=now(),accepted=true where id=i.id;end if;
 else
  if t.id is null then return jsonb_build_object('ok',false,'error','TEAM_REQUIRED');end if;
  if p_action in('create_invite','revoke_invite') and t.owner_id<>p_user then return jsonb_build_object('ok',false,'error','OWNER_REQUIRED');end if;
  if p_action='create_invite' then
   token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   insert into team_study_private.invitations(team_id,issued_by,token_hash)values(t.id,p_user,encode(sha256(convert_to(token,'UTF8')),'hex'))returning * into i;
   perform team_study_private.bump(t.id);
   return jsonb_build_object('ok',true,'token',token,'invite_id',i.id,'expires_at',i.expires_at);
  elsif p_action='revoke_invite' then
   update team_study_private.invitations set revoked_at=coalesce(revoked_at,now())where id=(p_payload->>'invite_id')::uuid and team_id=t.id;
   if not found then return jsonb_build_object('ok',false,'error','INVITE_INVALID');end if;
  elsif p_action='invite_tag' then
   tag_value:=lower(btrim(p_payload->>'tag'));
   if tag_value is null or tag_value !~ '^[a-z0-9가-힣_-]{2,20}#[a-z0-9가-힣_-]{2,20}$' then return jsonb_build_object('ok',false,'error','INVALID_TAG');end if;
   select user_id into recipient from team_study_private.identities where tag=tag_value;
   if recipient is null or not team_study_private.registered(recipient) then return jsonb_build_object('ok',false,'error','TAG_NOT_FOUND');end if;
   if recipient=p_user or exists(select 1 from team_study_private.members where user_id=recipient)then return jsonb_build_object('ok',false,'error','ALREADY_IN_TEAM');end if;
   select * into i from team_study_private.invitations where team_id=t.id and recipient_id=recipient and revoked_at is null and responded_at is null and expires_at>now();
   if i.id is null then insert into team_study_private.invitations(team_id,issued_by,recipient_id)values(t.id,p_user,recipient)returning * into i;end if;
   perform team_study_private.bump(t.id); return jsonb_build_object('ok',true,'invite_id',i.id);
  elsif p_action='set_share_title' then
   if jsonb_typeof(p_payload->'share') is distinct from 'boolean' then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
   update team_study_private.members set share_title=(p_payload->>'share')::boolean where user_id=p_user;
  elsif p_action='propose_round' then
   if (p_payload->>'duration_minutes')::integer not in(25,50) or p_payload->>'duration_minutes' is null then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
   update team_study_private.rounds set closed_at=now()where team_id=t.id and closed_at is null and ends_at<=now();
   if exists(select 1 from team_study_private.rounds where team_id=t.id and closed_at is null)then return jsonb_build_object('ok',false,'error','ROUND_EXISTS');end if;
   insert into team_study_private.rounds(team_id,duration_minutes,proposed_by)values(t.id,(p_payload->>'duration_minutes')::integer,p_user);
  elsif p_action='cancel_round' then
   select * into r from team_study_private.rounds where team_id=t.id and closed_at is null;
   if r.id is not null and p_user not in(r.proposed_by,t.owner_id)then return jsonb_build_object('ok',false,'error','OWNER_REQUIRED');end if;
   update team_study_private.rounds set closed_at=now()where id=r.id;
  elsif p_action='connect' then
   select * into s from public.study_sessions where id=(p_payload->>'session_id')::uuid and user_id=p_user and status='active'
    and paused_at is null and now()<coalesce(lease_expires_at,started_at+interval '1 hour')for update;
   if s.id is null then return jsonb_build_object('ok',false,'error','SESSION_REQUIRED');end if;
   if not exists(select 1 from public.study_actual_sessions where session_id=s.id and user_id=p_user and current_todo_id is not null)then return jsonb_build_object('ok',false,'error','TRACKING_REQUIRED');end if;
   select * into c from team_study_private.connections where user_id=p_user and ended_at is null;
   select * into r from team_study_private.rounds where team_id=t.id and closed_at is null and (ends_at is null or ends_at>now());
   if c.id is not null and c.session_id<>s.id then return jsonb_build_object('ok',false,'error','CONNECTION_EXISTS');end if;
   if r.id is not null and r.started_at is null then
    update team_study_private.rounds set started_at=now(),ends_at=now()+make_interval(mins=>duration_minutes)where id=r.id returning * into r;
   end if;
   if c.id is null then
    perform team_study_private.checkpoint(s.id,now());
    insert into team_study_private.connections(team_id,user_id,session_id,round_id)values(t.id,p_user,s.id,r.id)returning * into c;
   elsif r.id is not null then update team_study_private.connections set round_id=r.id where id=c.id;
   end if;
  elsif p_action in('disconnect','leave_team') then
   if p_action='leave_team' and p_payload ? 'close' and jsonb_typeof(p_payload->'close') is distinct from 'boolean' then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
   if p_action='leave_team' and coalesce((p_payload->>'close')::boolean,false)and t.owner_id<>p_user then return jsonb_build_object('ok',false,'error','OWNER_REQUIRED');end if;
   if p_action='leave_team' and t.owner_id=p_user then
    if coalesce((p_payload->>'close')::boolean,false)then
     -- Team lock now prevents new connects. Never acquire a newly discovered session lock after it.
     if not team_study_private.connections_prelocked(t.id,locked_sessions)then return jsonb_build_object('ok',false,'error','RETRY');end if;
     for x in select session_id from team_study_private.connections where team_id=t.id and ended_at is null order by session_id loop
      perform team_study_private.checkpoint(x.session_id,now());end loop;
     update team_study_private.connections set ended_at=greatest(started_at,now())where team_id=t.id and ended_at is null;
     update team_study_private.teams set closed_at=now()where id=t.id;
     update team_study_private.invitations set revoked_at=now()where team_id=t.id and revoked_at is null;
     update team_study_private.rounds set closed_at=now()where team_id=t.id and closed_at is null;
     delete from team_study_private.members where team_id=t.id;
     perform team_study_private.bump(t.id);return jsonb_build_object('ok',true);
    end if;
    successor:=nullif(p_payload->>'successor_id','')::uuid;
    select count(*) into n from team_study_private.members where team_id=t.id;
    if n>1 and not exists(select 1 from team_study_private.members where user_id=successor and team_id=t.id and user_id<>p_user)then return jsonb_build_object('ok',false,'error','OWNER_SUCCESSOR_REQUIRED');end if;
    if n=1 then return jsonb_build_object('ok',false,'error','OWNER_SUCCESSOR_REQUIRED');end if;
    update team_study_private.teams set owner_id=successor where id=t.id;
   end if;
   select * into c from team_study_private.connections where user_id=p_user and ended_at is null;
   if c.id is not null then
    perform team_study_private.checkpoint(c.session_id,now());
    update team_study_private.connections set ended_at=greatest(started_at,now())where id=c.id;
   end if;
   if p_action='leave_team' then delete from team_study_private.members where user_id=p_user;end if;
  else return jsonb_build_object('ok',false,'error','INVALID_ACTION');end if;
 end if;
 perform team_study_private.bump(t.id);
 return jsonb_build_object('ok',true,'team_id',t.id);
end $$;

create function public.team_study_action(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='10s' as $$
declare u uuid:=auth.uid(); attempts integer; result jsonb;
begin
 if not team_study_private.registered(u)then return jsonb_build_object('ok',false,'error','ACCOUNT_REQUIRED');end if;
 if p_action is null or p_action not in('set_tag','lookup_tag','create_team','create_invite','revoke_invite','preview_invite','accept_invite','invite_tag','respond_invite','leave_team','set_share_title','propose_round','cancel_round','connect','disconnect')then return jsonb_build_object('ok',false,'error','INVALID_ACTION');end if;
 if p_action in('lookup_tag','invite_tag','preview_invite','accept_invite','respond_invite','create_invite','set_tag')then
  insert into team_study_private.rate_limits(user_id,window_at,attempts)values(u,date_trunc('minute',now()),1)
  on conflict(user_id)do update set
   attempts=case when rate_limits.window_at=date_trunc('minute',now())then rate_limits.attempts+1 else 1 end,
   window_at=date_trunc('minute',now())returning rate_limits.attempts into attempts;
  if attempts>20 then return jsonb_build_object('ok',false,'error','RATE_LIMITED');end if;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>4096 then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');end if;
 -- Catch only inside a subtransaction AFTER the rate write: invalid casts never erase attempts.
 begin
  result:=team_study_private.mutate(u,p_action,p_payload);
 exception
  when unique_violation then return jsonb_build_object('ok',false,'error','CONFLICT');
  when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('ok',false,'error','INVALID_PAYLOAD');
  when lock_not_available or deadlock_detected then return jsonb_build_object('ok',false,'error','RETRY');
 end;
 return result;
end $$;

create function public.team_study_snapshot() returns jsonb
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
   'started_at',ss.started_at,'paused_seconds',coalesce(ss.paused_seconds,0),'paused_at',ss.paused_at)order by m.joined_at,m.user_id),'[]')into members
  from team_study_private.members m left join team_study_private.identities i on i.user_id=m.user_id
  left join public.study_sessions ss on ss.user_id=m.user_id and ss.status='active' and now()<coalesce(ss.lease_expires_at,ss.started_at+interval '1 hour')
  left join public.study_actual_sessions a on a.session_id=ss.id
  left join public.study_todos todo on todo.id=a.current_todo_id and todo.user_id=m.user_id where m.team_id=t.id;
  select jsonb_build_object('id',r.id,'duration_minutes',r.duration_minutes,'proposed_by',r.proposed_by,'started_at',r.started_at,'ends_at',r.ends_at,
    'joined',exists(select 1 from team_study_private.connections c where c.user_id=u and c.round_id=r.id and c.ended_at is null))into round_value
  from team_study_private.rounds r where r.team_id=t.id and r.closed_at is null and (r.ends_at is null or r.ends_at>now());
  select jsonb_build_object('id',c.id,'session_id',c.session_id)into connection_value from team_study_private.connections c
  join public.study_sessions ss on ss.id=c.session_id where c.team_id=t.id and c.user_id=u and c.ended_at is null and ss.status='active'
  and now()<coalesce(ss.lease_expires_at,ss.started_at+interval '1 hour');
  -- Sum each accepted segment once. Active sessions remain pending until final personal settlement.
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

create function team_study_private.session_signal() returns trigger
language plpgsql security definer set search_path='' as $$
declare team uuid;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status and new.paused_at is not distinct from old.paused_at
  and new.paused_seconds is not distinct from old.paused_seconds
  and (now()<coalesce(new.lease_expires_at,new.started_at+interval '1 hour'))=(now()<coalesce(old.lease_expires_at,old.started_at+interval '1 hour'))then return new;end if;
 if tg_op='UPDATE' and new.status is distinct from old.status and new.status<>'active' then
  update team_study_private.connections set ended_at=greatest(started_at,least(coalesce(new.ended_at,now()),coalesce(new.lease_expires_at,new.started_at+interval '1 hour')))
  where session_id=new.id and ended_at is null;
 end if;
 select team_id into team from team_study_private.members where user_id=new.user_id;
 if team is not null then perform team_study_private.bump(team);end if;
 return new;
end $$;
create trigger team_study_session_signal after insert or update of status,paused_at,paused_seconds,lease_expires_at on public.study_sessions
 for each row execute function team_study_private.session_signal();
create function team_study_private.title_signal() returns trigger
language plpgsql security definer set search_path='' as $$
declare team uuid;
begin
 select team_id into team from team_study_private.members where user_id=new.user_id and share_title;
 if team is not null then perform team_study_private.bump(team);end if;
 return new;
end $$;
create trigger team_study_title_signal after update of title on public.study_todos for each row execute function team_study_private.title_signal();
create trigger team_study_focus_signal after insert or update of current_todo_id on public.study_actual_sessions for each row execute function team_study_private.title_signal();

do $$declare tbl text;begin
 foreach tbl in array array['identities','teams','members','invitations','rounds','connections','rate_limits']loop
  execute format('alter table team_study_private.%I enable row level security',tbl);
 end loop;
end $$;
revoke all on all tables in schema team_study_private from public,anon,authenticated;
revoke all on all functions in schema team_study_private from public,anon,authenticated;
grant execute on function team_study_private.is_member(uuid,uuid) to authenticated;
revoke all on function public.team_study_action(text,jsonb),public.team_study_snapshot() from public,anon;
grant execute on function public.team_study_action(text,jsonb),public.team_study_snapshot() to authenticated;
do $$begin
 if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename='team_study_signals')then
  alter publication supabase_realtime add table public.team_study_signals;
 end if;
end $$;
