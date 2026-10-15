import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTeamDb, users } from './fixtures/team-study-db.mjs';

let f;
before(async () => { f = await createTeamDb({ automaticTeams: true }); });
after(async () => f?.db.close());
const fixture = async work => {
  await f.db.exec('begin');
  try { await f.at('2026-10-12T09:00:00Z'); await f.auth(); await work(); }
  finally { await f.db.exec('rollback; reset role'); }
};
const create = async () => { assert.equal((await f.action('create_team', { name: 'Automatic team' })).ok, true); return (await f.snapshot()).team; };
const end = id => f.scalar('select to_jsonb(end_study_session($1,0)) value', [id]);

test('personal start contributes automatically without reading team screen or calling connect', () => fixture(async () => {
  const team = await create(); const s = await f.start();
  assert.equal((await f.snapshot()).connection?.session_id, s.id);
  await f.at('2026-10-12T09:30:00Z'); await end(s.id);
  const snapshot = await f.snapshot();
  assert.equal(snapshot.forest.accepted_seconds, 1800); assert.equal(snapshot.team.id, team.id);
  assert.equal(snapshot.connection, null); assert.equal(snapshot.members[0].state, 'ready');
}));
test('joining during study checkpoints at membership acceptance, never counts older personal time', () => fixture(async () => {
  await create(); const invite = await f.action('create_invite');
  const s = await f.start(users[1]); await f.at('2026-10-12T09:10:00Z');
  assert.equal((await f.action('preview_invite', { token: invite.token })).ok, true);
  assert.equal((await f.snapshot()).connection, null);
  assert.equal((await f.action('accept_invite', { token: invite.token })).ok, true);
  assert.equal((await f.snapshot()).connection?.session_id, s.id);
  await f.at('2026-10-12T09:30:00Z'); await end(s.id);
  assert.equal((await f.snapshot()).forest.accepted_seconds, 1200);
  assert.equal(await f.scalar('select duration_seconds value from study_sessions where id=$1', [s.id]), 1800);
}));
test('creating a team during active study starts contribution at creation', () => fixture(async () => {
  const s = await f.start(); await f.at('2026-10-12T09:10:00Z'); await create();
  assert.equal((await f.snapshot()).connection?.session_id, s.id);
  await f.at('2026-10-12T09:20:00Z'); await end(s.id);
  assert.equal((await f.snapshot()).forest.accepted_seconds, 600);
}));
test('pause/resume, camera exclusion and repeated connects never double team credit', () => fixture(async () => {
  await create(); const s = await f.start();
  await f.at('2026-10-12T09:10:00Z'); await f.scalar('select to_jsonb(pause_study_session($1)) value', [s.id]);
  assert.equal((await f.snapshot()).members[0].state, 'resting');
  await f.at('2026-10-12T09:15:00Z'); await f.scalar('select to_jsonb(resume_study_session($1)) value', [s.id]);
  await f.action('connect', { session_id: s.id }); await f.action('connect', { session_id: s.id });
  await f.at('2026-10-12T09:25:00Z'); await f.scalar('select checkpoint_actual_study_exclusion($1,120) value', [s.id]);
  await f.scalar('select to_jsonb(end_study_session($1,120)) value', [s.id]);
  assert.equal((await f.snapshot()).forest.accepted_seconds, 1080);
  assert.equal(await f.admin(() => f.scalar('select count(*)::int value from team_study_private.connections')), 1);
}));
test('active team focus joins automatically on proposal and late personal start', () => fixture(async () => {
  await create(); const invite = await f.action('create_invite'); const first = await f.start();
  await f.action('propose_round', { duration_minutes: 25 });
  assert.equal((await f.snapshot()).round.joined, true);
  assert.equal((await f.snapshot()).round.ends_at, '2026-10-12T09:25:00+00:00');
  await f.auth(users[1]); await f.action('accept_invite', { token: invite.token });
  await f.at('2026-10-12T09:10:00Z'); await f.start(users[1], users[7]);
  assert.equal((await f.snapshot()).round.joined, true);
  assert.equal((await f.snapshot()).round.ends_at, '2026-10-12T09:25:00+00:00');
  await f.at('2026-10-12T09:30:00Z'); await f.auth();
  assert.equal(await f.scalar('select status value from study_sessions where id=$1', [first.id]), 'active');
}));
test('goals save publicly without share flag while old private values stay private', () => fixture(async () => {
  await create(); const invite = await f.action('create_invite');
  await f.admin(() => f.db.query("update team_study_private.members set goal='Old private',share_goal=false where user_id=$1", [users[0]]));
  await f.auth(users[1]); await f.action('accept_invite', { token: invite.token });
  assert.equal((await f.snapshot()).members.find(m => m.user_id === users[0]).goal, null);
  await f.auth(); assert.equal((await f.action('set_goal', { goal: '  New goal  ' })).ok, true);
  await f.auth(users[1]); assert.equal((await f.snapshot()).members.find(m => m.user_id === users[0]).goal, 'New goal');
  await f.auth(); await f.action('set_goal', { goal: '' });
  await f.auth(users[1]); assert.equal((await f.snapshot()).members.find(m => m.user_id === users[0]).goal, null);
}));
test('transfer/leave stops future credit and never ends personal study', () => fixture(async () => {
  const team = await create(); const invite = await f.action('create_invite');
  await f.auth(users[1]); await f.action('accept_invite', { token: invite.token }); await f.auth();
  const s = await f.start(); await f.at('2026-10-12T09:10:00Z');
  assert.equal((await f.action('leave_team', { successor_id: users[1] })).ok, true);
  assert.equal(await f.scalar('select status value from study_sessions where id=$1', [s.id]), 'active');
  await f.at('2026-10-12T09:20:00Z'); await end(s.id); await f.auth(users[1]);
  assert.equal((await f.snapshot()).team.owner_id, users[1]);
  assert.equal((await f.snapshot()).team.id, team.id); assert.equal((await f.snapshot()).forest.accepted_seconds, 600);
}));
test('old UI reconnect is idempotent and resume restores automatic contribution after disconnect', () => fixture(async () => {
  await create(); const s=await f.start(); await f.at('2026-10-12T09:05:00Z'); await f.action('disconnect');
  assert.equal((await f.action('connect',{session_id:s.id})).ok,true);
  assert.equal((await f.action('connect',{session_id:s.id})).ok,true);
  await f.at('2026-10-12T09:10:00Z');await f.action('disconnect');
  await f.scalar('select to_jsonb(pause_study_session($1)) value',[s.id]);
  await f.at('2026-10-12T09:15:00Z');await f.scalar('select to_jsonb(resume_study_session($1)) value',[s.id]);
  assert.equal((await f.snapshot()).connection.session_id,s.id);
  await f.at('2026-10-12T09:20:00Z');await end(s.id);
  assert.equal((await f.snapshot()).forest.accepted_seconds,900);
}));
test('new RPCs and auto-connect helpers retain registered account and owner boundaries', () => fixture(async () => {
  const team=await create();const invite=await f.action('create_invite');const s=await f.start();
  await f.auth(users[1]);assert.equal((await f.action('connect',{session_id:s.id})).error,'SESSION_REQUIRED');
  await f.action('accept_invite',{token:invite.token});assert.equal((await f.action('leave_team',{close:true})).error,'OWNER_REQUIRED');
  await f.auth(users[8]);assert.equal((await f.action('create_team',{name:'No'})).error,'ACCOUNT_REQUIRED');
  for(const role of ['anon','authenticated'])assert.equal(await f.admin(()=>f.scalar("select has_function_privilege($1,'team_study_private.auto_connect(uuid,boolean)','execute') value",[role])),false);
  await f.auth(users[1]);assert.equal((await f.snapshot()).team.id,team.id);
}));
test('another registered team account sees start/pause/goal and leadership without personal records', () => fixture(async () => {
  await create();const invite=await f.action('create_invite');await f.auth(users[1]);await f.action('accept_invite',{token:invite.token});
  await f.auth();await f.action('set_goal',{goal:'Shared goal'});const s=await f.start();
  await f.auth(users[1]);let member=(await f.snapshot()).members.find(m=>m.user_id===users[0]);
  assert.equal(member.state,'studying');assert.equal(member.goal,'Shared goal');assert.equal(member.title,null);
  assert.deepEqual(await f.sql('select * from study_sessions where user_id=$1',[users[0]]),[]);
  await f.auth();await f.scalar('select to_jsonb(pause_study_session($1)) value',[s.id]);
  await f.auth(users[1]);assert.equal((await f.snapshot()).members.find(m=>m.user_id===users[0]).state,'resting');
  await f.auth();await f.action('leave_team',{successor_id:users[1]});await f.auth(users[1]);assert.equal((await f.snapshot()).team.owner_id,users[1]);
}));
test('lease expiry caps automatic team credit and next-day study keeps membership', () => fixture(async () => {
  const team=await create();const s=await f.start();await f.at('2026-10-12T11:00:00Z');await end(s.id);
  assert.equal((await f.snapshot()).forest.accepted_seconds,3600);
  await f.at('2026-10-13T09:00:00Z');const next=await f.start(users[0],users[7],'2026-10-13');
  assert.equal((await f.snapshot()).team.id,team.id);assert.equal((await f.snapshot()).connection.session_id,next.id);
}));
test('applying release to active members checkpoints now and preserves a private goal', async()=>{
  const old=await createTeamDb();
  try{
    await old.action('create_team',{name:'Existing'});const s=await old.start();await old.action('set_goal',{goal:'Private',share:false});
    await old.at('2026-10-12T09:10:00Z');await old.admin(()=>old.db.exec(readFileSync('supabase/migrations/20261015035420_team_automatic_study.sql','utf8')));
    assert.equal((await old.snapshot()).connection.session_id,s.id);assert.equal((await old.snapshot()).members[0].share_goal,false);
    await old.at('2026-10-12T09:20:00Z');await old.scalar('select to_jsonb(end_study_session($1,0)) value',[s.id]);
    assert.equal((await old.snapshot()).forest.accepted_seconds,600);
  }finally{await old.db.close();}
});
test('a session discovered after prelock returns RETRY and rolls back the entire round proposal',()=>fixture(async()=>{
  await create();const invite=await f.action('create_invite');await f.auth(users[1]);await f.action('accept_invite',{token:invite.token});await f.auth();
  await f.admin(()=>f.db.exec(`
   insert into public.study_todos(id,user_id,local_date,title)values('${users[7]}','${users[1]}','2026-10-12','Late start');
   alter function team_study_private.mutate_focus(uuid,text,jsonb) rename to original_focus;
   create function team_study_private.mutate_focus(p_user uuid,p_action text,p_payload jsonb) returns jsonb
   language plpgsql set search_path='' as $$declare result jsonb;begin
    result:=team_study_private.original_focus(p_user,p_action,p_payload);
    if p_action='propose_round' then
     insert into public.study_sessions(id,user_id,local_date,lease_expires_at)values('${users[6]}','${users[1]}','2026-10-12',now()+interval '1 hour');
     insert into public.study_actual_sessions(session_id,user_id,current_todo_id)values('${users[6]}','${users[1]}','${users[7]}');
     insert into public.study_todo_segments(user_id,session_id,todo_id,started_at)values('${users[1]}','${users[6]}','${users[7]}',now());
    end if;
    return result;
   end $$;
  `));
  assert.equal((await f.action('propose_round',{duration_minutes:25})).error,'RETRY');
  assert.equal((await f.snapshot()).round,null);
  assert.equal(await f.admin(()=>f.scalar('select count(*)::int value from study_sessions')),0);
  assert.equal(await f.admin(()=>f.scalar('select count(*)::int value from team_study_private.connections')),0);
}));
