import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
test('scheduler migration registers disabled minute dispatcher and retires only career jobs',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema cron;create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
 create function cron.schedule(p_name text,p_schedule text,p_command text)returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values(p_name,p_schedule,p_command)on conflict(jobname)do update set schedule=excluded.schedule,command=excluded.command returning jobid$$;
 insert into cron.job(jobname)values('attendance-reminder'),('study-room-coach-worker'),('study-room-coach-notifications');`);
 await db.exec("create function cron.alter_job(job_id bigint,active boolean)returns void language plpgsql as $$begin perform set_config('cron.allow_update','true',true);update cron.job set active=$2 where jobid=$1;perform set_config('cron.allow_update','false',true);end$$;create function cron.reject_direct_update()returns trigger language plpgsql as $$begin if coalesce(current_setting('cron.allow_update',true),'false')<>'true'then raise exception 'use cron.alter_job';end if;return new;end$$;create trigger guarded_cron_update before update of active on cron.job for each row execute function cron.reject_direct_update();");
 for(const name of readdirSync('supabase/migrations').filter(x=>x.endsWith('_tech_feed_cron_disabled.sql')))await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 const rows=(await db.query('select * from cron.job')).rows;
 assert.equal(rows.find(x=>x.jobname==='study-room-tech-feed-hourly')?.active,false);
 assert.equal(rows.find(x=>x.jobname==='attendance-reminder').active,true);
 assert.ok(rows.filter(x=>x.jobname.startsWith('study-room-coach-')).every(x=>!x.active));
 const job=rows.find(x=>x.jobname==='study-room-tech-feed-hourly');assert.equal(job.schedule,'* * * * *');assert.match(job.command,/tech_feed_worker_secret/);assert.match(job.command,/tech-feed-worker/);
 }finally{await db.close();}
});
