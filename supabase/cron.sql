-- Store these secrets in Supabase Vault before scheduling:
--   project_url: https://<project-ref>.supabase.co
--   cron_secret: same value as the attendance-cron Edge Function CRON_SECRET

do $$
declare
  v_existing_jobid bigint;
begin
  select jobid into v_existing_jobid
  from cron.job
  where jobname = 'study-room-attendance-cron';

  if v_existing_jobid is not null then
    perform cron.unschedule(v_existing_jobid);
  end if;
end
$$;

select cron.schedule(
  'study-room-attendance-cron',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/attendance-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'sent_at', now())
  );
  $$
);
