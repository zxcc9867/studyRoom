-- Apply this scheduler migration separately LAST, after schema -> handlers -> web verification.
-- This single DO statement commits creation and disabling atomically; no feed run is enabled.
-- Provision Vault project_url + tech_feed_worker_secret and matching Edge
-- TECH_FEED_WORKER_SECRET outside migrations, with separately approved rollout.
do $migration$
declare jid bigint;
begin
 if to_regclass('cron.job')is null then raise exception 'pg_cron must be installed before scheduler migration';end if;
 -- Minute dispatch drains the due queue; source run_after still enforces hourly/backoff cadence.
 -- Retire only dedicated career work; attendance and other jobs remain untouched.
 perform cron.alter_job(jobid,active:=false)from cron.job where jobname in('study-room-coach-worker','study-room-coach-notifications');
 select cron.schedule('study-room-tech-feed-hourly','* * * * *',$job$
  select net.http_post(
   url:=(select decrypted_secret from vault.decrypted_secrets where name='project_url')||'/functions/v1/tech-feed-worker',
   headers:=jsonb_build_object('Content-Type','application/json','x-tech-feed-secret',(select decrypted_secret from vault.decrypted_secrets where name='tech_feed_worker_secret')),
   body:='{"source":"pg_cron"}'::jsonb,timeout_milliseconds:=60000
  );
 $job$)into jid;
 perform cron.alter_job(jid,active:=false);
end
$migration$;
-- Explicit later activation: set only study-room-tech-feed-hourly active=true.
-- Kill switch: TECH_FEED_ENABLED=false; additionally disable this Cron row.
