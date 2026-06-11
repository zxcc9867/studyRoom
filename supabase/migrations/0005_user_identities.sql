create table if not exists public.user_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  display_name text,
  avatar_url text,
  last_sign_in_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create unique index if not exists user_identities_provider_user_idx
  on public.user_identities (provider, provider_user_id);

alter table public.user_identities enable row level security;

drop policy if exists "Users can read their auth identities" on public.user_identities;
create policy "Users can read their auth identities"
  on public.user_identities for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their auth identities" on public.user_identities;
create policy "Users can insert their auth identities"
  on public.user_identities for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their auth identities" on public.user_identities;
create policy "Users can update their auth identities"
  on public.user_identities for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their auth identities" on public.user_identities;
create policy "Users can delete their auth identities"
  on public.user_identities for delete
  using ((select auth.uid()) = user_id);

drop trigger if exists user_identities_touch_updated_at on public.user_identities;
create trigger user_identities_touch_updated_at
  before update on public.user_identities
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_provider_user_id text := coalesce(
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'sub',
    new.id::text
  );
  v_display_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_name'
  );
  v_avatar_url text := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, v_display_name)
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, profiles.display_name);

  insert into public.user_identities (
    user_id,
    provider,
    provider_user_id,
    email,
    display_name,
    avatar_url,
    last_sign_in_at
  )
  values (
    new.id,
    v_provider,
    v_provider_user_id,
    new.email,
    v_display_name,
    v_avatar_url,
    now()
  )
  on conflict (user_id, provider) do update
    set provider_user_id = excluded.provider_user_id,
        email = excluded.email,
        display_name = coalesce(excluded.display_name, user_identities.display_name),
        avatar_url = coalesce(excluded.avatar_url, user_identities.avatar_url),
        last_sign_in_at = excluded.last_sign_in_at;

  if new.email is not null then
    insert into public.notification_targets (user_id, kind, destination)
    values (new.id, 'email', new.email)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
