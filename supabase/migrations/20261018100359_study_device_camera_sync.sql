-- Additive, forward-only coordination. Rollback: disable new clients/Edge first;
-- retain this table and all learning history; remove APIs only in a later migration.
create table public.study_camera_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  owner_client_id uuid not null,
  generation bigint not null default 1 check (generation > 0),
  device_type text not null default 'browser',
  status text not null check (status in ('watching','present','absent','off','error')),
  last_seen_at timestamptz not null,
  expires_at timestamptz not null,
  absence_since timestamptz,
  excluded_seconds integer not null default 0 check (excluded_seconds >= 0),
  observed_paused_seconds integer not null default 0,
  last_absence_warning_at timestamptz,
  last_camera_warning_at timestamptz,
  foreign key (session_id,user_id) references public.study_sessions(id,user_id) on delete cascade
);
alter table public.study_camera_sessions enable row level security;
revoke all on public.study_camera_sessions from public,anon,authenticated;
grant select on public.study_camera_sessions to authenticated;
create policy owner_read on public.study_camera_sessions for select to authenticated
using ((select auth.uid())=user_id);

create function public.study_device_snapshot(p_client_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.study_sessions%rowtype; c public.study_camera_sessions%rowtype;
 camera jsonb; seconds integer; camera_status text; auto_at timestamptz;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 select * into s from public.study_sessions where user_id=u
 order by (status='active') desc,coalesce(ended_at,started_at) desc,id desc limit 1;
 if s.id is not null then
   select * into c from public.study_camera_sessions where session_id=s.id and user_id=u;
   if c.session_id is not null then
     seconds:=case when c.status='absent' and c.absence_since is not null and c.observed_paused_seconds=s.paused_seconds then
       greatest(0,floor(extract(epoch from least(now(),c.expires_at)-c.absence_since))::integer) else 0 end;
     auto_at:=case when seconds>=600 then c.absence_since+interval '600 seconds' end;
     camera_status:=case when s.status<>'active' then 'ended'
       when s.paused_at is not null then 'paused'
       when now()>=coalesce(s.lease_expires_at,s.started_at+interval '1 hour') or now()>=c.expires_at
         or c.observed_paused_seconds<>s.paused_seconds then 'stale'
       when auto_at is not null then 'auto_paused' else c.status end;
     camera:=jsonb_build_object('session_id',c.session_id,'owner_client_id',c.owner_client_id,
       'generation',c.generation,'device_type',c.device_type,'status',camera_status,
       'last_seen_at',c.last_seen_at,'expires_at',c.expires_at,'absence_seconds',seconds,
       'excluded_seconds',greatest(c.excluded_seconds,coalesce((select excluded_seconds from public.study_actual_sessions where session_id=s.id),0)),
       'auto_paused_at',auto_at,'is_owner',c.owner_client_id=p_client_id);
   end if;
 end if;
 return jsonb_build_object('server_now',now(),'active_session',case when s.status='active' then to_jsonb(s) end,
   'session',case when s.id is not null then to_jsonb(s) end,
   'tracking',case when s.id is not null then public.get_actual_study_state(s.id) end,'camera',camera);
end $$;

create function public.study_camera_action(
 p_action text,p_client_id uuid,p_session_id uuid,p_generation bigint default null,
 p_status text default 'watching',p_excluded_seconds integer default null,
 p_takeover boolean default false,p_device_type text default 'browser'
)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='10s' as $$
declare
 u uuid:=auth.uid(); s public.study_sessions%rowtype; c public.study_camera_sessions%rowtype;
 accepted boolean:=false; counter integer; gross integer; since_at timestamptz;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 -- Every mutation uses the same session -> camera -> actual tracking order.
 select * into s from public.study_sessions where id=p_session_id and user_id=u for update;
 if s.id is null or p_client_id is null or p_action is null or p_action not in ('claim','report')
   or p_status is null or p_status not in ('watching','present','absent','off','error')
   or s.status<>'active' or s.paused_at is not null
   or now()>=coalesce(s.lease_expires_at,s.started_at+interval '1 hour') then
   return public.study_device_snapshot(p_client_id)||jsonb_build_object('accepted',false);
 end if;
 select * into c from public.study_camera_sessions where session_id=s.id for update;
 if p_action='claim' then
   if c.session_id is null then
     insert into public.study_camera_sessions(session_id,user_id,owner_client_id,generation,device_type,status,last_seen_at,expires_at,absence_since,excluded_seconds,observed_paused_seconds)
     values(s.id,u,p_client_id,1,left(coalesce(nullif(p_device_type,''),'browser'),80),p_status,now(),now()+interval '45 seconds',
       case when p_status='absent' then now() end,coalesce((select excluded_seconds from public.study_actual_sessions where session_id=s.id),0),s.paused_seconds);
     accepted:=true;
   elsif c.owner_client_id=p_client_id and (p_generation is null or p_generation=c.generation) then
     accepted:=true;
   elsif c.owner_client_id<>p_client_id and (p_takeover is true or c.expires_at<=now()) then
     -- Settle only server-proven old-owner absence before clearing its episode.
     perform study_device_private.authoritative_exclusion(s.id);
     update public.study_camera_sessions set owner_client_id=p_client_id,generation=generation+1,
       device_type=left(coalesce(nullif(p_device_type,''),'browser'),80),status=p_status,
       last_seen_at=now(),expires_at=now()+interval '45 seconds',absence_since=case when p_status='absent' then now() end
     where session_id=s.id;
     accepted:=true;
   end if;
 elsif c.owner_client_id=p_client_id and c.generation=p_generation then
   accepted:=true;
 end if;
 if accepted then
   perform study_device_private.authoritative_exclusion(s.id);
   select * into c from public.study_camera_sessions where session_id=s.id;
   since_at:=case when p_status='absent' then
     case when c.status='absent' and c.expires_at>now() and c.observed_paused_seconds=s.paused_seconds then coalesce(c.absence_since,now()) else now() end end;
   counter:=greatest(c.excluded_seconds,coalesce((select excluded_seconds from public.study_actual_sessions where session_id=s.id),0));
   gross:=greatest(0,floor(extract(epoch from now()-s.started_at))::integer-s.paused_seconds);
   -- A report may only reduce credit, monotonically, bounded by real elapsed time.
   -- The established checkpoint owns all segment allocation/debit behavior.
   if p_action='report' and p_excluded_seconds is not null then
     counter:=greatest(counter,least(gross,greatest(0,p_excluded_seconds)));
   end if;
   if counter>coalesce((select excluded_seconds from public.study_actual_sessions where session_id=s.id),0)
      or (p_action='report' and p_excluded_seconds is not null) then
     perform study_device_private.checkpoint_actual_study_exclusion(s.id,counter);
   end if;
   update public.study_camera_sessions set status=p_status,absence_since=since_at,
     last_seen_at=now(),expires_at=now()+interval '45 seconds',excluded_seconds=counter,observed_paused_seconds=s.paused_seconds where session_id=s.id;
 end if;
 return public.study_device_snapshot(p_client_id)||jsonb_build_object('accepted',accepted);
end $$;

-- Retain legacy implementations privately so their lifecycle/attendance behavior
-- is unchanged. Public signatures remain, but identity-less callers cannot supply
-- a new camera debit once a device-coordination row exists.
create schema study_device_private;
revoke all on schema study_device_private from public,anon,authenticated,service_role;
alter function public.checkpoint_actual_study_exclusion(uuid,integer) set schema study_device_private;
alter function public.end_study_session(uuid,integer) set schema study_device_private;
revoke all on function study_device_private.checkpoint_actual_study_exclusion(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function study_device_private.end_study_session(uuid,integer) from public,anon,authenticated,service_role;

-- The preview and locked checkpoint must calculate the SAME counter. This read-
-- only helper preserves preview semantics; confirm revalidates it under its
-- existing session lock, so a changed camera counter invalidates stale previews.
create function study_device_private.exclusion_snapshot(p_session_id uuid)
returns integer language plpgsql stable security definer set search_path='' as $$
declare
 s public.study_sessions%rowtype; c public.study_camera_sessions%rowtype;
 counter integer; boundary timestamptz; accounted_at timestamptz; gross integer;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into s from public.study_sessions where id=p_session_id and user_id=auth.uid() and status='active';
 if not found then return null; end if;
 select * into c from public.study_camera_sessions where session_id=s.id;
 if not found then return null; end if;
 counter:=greatest(c.excluded_seconds,coalesce((select excluded_seconds from public.study_actual_sessions where session_id=s.id),0));
 boundary:=least(now(),c.expires_at,coalesce(s.paused_at,now()),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'));
 gross:=greatest(0,floor(extract(epoch from least(now(),coalesce(s.paused_at,now()),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'))-s.started_at))::integer-s.paused_seconds);
 if c.status='absent' and c.absence_since is not null and c.observed_paused_seconds=s.paused_seconds then
   accounted_at:=greatest(c.last_seen_at,c.absence_since+interval '600 seconds');
   counter:=least(gross,counter+greatest(0,floor(extract(epoch from boundary-accounted_at))::integer));
 end if;
 return counter;
end $$;
revoke all on function study_device_private.exclusion_snapshot(uuid) from public,anon,authenticated,service_role;

create function study_device_private.authoritative_exclusion(p_session_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare s public.study_sessions%rowtype; c public.study_camera_sessions%rowtype; counter integer; boundary timestamptz;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into s from public.study_sessions where id=p_session_id and user_id=auth.uid() and status='active' for update;
 if not found then raise exception 'Active study session not found'; end if;
 select * into c from public.study_camera_sessions where session_id=s.id for update;
 if not found then return null; end if;
 counter:=study_device_private.exclusion_snapshot(s.id);
 boundary:=least(now(),c.expires_at,coalesce(s.paused_at,now()),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'));
 -- last_seen_at also marks the persisted counter's cutoff. Accounting can advance
 -- it, but NEVER renews expires_at: an observer cannot fabricate a heartbeat.
 if counter>c.excluded_seconds then
   update public.study_camera_sessions set excluded_seconds=counter,last_seen_at=greatest(last_seen_at,boundary) where session_id=s.id;
 end if;
 return counter;
end $$;
revoke all on function study_device_private.authoritative_exclusion(uuid) from public,anon,authenticated,service_role;

-- Both public preview and confirm call this private entrypoint. Preserve the
-- latest deployed planner body, including study-day rules, without copying it.
alter function actual_study_private.preview(text,uuid[],uuid,uuid,integer,timestamptz) rename to preview_uncoordinated;
create function actual_study_private.preview(
 p_action text,p_todo_ids uuid[],p_current_todo_id uuid,p_session_id uuid,p_excluded_seconds integer,p_minute timestamptz
)
returns jsonb language sql stable set search_path='' as $$
 select actual_study_private.preview_uncoordinated(p_action,p_todo_ids,p_current_todo_id,p_session_id,
   coalesce(study_device_private.exclusion_snapshot(p_session_id),p_excluded_seconds),p_minute)
$$;
revoke all on function actual_study_private.preview(text,uuid[],uuid,uuid,integer,timestamptz) from public,anon,authenticated,service_role;
revoke all on function actual_study_private.preview_uncoordinated(text,uuid[],uuid,uuid,integer,timestamptz) from public,anon,authenticated,service_role;

create function public.checkpoint_actual_study_exclusion(p_session_id uuid,p_excluded_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare counter integer;
begin
 counter:=study_device_private.authoritative_exclusion(p_session_id);
 return study_device_private.checkpoint_actual_study_exclusion(p_session_id,coalesce(counter,p_excluded_seconds));
end $$;
revoke all on function public.checkpoint_actual_study_exclusion(uuid,integer) from public,anon;
grant execute on function public.checkpoint_actual_study_exclusion(uuid,integer) to authenticated;

create function public.end_study_session(p_session_id uuid,p_excluded_seconds integer default 0)
returns public.study_sessions language plpgsql security definer set search_path='' as $$
declare counter integer;
begin
 counter:=study_device_private.authoritative_exclusion(p_session_id);
 if counter is not null then
   perform study_device_private.checkpoint_actual_study_exclusion(p_session_id,counter);
 end if;
 return study_device_private.end_study_session(p_session_id,coalesce(counter,p_excluded_seconds));
end $$;
revoke all on function public.end_study_session(uuid,integer) from public,anon;
grant execute on function public.end_study_session(uuid,integer) to authenticated;

-- Warning rows are server-only. Keep direct, media-free lifecycle telemetry and
-- all historical rows while preventing recovery-count injection.
drop policy "Users can insert their study presence events" on public.study_presence_events;
create policy "Users can insert their study presence events" on public.study_presence_events for insert to authenticated
with check (
 (select auth.uid())=user_id
 and event_type in ('camera_started','camera_stopped','camera_permission_denied')
 and exists(select 1 from public.study_sessions s where s.id=session_id and s.user_id=(select auth.uid()))
);

create function public.claim_study_camera_warning(
 p_user_id uuid,p_session_id uuid,p_client_id uuid,p_generation bigint,p_event_type text
)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='10s' as $$
declare
 s public.study_sessions%rowtype; c public.study_camera_sessions%rowtype;
 seconds integer:=0; event_id uuid; warning_count integer:=0;
 denied jsonb:=jsonb_build_object('allowed',false,'event_id',null,'absence_warning_count',0);
begin
 if p_user_id is null or p_client_id is null or p_generation is null or p_event_type is null
   or p_event_type not in ('absence_warning','camera_required_warning') then return denied; end if;
 select * into s from public.study_sessions where id=p_session_id and user_id=p_user_id for update;
 if s.id is null or s.status<>'active' or s.paused_at is not null
   or now()>=coalesce(s.lease_expires_at,s.started_at+interval '1 hour') then return denied; end if;
 select * into c from public.study_camera_sessions where session_id=s.id and user_id=p_user_id for update;
 if c.session_id is null or c.owner_client_id<>p_client_id or c.generation<>p_generation or c.expires_at<=now()
   or c.observed_paused_seconds<>s.paused_seconds then return denied; end if;
 seconds:=case when c.status='absent' and c.absence_since is not null then greatest(0,floor(extract(epoch from now()-c.absence_since))::integer) else 0 end;
 if p_event_type='absence_warning' then
   if c.status<>'absent' or seconds<300 or (c.last_absence_warning_at is not null and now()<c.last_absence_warning_at+interval '600 seconds') then return denied; end if;
 else
   if c.status not in ('off','error') or (c.last_camera_warning_at is not null and now()<c.last_camera_warning_at+interval '600 seconds') then return denied; end if;
 end if;
 insert into public.study_presence_events(user_id,session_id,event_type,absence_seconds,detected_at,metadata)
 values(p_user_id,s.id,p_event_type,seconds,now(),jsonb_build_object('source','server-camera-owner','localDate',s.local_date,
   'clientId',p_client_id,'generation',p_generation)) returning id into event_id;
 update public.study_camera_sessions set
   last_absence_warning_at=case when p_event_type='absence_warning' then now() else last_absence_warning_at end,
   last_camera_warning_at=case when p_event_type='camera_required_warning' then now() else last_camera_warning_at end
 where session_id=s.id;
 if p_event_type='absence_warning' then
   select count(*)::integer into warning_count from public.study_presence_events
   where user_id=p_user_id and event_type='absence_warning' and metadata @> jsonb_build_object('localDate',s.local_date);
 end if;
 return jsonb_build_object('allowed',true,'event_id',event_id,'absence_warning_count',warning_count);
end $$;

revoke all on function public.study_device_snapshot(uuid) from public,anon;
revoke all on function public.study_camera_action(text,uuid,uuid,bigint,text,integer,boolean,text) from public,anon;
revoke all on function public.claim_study_camera_warning(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.study_device_snapshot(uuid) to authenticated;
grant execute on function public.study_camera_action(text,uuid,uuid,bigint,text,integer,boolean,text) to authenticated;
grant execute on function public.claim_study_camera_warning(uuid,uuid,uuid,bigint,text) to service_role;

do $$
declare t text;
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   foreach t in array array['study_camera_sessions','study_sessions','study_actual_sessions'] loop
     if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
       execute format('alter publication supabase_realtime add table public.%I',t);
     end if;
   end loop;
 end if;
end $$;
