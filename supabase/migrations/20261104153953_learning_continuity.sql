-- Additive continuity metadata. Never backfill/reclassify historical notes.
alter table public.study_session_reflections
  alter column focus_score drop not null,
  alter column energy_score drop not null,
  add column context_todo_id uuid references public.study_todos(id) on delete set null,
  add column resource_url text,
  add column resource_position text,
  add column note_kind text not null default 'memo' check (note_kind in ('memo','learning_result')),
  add constraint learning_context_link_fk foreign key (session_id,context_todo_id)
    references public.study_session_todos(session_id,todo_id) on delete set null (context_todo_id),
  add constraint learning_resource_url_check check (resource_url is null or
    (length(resource_url)<=2048 and resource_url ~* '^https?://[^/@[:space:]\\?#]+([/?#][^[:space:]\\]*)?$'
     and resource_url !~ '[[:cntrl:]]')),
  add constraint learning_resource_position_check check (resource_position is null or length(resource_position)<=160);

create index learning_reflection_context_latest on public.study_session_reflections(user_id,context_todo_id,created_at desc,id desc)
  where context_todo_id is not null;
create schema learning_continuity_private;
revoke all on schema learning_continuity_private from public,anon;
grant usage on schema learning_continuity_private to authenticated;

-- A trigger protects ALL direct INSERT/UPDATE paths even on deployments whose
-- legacy RLS policies only check reflection.user_id. No policy replacement.
create function learning_continuity_private.validate_reflection() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 -- Caller identity is enforced by table RLS / each public RPC. Validate the
 -- row owner's relationships here, including trusted FK cleanup without a JWT.
 if not exists(select 1 from public.study_sessions s where s.id=new.session_id and s.user_id=new.user_id and s.status='completed') then
   raise exception 'LEARNING_SESSION';
 end if;
 if new.context_todo_id is not null and not exists(
   select 1 from public.study_session_todos l join public.study_todos t on t.id=l.todo_id and t.user_id=l.user_id
   where l.session_id=new.session_id and l.user_id=new.user_id and l.todo_id=new.context_todo_id
 ) then raise exception 'LEARNING_CONTEXT'; end if;
 if tg_op='UPDATE' then
   if (new.id,new.user_id,new.session_id,new.created_at) is distinct from (old.id,old.user_id,old.session_id,old.created_at) then
     raise exception 'LEARNING_IMMUTABLE_IDENTITY';
   end if;
   new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 end if;
 return new;
end $$;
revoke all on function learning_continuity_private.validate_reflection() from public,anon,authenticated;
create trigger learning_validate_reflection before insert or update on public.study_session_reflections
for each row execute function learning_continuity_private.validate_reflection();

create function learning_continuity_private.result(p_reflection_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('reflectionId',r.id,'sessionId',r.session_id,'todoId',r.context_todo_id,'todoTitle',t.title,
   'localDate',s.local_date,'startedAt',s.started_at,'endedAt',s.ended_at,'note',coalesce(r.note,''),
   'nextAction',coalesce(r.next_action,''),'resourceUrl',coalesce(r.resource_url,''),'resourcePosition',coalesce(r.resource_position,''),
   'focusScore',r.focus_score,'energyScore',r.energy_score,'interruptionReason',r.interruption_reason,'updatedAt',r.updated_at)
 from public.study_session_reflections r join public.study_sessions s on s.id=r.session_id and s.user_id=r.user_id
 left join public.study_todos t on t.id=r.context_todo_id and t.user_id=r.user_id
 where r.id=p_reflection_id and r.user_id=auth.uid() and s.status='completed'
$$;
revoke all on function learning_continuity_private.result(uuid) from public,anon;
grant execute on function learning_continuity_private.result(uuid) to authenticated;

create function public.learning_continuity_snapshot(p_study_date date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare bookmarks jsonb; results jsonb;
begin
 if auth.uid() is null then raise exception 'LEARNING_AUTH'; end if;
 if p_study_date is null then raise exception 'LEARNING_DATE'; end if;
 -- Select the newest session reflection FIRST, including blank bookmarks.
 with latest as (
   select distinct on(r.context_todo_id) r.* from public.study_session_reflections r
   join public.study_sessions s on s.id=r.session_id and s.user_id=r.user_id
   where r.user_id=auth.uid() and r.context_todo_id is not null and s.status='completed'
   order by r.context_todo_id,s.started_at desc,r.created_at desc,r.id desc
 ), visible as (
   select r.*,t.title,t.local_date,t.start_time,t.end_time,t.updated_at todo_updated_at from latest r
   join public.study_todos t on t.id=r.context_todo_id and t.user_id=r.user_id
   where not t.is_completed and (nullif(btrim(r.next_action),'') is not null or nullif(btrim(r.resource_url),'') is not null or nullif(btrim(r.resource_position),'') is not null)
 ) select coalesce(jsonb_agg(jsonb_build_object('reflectionId',id,'sessionId',session_id,'todoId',context_todo_id,'todoTitle',title,
   'localDate',local_date,'startTime',start_time,'endTime',end_time,'todoUpdatedAt',todo_updated_at,'updatedAt',updated_at,
   'nextAction',coalesce(next_action,''),'resourceUrl',coalesce(resource_url,''),'resourcePosition',coalesce(resource_position,''))
   order by updated_at desc,id desc),'[]'::jsonb) into bookmarks from visible;
 select coalesce(jsonb_agg(learning_continuity_private.result(r.id) order by s.started_at desc,r.id desc),'[]'::jsonb) into results
 from public.study_session_reflections r join public.study_sessions s on s.id=r.session_id and s.user_id=r.user_id
 where r.user_id=auth.uid() and s.status='completed' and s.local_date=p_study_date
   and r.note_kind='learning_result' and nullif(btrim(r.note),'') is not null;
 return jsonb_build_object('version',1,'bookmarks',bookmarks,'results',results);
end $$;

create function public.save_learning_reflection(p_session_id uuid,p_reflection jsonb,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.study_session_reflections%rowtype; f integer; e integer; context_id uuid;
begin
 if auth.uid() is null then raise exception 'LEARNING_AUTH'; end if;
 -- Session row serializes creation as well as edits without an upsert lost update.
 perform 1 from public.study_sessions where id=p_session_id and user_id=auth.uid() and status='completed' for update;
 if not found then raise exception 'LEARNING_SESSION'; end if;
 if jsonb_typeof(p_reflection) is distinct from 'object' then raise exception 'LEARNING_PAYLOAD'; end if;
 if exists(select 1 from jsonb_each(p_reflection) kv where kv.key not in
   ('focus_score','energy_score','interruption_reason','note','next_action','context_todo_id','resource_url','resource_position')) then raise exception 'LEARNING_PAYLOAD'; end if;
 if exists(select 1 from jsonb_each(p_reflection) kv where kv.key in ('note','next_action','interruption_reason','context_todo_id','resource_url','resource_position') and jsonb_typeof(kv.value) not in ('string','null')) then raise exception 'LEARNING_PAYLOAD'; end if;
 if exists(select 1 from jsonb_each(p_reflection) kv where kv.key in ('focus_score','energy_score') and
   (jsonb_typeof(kv.value) not in ('number','null') or (jsonb_typeof(kv.value)='number' and kv.value::text !~ '^[1-5]$'))) then raise exception 'LEARNING_SCORE'; end if;
 if length(p_reflection->>'note')>500 or length(p_reflection->>'next_action')>160 or length(p_reflection->>'resource_url')>2048 or length(p_reflection->>'resource_position')>160 then raise exception 'LEARNING_LENGTH'; end if;
 f:=(p_reflection->>'focus_score')::integer; e:=(p_reflection->>'energy_score')::integer;
 context_id:=(p_reflection->>'context_todo_id')::uuid;
 select * into r from public.study_session_reflections where session_id=p_session_id and user_id=auth.uid() for update;
 if found then
   if p_expected_updated_at is null or r.updated_at is distinct from p_expected_updated_at then raise exception 'LEARNING_STALE'; end if;
   update public.study_session_reflections set focus_score=f,energy_score=e,interruption_reason=nullif(p_reflection->>'interruption_reason',''),
     note=nullif(btrim(p_reflection->>'note'),''),next_action=nullif(btrim(p_reflection->>'next_action'),''),
     context_todo_id=context_id,resource_url=nullif(btrim(p_reflection->>'resource_url'),''),resource_position=nullif(btrim(p_reflection->>'resource_position'),''),
     note_kind='learning_result' where id=r.id returning * into r;
 else
   if p_expected_updated_at is not null then raise exception 'LEARNING_STALE'; end if;
   insert into public.study_session_reflections(user_id,session_id,focus_score,energy_score,interruption_reason,note,next_action,context_todo_id,resource_url,resource_position,note_kind)
   values(auth.uid(),p_session_id,f,e,nullif(p_reflection->>'interruption_reason',''),nullif(btrim(p_reflection->>'note'),''),nullif(btrim(p_reflection->>'next_action'),''),
     context_id,nullif(btrim(p_reflection->>'resource_url'),''),nullif(btrim(p_reflection->>'resource_position'),''),'learning_result') returning * into r;
 end if;
 return learning_continuity_private.result(r.id);
end $$;

create function public.complete_learning_session(p_session_id uuid,p_excluded_seconds integer,p_completed_todo_ids uuid[],p_reflection jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.study_sessions%rowtype; stamp timestamptz; r jsonb;
begin
 if auth.uid() is null then raise exception 'LEARNING_AUTH'; end if;
 if p_excluded_seconds is null or p_excluded_seconds<0 then raise exception 'LEARNING_EXCLUSION'; end if;
 -- Existing attendance, camera exclusion and actual-study settlement stay authoritative.
 -- Any subsequent metadata failure rolls this entire statement back.
 s:=public.complete_study_session(p_session_id,p_excluded_seconds,p_completed_todo_ids,
   (p_reflection->>'focus_score')::integer,(p_reflection->>'energy_score')::integer,p_reflection->>'interruption_reason',p_reflection->>'note',p_reflection->>'next_action');
 select updated_at into stamp from public.study_session_reflections where session_id=s.id and user_id=auth.uid();
 r:=public.save_learning_reflection(s.id,p_reflection,stamp);
 return jsonb_build_object('version',1,'session',to_jsonb(s),'reflection',r);
end $$;

create function public.update_learning_bookmark(p_reflection_id uuid,p_expected_updated_at timestamptz,p_next_action text,p_resource_url text,p_resource_position text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.study_session_reflections%rowtype;
begin
 if auth.uid() is null then raise exception 'LEARNING_AUTH'; end if;
 if length(p_next_action)>160 or length(p_resource_url)>2048 or length(p_resource_position)>160 then raise exception 'LEARNING_LENGTH'; end if;
 select * into r from public.study_session_reflections where id=p_reflection_id and user_id=auth.uid() for update;
 if not found then raise exception 'LEARNING_REFLECTION'; end if;
 if p_expected_updated_at is null or r.updated_at is distinct from p_expected_updated_at then raise exception 'LEARNING_STALE'; end if;
 update public.study_session_reflections set next_action=nullif(btrim(p_next_action),''),resource_url=nullif(btrim(p_resource_url),''),resource_position=nullif(btrim(p_resource_position),'') where id=r.id;
 return learning_continuity_private.result(r.id);
end $$;

create function public.prepare_learning_todo(p_todo_id uuid,p_expected_local_date date,p_expected_updated_at timestamptz) returns jsonb
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare t public.study_todos%rowtype; today date; zone text;
begin
 if auth.uid() is null then raise exception 'LEARNING_AUTH'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,91321));
 -- Fence new legacy session inserts too, not only the cooperating actual-action RPC.
 lock table public.study_sessions in share row exclusive mode nowait;
 if exists(select 1 from public.study_sessions where user_id=auth.uid() and status='active') then raise exception 'LEARNING_ACTIVE'; end if;
 -- Actual start holds the todo table before inserting a session. Do not wait
 -- while holding the session fence: contention is SQLSTATE 55P03, for explicit retry.
 lock table public.study_todos in row exclusive mode nowait;
 select time_zone into zone from public.profiles where user_id=auth.uid();
 today:=(now() at time zone coalesce(zone,'Asia/Tokyo'))::date;
 select * into t from public.study_todos where id=p_todo_id and user_id=auth.uid() for update nowait;
 if not found then raise exception 'LEARNING_TODO'; end if;
 if p_expected_local_date is null or p_expected_updated_at is null or t.local_date is distinct from p_expected_local_date or t.updated_at is distinct from p_expected_updated_at then raise exception 'LEARNING_STALE'; end if;
 if t.is_completed or t.local_date>=today then raise exception 'LEARNING_NOT_PAST'; end if;
 -- No series update, no new todo, no new session, no modification to plan/segments.
 -- Existing coach trigger may realign derived instants; clock values stay unchanged.
 update public.study_todos set local_date=today where id=t.id returning * into t;
 return jsonb_build_object('version',1,'todoId',t.id,'localDate',t.local_date,'startTime',t.start_time,'endTime',t.end_time,'updatedAt',t.updated_at);
end $$;

revoke all on function public.learning_continuity_snapshot(date) from public,anon;
revoke all on function public.save_learning_reflection(uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.complete_learning_session(uuid,integer,uuid[],jsonb) from public,anon;
revoke all on function public.update_learning_bookmark(uuid,timestamptz,text,text,text) from public,anon;
revoke all on function public.prepare_learning_todo(uuid,date,timestamptz) from public,anon;
grant execute on function public.learning_continuity_snapshot(date),public.save_learning_reflection(uuid,jsonb,timestamptz),
 public.complete_learning_session(uuid,integer,uuid[],jsonb),public.update_learning_bookmark(uuid,timestamptz,text,text,text),
 public.prepare_learning_todo(uuid,date,timestamptz) to authenticated;
