create schema if not exists coaching_private;
revoke all on schema coaching_private from public, anon;
grant usage on schema coaching_private to authenticated;

create table public.study_coaching (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id uuid references public.study_todos(id) on delete set null,
  local_date date not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 1 check (attempts between 1 and 3),
  lease uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default (now() + interval '90 seconds'),
  result jsonb,
  feedback text check (feedback in ('helpful', 'difficult')),
  created_at timestamptz not null default now(),
  unique (user_id, local_date, todo_id, fingerprint)
);
alter table public.study_coaching enable row level security;
revoke all on public.study_coaching from public, anon, authenticated;
grant select on public.study_coaching to authenticated;
create policy coaching_owner_select on public.study_coaching for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true');

-- The private definer is necessary to enforce a quota across requests without
-- granting clients direct insert/update/delete access to quota or result state.
create function coaching_private.mutate(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  op text := p_input->>'operation';
  day date;
  item public.study_coaching%rowtype;
  used integer;
  todo uuid;
begin
  if uid is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if op = 'feedback' then
    if p_input->>'feedback' not in ('helpful', 'difficult') then raise exception 'Invalid feedback'; end if;
    update public.study_coaching set feedback = p_input->>'feedback',
      result = jsonb_set(result, '{feedback}', p_input->'feedback')
      where id = (p_input->>'id')::uuid and user_id = uid and result is not null;
    if not found then return jsonb_build_object('status','missing'); end if;
    return jsonb_build_object('status','saved');
  elsif op = 'finish' then
    if jsonb_typeof(p_input->'result') <> 'object' or octet_length((p_input->'result')::text) > 4096 then raise exception 'Invalid result'; end if;
    update public.study_coaching set result = p_input->'result'
      where id = (p_input->>'id')::uuid and user_id = uid
        and lease = (p_input->>'lease')::uuid and result is null and lease_until > now();
    return jsonb_build_object('status', case when found then 'saved' else 'missing' end);
  elsif op <> 'reserve' or op is null then raise exception 'Invalid operation';
  end if;
  todo := (p_input->>'todo_id')::uuid;
  if coalesce(p_input->>'fingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid fingerprint'; end if;
  select (now() at time zone coalesce(time_zone, 'Asia/Seoul'))::date into day from public.profiles where user_id = uid;
  day := coalesce(day, (now() at time zone 'Asia/Seoul')::date);
  if not exists(select 1 from public.study_todos where id = todo and user_id = uid and not is_completed and local_date <= day) then
    return jsonb_build_object('status','missing');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 8763));
  select * into item from public.study_coaching where user_id = uid and local_date = day
    and todo_id = todo and fingerprint = p_input->>'fingerprint';
  if found and item.result is not null then return jsonb_build_object('status','cached','id',item.id,'result',item.result); end if;
  if item.id is not null and item.lease_until > now() then return jsonb_build_object('status','pending'); end if;
  select coalesce(sum(attempts),0) into used from public.study_coaching where user_id = uid and local_date = day;
  if used >= 3 then return jsonb_build_object('status','limit'); end if;
  if item.id is not null then
    update public.study_coaching set attempts = attempts + 1, lease = gen_random_uuid(), lease_until = now() + interval '90 seconds'
      where id = item.id returning * into item;
  else
    insert into public.study_coaching(user_id,todo_id,local_date,fingerprint)
      values(uid,todo,day,p_input->>'fingerprint') returning * into item;
  end if;
  return jsonb_build_object('status','reserved','id',item.id,'lease',item.lease);
end;
$$;
revoke all on function coaching_private.mutate(jsonb) from public, anon;
grant execute on function coaching_private.mutate(jsonb) to authenticated;
create function public.study_coaching_mutate(p_input jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select coaching_private.mutate(p_input); $$;
revoke all on function public.study_coaching_mutate(jsonb) from public, anon;
grant execute on function public.study_coaching_mutate(jsonb) to authenticated;
