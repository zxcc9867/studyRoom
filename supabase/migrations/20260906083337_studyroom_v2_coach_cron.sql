-- Run only after the coach schema and Edge Functions are deployed.
-- Reuse existing Vault secrets without copying secret values into SQL history.
do $$
begin
  if not exists(select 1 from vault.secrets where name='project_url')
     or not exists(select 1 from vault.secrets where name='cron_secret') then
    raise exception 'Existing project_url and cron_secret Vault entries are required';
  end if;
end $$;

select cron.schedule('study-room-coach-worker','* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/coach-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := jsonb_build_object('source','pg_cron'), timeout_milliseconds := 60000
  );
$job$);

select cron.schedule('study-room-coach-notifications','* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/coach-notifications',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := jsonb_build_object('source','pg_cron'), timeout_milliseconds := 60000
  );
$job$);
