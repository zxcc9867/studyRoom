update public.notification_targets
set
  enabled = false,
  updated_at = now()
where kind = 'kakao_memo'
  and enabled = true;

update public.kakao_message_connections
set
  enabled = false,
  updated_at = now()
where enabled = true;
