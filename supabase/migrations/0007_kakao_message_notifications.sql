create table if not exists public.kakao_message_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kakao_user_id text,
  access_token text not null,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  enabled boolean not null default true,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kakao_message_connections_enabled_idx
  on public.kakao_message_connections (enabled, access_token_expires_at);

alter table public.kakao_message_connections enable row level security;

drop trigger if exists kakao_message_connections_touch_updated_at on public.kakao_message_connections;
create trigger kakao_message_connections_touch_updated_at
  before update on public.kakao_message_connections
  for each row execute function public.touch_updated_at();

alter table public.notification_targets
  drop constraint if exists notification_targets_kind_check;

alter table public.notification_targets
  add constraint notification_targets_kind_check check (kind in ('expo', 'web_push', 'email', 'kakao_memo'));

alter table public.notification_targets
  drop constraint if exists notification_targets_payload_check;

alter table public.notification_targets
  add constraint notification_targets_payload_check check (
    (kind in ('expo', 'email') and destination is not null)
    or (kind = 'kakao_memo' and destination is not null)
    or (kind = 'web_push' and subscription is not null)
  );

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_channel_check check (channel in ('expo', 'web_push', 'email', 'kakao_memo'));
