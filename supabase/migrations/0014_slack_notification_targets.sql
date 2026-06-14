alter table public.notification_targets
  drop constraint if exists notification_targets_kind_check;

alter table public.notification_targets
  add constraint notification_targets_kind_check check (kind in ('expo', 'web_push', 'email', 'kakao_memo', 'telegram', 'slack'));

alter table public.notification_targets
  drop constraint if exists notification_targets_payload_check;

alter table public.notification_targets
  add constraint notification_targets_payload_check check (
    (kind in ('expo', 'email', 'kakao_memo', 'telegram', 'slack') and destination is not null)
    or (kind = 'web_push' and subscription is not null)
  );

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_channel_check check (channel in ('expo', 'web_push', 'email', 'kakao_memo', 'telegram', 'slack'));

update public.notification_targets
set enabled = false,
    updated_at = now()
where kind = 'telegram'
  and enabled = true;
