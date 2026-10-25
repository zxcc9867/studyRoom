import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createTeamDb, users, todoId } from './fixtures/team-study-db.mjs';

let f;
const root = 'supabase/migrations/';
const migration = readdirSync(root).find(name => name.endsWith('_attendance_on_study_day_start.sql'));
const preparation = readdirSync(root).find(name => name.endsWith('_atomic_slack_recovery_submission.sql'));
const existing = (file, name) => readFileSync(root + file, 'utf8')
  .match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'))[0];
async function createDb(seed, beforePolicy) {
  const f = await createTeamDb({ automaticTeams: true });
  await f.admin(async () => {
    await f.db.exec(`alter table profiles add column created_at timestamptz not null default '2026-10-01T00:00Z';
      alter table study_recovery_requests add column covered_start_date date, add column covered_end_date date,
        add column covered_missed_days integer, add column consolidated_into_id uuid, add column consolidated_at timestamptz,
        add column created_at timestamptz default now(), add column updated_at timestamptz default now(),
        add column makeup_todo_title text, add column pledge_todo_title text, add column makeup_todo_id uuid,
        add column pledge_todo_id uuid, add column slack_channel_id text, add column slack_message_ts text, add column slack_submitter_id text;
      alter table study_recovery_requests add constraint study_recovery_requests_status_check check(status in('pending','submitted','consolidated'));
      alter table study_recovery_requests add constraint study_recovery_requests_coverage_dates_check check(covered_start_date<=covered_end_date and covered_missed_days>=1);
      create unique index study_recovery_requests_one_pending_attendance_idx on study_recovery_requests(user_id) where status='pending' and trigger_type='missed_attendance';
      alter table study_recovery_requests enable row level security;
      create policy recovery_owner on study_recovery_requests to authenticated using(auth.uid()=user_id);
      grant select on study_recovery_requests,attendance_days to authenticated;`);
    await f.db.exec('drop function public.effective_reminder_time(date,time)');
    for (const name of ['study_attendance_goal_seconds', 'effective_reminder_time'])
      await f.db.exec(existing('0021_late_study_goal_attendance_policy.sql', name));
    await f.db.exec(readFileSync(root + '20261005131830_study_day_four_am.sql', 'utf8'));
    await f.db.exec(existing('20260722133736_send_initial_reminder_when_present.sql', 'mark_missed_attendance'));
    await f.db.exec(existing('20260827144548_consolidate_pending_attendance_recovery.sql', 'submit_study_recovery_request'));
    await f.at('2026-10-25T00:00:00Z');
    if (seed) await seed(f);
    if (preparation) await f.db.exec(readFileSync(root + preparation, 'utf8'));
    if (beforePolicy) await beforePolicy(f);
    if (migration) await f.db.exec(readFileSync(root + migration, 'utf8'));
  });
  return f;
}
before(async () => { f = await createDb(); });
after(() => f?.db.close());
const fixture = async work => {
  await f.db.exec('begin');
  try { await f.at('2026-10-25T00:00:00Z'); await f.auth(); await work(); }
  finally { await f.db.exec('rollback; reset role'); }
};
const attendance = async (date = '2026-10-25', user = users[0]) => f.admin(() => f.sql(
  'select status,local_date::text,qualifying_session_id from attendance_days where user_id=$1 and local_date=$2', [user,date]));

test('an early completed session below the weekend goal is present immediately and after 14:30', () => fixture(async () => {
  const session = await f.start(users[0], todoId, '2026-10-25');
  assert.equal((await attendance())[0]?.status, 'present');
  await f.at('2026-10-25T01:00:00Z');
  await f.scalar('select to_jsonb(end_study_session($1,0)) value', [session.id]);
  assert.equal(await f.admin(() => f.scalar("select daily_completed_study_seconds($1,'2026-10-25') value", [users[0]])), 3600);
  await f.at('2026-10-25T05:00:00Z');
  await f.admin(() => f.sql('select * from get_due_reminders(now())'));
  await f.at('2026-10-25T05:30:01Z');
  const missed = await f.admin(() => f.sql('select * from mark_missed_attendance(now())'));
  assert.equal(missed.some(row => row.user_id === users[0] && row.local_date.toISOString().slice(0,10) === '2026-10-25'), false);
  assert.equal((await attendance())[0].status, 'present');
}));

test('late afternoon and 03:59 starts earn attendance with zero completed seconds', () => fixture(async () => {
  await f.at('2026-10-25T10:00:00Z');
  const first = await f.start(users[0],todoId,'2026-10-25');
  assert.equal((await attendance())[0].qualifying_session_id,first.id);
  await f.at('2026-10-25T18:59:59Z');
  const second = await f.start(users[1],users[7],'2026-10-25');
  assert.equal(second.local_date,'2026-10-25');
  assert.equal((await attendance('2026-10-25',users[1]))[0].status,'present');
  assert.equal(await f.admin(() => f.scalar("select daily_completed_study_seconds($1,'2026-10-25') value",[users[1]])),0);
}));

test('no-start attendance remains pending at 14:30 and 03:59, then misses exactly at 04:00 once', () => fixture(async () => {
  await f.at('2026-10-25T05:00:00Z');
  const initial = await f.admin(() => f.sql('select * from get_due_reminders(now())'));
  assert.equal(initial.find(row => row.user_id===users[0]).deadline_at.toISOString(),'2026-10-25T19:00:00.000Z');
  assert.equal((await f.admin(() => f.sql('select * from get_due_reminders(now())'))).length,0);
  await f.at('2026-10-25T05:15:00Z');
  assert.equal((await f.admin(() => f.sql('select * from get_due_reminders(now())'))).find(row => row.user_id===users[0]).reminder_stage,'nudge');
  for (const time of ['2026-10-25T05:30:00Z','2026-10-25T18:59:59Z']) {
    await f.at(time); await f.admin(() => f.sql('select * from mark_missed_attendance(now())'));
    assert.equal((await attendance())[0].status,'pending');
  }
  await f.at('2026-10-25T19:00:00Z');
  const missed = await f.admin(() => f.sql('select * from mark_missed_attendance(now())'));
  assert.equal(missed.find(row=>row.user_id===users[0]).local_date.toISOString().slice(0,10),'2026-10-25');
  assert.equal((await attendance())[0].status,'missed');
  assert.equal((await f.admin(() => f.sql('select * from mark_missed_attendance(now())'))).length,0);
}));

test('day-end finalization needs no reminder delivery and skips dates before profile creation', () => fixture(async () => {
  await f.admin(() => f.db.exec(`delete from attendance_days;
    update profiles set created_at='2026-10-25T19:00:00Z' where user_id='${users[1]}';`));
  await f.at('2026-10-25T19:00:00Z');
  const missed=await f.admin(() => f.sql('select * from mark_missed_attendance(now())'));
  assert.equal(missed.some(row=>row.user_id===users[0]),true);
  assert.equal(missed.some(row=>row.user_id===users[1]),false);
}));

test('03:45 reminder never nudges into the next study day, and a 04:00 start credits only the new day', () => fixture(async () => {
  await f.admin(() => f.db.exec(`update profiles set reminder_time='03:45'`));
  await f.at('2026-10-26T18:45:00Z'); // Monday study day, Tuesday 03:45 Tokyo
  assert.equal((await f.admin(() => f.sql('select * from get_due_reminders(now())')))[0].local_date.toISOString().slice(0,10),'2026-10-26');
  await f.at('2026-10-26T19:00:00Z');
  assert.equal((await f.admin(() => f.sql('select * from get_due_reminders(now())'))).length,0);
  await f.start(users[0],todoId,'2026-10-27');
  await f.admin(() => f.sql('select * from mark_missed_attendance(now())'));
  assert.equal((await attendance('2026-10-26'))[0].status,'missed');
  assert.equal((await attendance('2026-10-27'))[0].status,'present');
}));

test('civil 04:00 day-end spans 23/25 DST hours and timezone changes retain saved session attribution', () => fixture(async () => {
  for (const [date,expected] of [['2026-03-07','2026-03-08T08:00:00.000Z'],['2026-10-31','2026-11-01T09:00:00.000Z']]) {
    await f.admin(() => f.db.exec(`update profiles set time_zone='America/New_York',created_at='2026-01-01T00:00Z',reminder_time='20:30'; delete from attendance_days;`));
    await f.at(date+'T10:00:00Z');
    const session=await f.start(users[0],todoId,date);
    assert.equal((await f.admin(() => f.scalar('select deadline_at value from attendance_days where qualifying_session_id=$1',[session.id]))).toISOString(),expected);
    await f.admin(() => f.db.query("update study_sessions set status='completed',ended_at=started_at,duration_seconds=0 where id=$1",[session.id]));
    await f.admin(() => f.db.query('delete from study_todos where id=$1',[todoId]));
  }
  const previous=await f.admin(() => f.sql('select id,local_date::text from study_sessions order by started_at'));
  await f.admin(() => f.db.exec("update profiles set time_zone='Pacific/Auckland'"));
  assert.deepEqual(await f.admin(() => f.sql('select id,local_date::text from study_sessions order by started_at')),previous);
}));

test('old-day completion helper cannot rewrite historical attendance or submit recovery', () => fixture(async () => {
  await f.admin(() => f.db.exec(`insert into attendance_days(user_id,local_date,status,reminder_at,deadline_at,marked_at)
    values('${users[0]}','2026-10-24','missed','2026-10-24T05:00Z','2026-10-24T05:30Z','2026-10-24T05:30Z');
    insert into study_sessions(user_id,local_date,started_at,ended_at,status,duration_seconds)
    values('${users[0]}','2026-10-24','2026-10-24T12:00Z',now(),'completed',14400);`));
  const before=await attendance('2026-10-24');
  assert.equal(await f.admin(() => f.scalar("select promote_attendance_by_daily_study_total($1,'2026-10-24') value",[users[0]])),false);
  assert.deepEqual(await attendance('2026-10-24'),before);
}));

test('guarded recovery creation rechecks final day/status, deduplicates, and never reopens a submitted recovery', () => fixture(async () => {
  const ensure=()=>f.admin(() => f.scalar("select ensure_missed_attendance_recovery($1,'2026-10-25') value",[users[0]]));
  assert.equal((await ensure()).request,null);
  await f.at('2026-10-25T19:00:00Z');
  await f.admin(() => f.sql('select * from mark_missed_attendance(now())'));
  const first=await ensure(); assert.equal(first.created,true);
  const repeat=await ensure(); assert.equal(repeat.created,false); assert.equal(repeat.request.id,first.request.id);
  await f.admin(() => f.db.query("update attendance_days set status='present' where user_id=$1 and local_date='2026-10-25'",[users[0]]));
  assert.equal((await ensure()).request,null);
  await f.admin(() => f.db.query("update attendance_days set status='missed' where user_id=$1 and local_date='2026-10-25'",[users[0]]));
  await f.admin(() => f.db.query("update study_recovery_requests set status='submitted' where id=$1",[first.request.id]));
  assert.equal((await ensure()).request,null);
}));

test('repair changes only the open study day, resolves without fake submission, and preserves past aggregate misses', async () => {
  let baseline;
  let learningBaseline;
  const repaired=await createDb(async x => {
    await x.at('2026-10-25T07:00:00Z');
    for (let i=0;i<7;i++) {
      await x.db.query(`insert into attendance_days(user_id,local_date,status,reminder_at,deadline_at,marked_at)
        values($1,'2026-10-25','missed','2026-10-25T05:00Z','2026-10-25T05:30Z','2026-10-25T05:30Z')`,[users[i]]);
      await x.db.query(`insert into study_recovery_requests(user_id,local_date,status,trigger_type,covered_start_date,covered_end_date,covered_missed_days)
        values($1,$2,$3,$4,$2,'2026-10-25',$5)`,[users[i],i===2?'2026-10-23':'2026-10-25',i===3?'submitted':'pending',i===4?'camera_absence_repeat':'missed_attendance',i===2?3:1]);
    }
    await x.db.exec(`insert into study_sessions(user_id,local_date,started_at,ended_at,status,duration_seconds)
      values('${users[0]}','2026-10-25','2026-10-25T00:00Z','2026-10-25T01:00Z','completed',3600),
        ('${users[6]}','2026-10-25','2026-10-25T00:00Z','2026-10-25T01:00Z','cancelled',3600);
      insert into attendance_days(user_id,local_date,status,reminder_at,deadline_at,marked_at)
        values('${users[2]}','2026-10-23','missed','2026-10-23T12:00Z','2026-10-23T12:30Z','2026-10-23T12:30Z'),
          ('${users[2]}','2026-10-24','missed','2026-10-24T05:00Z','2026-10-24T05:30Z','2026-10-24T05:30Z');
      update study_recovery_requests set local_date='2026-10-24',covered_start_date='2026-10-24',covered_end_date='2026-10-24' where user_id='${users[5]}';`);
    baseline=await x.sql(`select user_id::text,status,reason,submitted_at,covered_start_date::text,covered_end_date::text,covered_missed_days
      from study_recovery_requests where user_id in('${users[3]}','${users[4]}','${users[5]}') order by user_id`);
    learningBaseline=await x.sql('select row_to_json(s) contents from study_sessions s order by id');
  });
  try {
    const rec=await repaired.admin(()=>repaired.sql('select *,covered_start_date::text first_day,covered_end_date::text last_day from study_recovery_requests order by user_id'));
    for(const i of [0,1,6]) {
      assert.equal(rec[i].status,'resolved'); assert.equal(rec[i].submitted_at,null);
      assert.equal(rec[i].reason,null); assert.equal(rec[i].makeup_todo_id,null);
      assert.equal(rec[i].resolution_reason,'attendance_start_policy_current_day');
    }
    assert.equal(rec[2].status,'pending');assert.equal(rec[2].first_day,'2026-10-23');assert.equal(rec[2].last_day,'2026-10-24');assert.equal(rec[2].covered_missed_days,2);
    assert.deepEqual(await repaired.admin(()=>repaired.sql(`select user_id::text,status,reason,submitted_at,covered_start_date::text,covered_end_date::text,covered_missed_days
      from study_recovery_requests where user_id in('${users[3]}','${users[4]}','${users[5]}') order by user_id`)),baseline);
    const days=await repaired.admin(()=>repaired.sql("select user_id,status from attendance_days where local_date='2026-10-25' order by user_id"));
    assert.equal(days[0].status,'present');assert.equal(days[1].status,'pending');assert.equal(days[6].status,'pending');
    assert.equal(await repaired.admin(()=>repaired.scalar('select count(*)::int value from study_todos')),0);
    assert.deepEqual(await repaired.admin(()=>repaired.sql('select row_to_json(s) contents from study_sessions s order by id')),learningBaseline);
    await repaired.auth(users[0]);
    assert.equal((await repaired.scalar("select preview_actual_study_action('start','{}',null,null,0) value")).blocking_error,'CURRENT_TODO_REQUIRED');
    // A stale Slack modal after repair cannot create a task or overwrite the system resolution.
    await repaired.admin(()=>repaired.scalar('select to_jsonb(submit_slack_study_recovery_request($1,$2,$3,$4,$5,$6)) value',
      [rec[0].id,users[0],'slack-owner','reason','makeup','pledge']));
    assert.equal(await repaired.admin(()=>repaired.scalar('select count(*)::int value from study_todos')),0);
    assert.equal((await repaired.admin(()=>repaired.sql('select status from study_recovery_requests where id=$1',[rec[0].id])))[0].status,'resolved');
  } finally { await repaired.db.close(); }
});

test('cancelled-only sessions cannot earn attendance in reminder or day-end qualification', () => fixture(async () => {
  await f.admin(()=>f.db.query(`insert into study_sessions(user_id,local_date,started_at,ended_at,status,duration_seconds)
    values($1,'2026-10-25','2026-10-25T00:00Z','2026-10-25T01:00Z','cancelled',3600)`,[users[0]]));
  await f.at('2026-10-25T05:00:00Z');
  await f.admin(()=>f.sql('select * from get_due_reminders(now())'));
  assert.equal((await attendance())[0].status,'pending');
  await f.at('2026-10-25T19:00:00Z');
  await f.admin(()=>f.sql('select * from mark_missed_attendance(now())'));
  assert.equal((await attendance())[0].status,'missed');
}));

test('Slack atomic submission creates exactly one makeup task; retry has no duplicate and pledge stays text', () => fixture(async () => {
  const rr=await f.admin(()=>f.scalar(`insert into study_recovery_requests(user_id,local_date,status,trigger_type,covered_start_date,covered_end_date,covered_missed_days)
    values($1,'2026-10-24','pending','missed_attendance','2026-10-24','2026-10-24',1) returning id value`,[users[0]]));
  const submit=()=>f.admin(()=>f.scalar('select to_jsonb(submit_slack_study_recovery_request($1,$2,$3,$4,$5,$6)) value',[rr,users[0],'slack-owner','reason','makeup','pledge']));
  const first=await submit();const second=await submit();
  assert.equal(first.status,'submitted');assert.equal(first.makeup_todo_id,second.makeup_todo_id);
  assert.equal(first.pledge_todo_id,null);assert.equal(first.slack_submitter_id,'slack-owner');
  assert.equal(await f.admin(()=>f.scalar('select count(*)::int value from study_todos')),1);
}));

async function rejected(work,pattern) {
  await f.db.exec('savepoint rejected');
  try { await assert.rejects(work,pattern); } finally { await f.db.exec('rollback to savepoint rejected'); }
}
test('authentication, owner todos, pending recovery and one-active-session gates survive; team contribution still connects',()=>fixture(async()=>{
  await f.auth(null);
  await rejected(()=>f.scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[todoId]]),/Not authenticated/);
  await f.auth();
  await rejected(()=>f.scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[]]),/At least one/);
  await f.admin(()=>f.db.query("insert into study_todos(id,user_id,local_date,title) values($1,$2,'2026-10-25','Other owner')",[todoId,users[1]]));
  await rejected(()=>f.scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[todoId]]),/owned, incomplete/);
  assert.equal(await f.scalar('select count(*)::int value from study_todos'),0);
  assert.equal(await f.scalar('select count(*)::int value from study_sessions'),0);
  await f.admin(()=>f.db.query('delete from study_todos where id=$1',[todoId]));
  const team=await f.action('create_team',{name:'Attendance team'});assert.equal(team.ok,true);
  const session=await f.start(users[0],todoId,'2026-10-25');
  assert.equal((await f.snapshot()).connection.session_id,session.id);
  assert.equal(new Date(session.lease_expires_at).toISOString(),'2026-10-25T01:00:00.000Z');
  await rejected(()=>f.scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[todoId]]),/unique|duplicate/);
  await f.admin(()=>f.db.query(`insert into study_recovery_requests(user_id,local_date,trigger_type,status,covered_start_date,covered_end_date,covered_missed_days)
    values($1,'2026-10-24','camera_absence_repeat','pending','2026-10-24','2026-10-24',1)`,[users[1]]));
  await f.auth(users[1]);
  await rejected(()=>f.scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[users[7]]]),/Recovery routine required/);
  await rejected(()=>f.scalar("select ensure_missed_attendance_recovery($1,'2026-10-24') value",[users[1]]),/permission denied/);
  await rejected(()=>f.scalar('select submit_slack_study_recovery_request(null,null,null,null,null,null) value'),/permission denied/);
}));

test('existing authenticated submission cannot reopen a system-resolved request and RLS hides other owners',()=>fixture(async()=>{
  const id=await f.admin(()=>f.scalar(`insert into study_recovery_requests(user_id,local_date,trigger_type,status,covered_start_date,covered_end_date,covered_missed_days,resolved_at,resolution_reason)
    values($1,'2026-10-25','missed_attendance','resolved','2026-10-25','2026-10-25',1,now(),'attendance_start_policy_current_day') returning id value`,[users[0]]));
  await rejected(()=>f.scalar("select submit_study_recovery_request($1,'reason','makeup','pledge') value",[id]),/already submitted/);
  assert.equal(await f.scalar('select count(*)::int value from study_todos'),0);
  await f.auth(users[1]);
  assert.equal(await f.scalar('select count(*)::int value from study_recovery_requests'),0);
}));

test('cron resumes after multiple days: finalizes existing pending days, creates only yesterday, preserves final rows and older gaps',()=>fixture(async()=>{
  await f.admin(()=>f.db.exec(`delete from attendance_days;
    insert into attendance_days(user_id,local_date,status,reminder_at,deadline_at,marked_at)
      values('${users[0]}','2026-10-21','pending','2026-10-21T12:00Z','2026-10-21T12:30Z','2026-10-21T12:00Z'),
        ('${users[0]}','2026-10-22','pending','2026-10-22T12:00Z','2026-10-22T12:30Z','2026-10-22T12:00Z'),
        ('${users[0]}','2026-10-23','present','2026-10-23T12:00Z','2026-10-23T12:30Z','2026-10-23T12:00Z');
    insert into study_sessions(user_id,local_date,started_at,ended_at,status,duration_seconds)
      values('${users[0]}','2026-10-22','2026-10-22T00:00Z','2026-10-22T00:10Z','completed',600);`));
  const missed=await f.admin(()=>f.sql('select * from mark_missed_attendance(now())'));
  assert.equal(missed.filter(row=>row.user_id===users[0]).length,2);
  assert.deepEqual(await f.admin(()=>f.sql('select local_date::text,status from attendance_days where user_id=$1 order by local_date',[users[0]])),[
    {local_date:'2026-10-21',status:'missed'},{local_date:'2026-10-22',status:'present'},
    {local_date:'2026-10-23',status:'present'},{local_date:'2026-10-24',status:'missed'},
  ]);
  assert.equal((await f.admin(()=>f.sql('select * from mark_missed_attendance(now())'))).length,0);
}));

test('profile creation at the civil 04:00 boundary and changing timezone never manufacture a pre-enrollment miss',()=>fixture(async()=>{
  await f.admin(()=>f.db.exec(`delete from attendance_days;
    update profiles set created_at='2026-10-25T18:59:59Z' where user_id='${users[0]}';
    update profiles set created_at='2026-10-25T19:00:00Z' where user_id='${users[1]}';
    update profiles set created_at='2026-10-25T19:00:00Z',time_zone='America/New_York' where user_id='${users[2]}';
    update profiles set created_at='2026-10-25T19:00:00Z',time_zone='Pacific/Auckland' where user_id='${users[3]}';`));
  await f.at('2026-10-25T18:59:58Z');
  let missed=await f.admin(()=>f.sql('select * from mark_missed_attendance(now())'));
  assert.equal(missed.some(row=>[users[0],users[1],users[2],users[3]].includes(row.user_id)),false);
  await f.at('2026-10-25T19:00:00Z');
  missed=await f.admin(()=>f.sql('select * from mark_missed_attendance(now())'));
  assert.equal(missed.some(row=>row.user_id===users[0]),true);
  assert.equal(missed.some(row=>[users[1],users[2],users[3]].includes(row.user_id)),false);
}));

test('a future-dated session cannot qualify attendance for the open study day',()=>fixture(async()=>{
  await f.admin(()=>f.db.query(`insert into study_sessions(user_id,local_date,started_at,status)
    values($1,'2026-10-25','2026-10-26T19:00Z','active')`,[users[0]]));
  assert.equal(await f.admin(()=>f.scalar("select promote_attendance_by_daily_study_total($1,'2026-10-25') value",[users[0]])),false);
  await f.at('2026-10-25T05:00:00Z');
  await f.admin(()=>f.sql('select * from get_due_reminders(now())'));
  assert.equal((await attendance())[0].status,'pending');
}));

test('preparation RPCs work on the old schema before policy deployment, with service-only grants and fixed search paths',async()=>{
  const prepared=await createDb(null,async x=>{
    assert.equal(await x.scalar("select exists(select 1 from information_schema.columns where table_name='study_recovery_requests' and column_name='resolved_at') value"),false);
    assert.equal((await x.scalar("select ensure_missed_attendance_recovery($1,'2026-10-25') value",[users[0]])).request,null);
    for (const signature of ['ensure_missed_attendance_recovery(uuid,date)','submit_slack_study_recovery_request(uuid,uuid,text,text,text,text)']) {
      assert.equal(await x.scalar("select has_function_privilege('authenticated',$1,'execute') value",[signature]),false);
      assert.equal(await x.scalar("select has_function_privilege('anon',$1,'execute') value",[signature]),false);
      assert.equal(await x.scalar("select has_function_privilege('service_role',$1,'execute') value",[signature]),true);
      assert.match((await x.scalar('select array_to_string(proconfig,$$;$$) value from pg_proc where oid=$1::regprocedure',[signature])),/search_path=""/);
    }
  });
  await prepared.db.close();
});
