import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createTeamDb, users } from './fixtures/team-study-db.mjs';

let f;
before(async () => { f = await createTeamDb({ teamMigration: existsSync('supabase/migrations/20261012143354_team_study_room.sql') }); });
after(async () => f?.db.close());
const fixture = async work => {
  await f.db.exec('begin');
  try { await f.at('2026-10-12T09:00:00Z'); await f.auth(); await work(); }
  finally { await f.db.exec('rollback; reset role'); }
};
const create = async () => { const r = await f.action('create_team', { name: 'Study team', time_zone: 'Asia/Tokyo' }); assert.equal(r.ok, true); return (await f.snapshot()).team; };
const invite = async () => { const r = await f.action('create_invite'); assert.equal(r.ok, true); return r; };
const join = async (token, user = users[1]) => { await f.auth(user); return f.action('accept_invite', { token }); };

test('registered accounts can create a team with private-by-default member snapshot', () => fixture(async () => {
  const team = await create(); const s = await f.snapshot();
  assert.equal(team.member_count, 1); assert.equal(s.members[0].title, null); assert.equal(s.members[0].state, 'ready');
  assert.equal(s.forest.accepted_seconds, 0); assert.deepEqual(s.invitations, []);
}));
test('RPC denies anonymous accounts and unauthenticated roles', () => fixture(async () => {
  await f.auth(users[8]); assert.equal((await f.action('create_team', { name: 'Bad' })).error, 'ACCOUNT_REQUIRED');
  assert.equal((await f.snapshot()).error, 'ACCOUNT_REQUIRED');
  await f.auth(null, 'anon'); await assert.rejects(f.action('create_team', { name: 'Bad' }), /permission denied/);
}));
test('link preview never joins; hash-only tokens expire, revoke and reject invalid tokens', () => fixture(async () => {
  await create(); const r = await invite(); assert.match(r.token, /^[0-9a-f]{64}$/);
  const stored = await f.admin(() => f.sql('select token_hash from team_study_private.invitations'));
  assert.notEqual(stored[0].token_hash, r.token);
  await f.auth(users[1]); assert.equal((await f.action('preview_invite', { token: r.token })).team.name, 'Study team');
  assert.equal((await f.snapshot()).team, null);
  assert.equal((await f.action('accept_invite', { token: 'bad' })).error, 'INVITE_INVALID');
  await f.auth(); await f.action('revoke_invite', { invite_id: r.invite_id });
  assert.equal((await join(r.token)).error, 'INVITE_INVALID');
  await f.auth(); const next = await invite(); await f.at('2026-10-19T09:00:00Z');
  assert.equal((await join(next.token)).error, 'INVITE_INVALID');
}));
test('capacity, one-team and repeated join remain atomic/idempotent', () => fixture(async () => {
  await create(); const r = await invite();
  for (const user of users.slice(1,6)) assert.equal((await join(r.token,user)).ok, true);
  assert.equal((await join(r.token)).ok, true);
  assert.equal((await join(r.token,users[6])).error, 'TEAM_FULL');
  await f.auth(users[6]); await create(); assert.equal((await f.action('accept_invite', { token: r.token })).error, 'ALREADY_IN_TEAM');
}));
test('public tags normalize exactly and recipient explicitly accepts targeted invitation', () => fixture(async () => {
  await f.auth(users[1]); assert.equal((await f.action('set_tag',{tag:'  Alice#AB12  '})).tag, 'alice#ab12');
  await f.auth(); await create(); assert.equal((await f.action('lookup_tag',{tag:'alice'})).error, 'INVALID_TAG');
  const found = await f.action('lookup_tag',{tag:'ALICE#AB12'}); assert.equal(found.tag, 'alice#ab12');
  assert.equal(found.email, undefined); const sent = await f.action('invite_tag',{tag:'alice#ab12'});
  assert.equal(sent.ok,true); await f.auth(users[2]); assert.equal((await f.action('respond_invite',{invite_id:sent.invite_id,accept:true})).error,'INVITE_INVALID');
  await f.auth(users[1]); assert.equal((await f.snapshot()).invitations.length,1); assert.equal((await f.snapshot()).team,null);
  assert.equal((await f.action('respond_invite',{invite_id:sent.invite_id,accept:true})).ok,true);
}));
test('invalid discovery attempts consume a persistent rate limit', () => fixture(async () => {
  for(let i=0;i<20;i++) assert.equal((await f.action('lookup_tag',{tag:'invalid'})).error,'INVALID_TAG');
  assert.equal((await f.action('lookup_tag',{tag:'invalid'})).error,'RATE_LIMITED');
  await f.at('2026-10-12T09:01:00Z'); assert.equal((await f.action('lookup_tag',{tag:'invalid'})).error,'INVALID_TAG');
}));
test('owner cannot abandon others, may transfer or explicitly close without deleting personal session', () => fixture(async () => {
  await create(); const i=await invite(); await join(i.token); await f.auth(); const s=await f.start();
  assert.equal((await f.action('leave_team')).error,'OWNER_SUCCESSOR_REQUIRED');
  assert.equal((await f.action('leave_team',{successor_id:users[1]})).ok,true);
  await f.auth(users[1]); assert.equal((await f.snapshot()).team.owner_id,users[1]);
  assert.equal((await f.action('leave_team',{close:true})).ok,true);
  await f.auth(); assert.equal((await f.snapshot()).team,null);
  assert.equal(await f.scalar('select status value from study_sessions where id=$1',[s.id]),'active');
}));
test('desks derive lease and pause, share only explicit current title, signal only safe revision', () => fixture(async () => {
  const team=await create(); const i=await invite(); await join(i.token); await f.auth(); const s=await f.start();
  await f.auth(users[1]); let m=(await f.snapshot()).members.find(x=>x.user_id===users[0]); assert.equal(m.state,'studying'); assert.equal(m.title,null);
  assert.deepEqual(await f.sql('select * from study_sessions where user_id=$1',[users[0]]),[]);
  await f.auth(); await f.action('set_share_title',{share:true}); await f.auth(users[1]); m=(await f.snapshot()).members.find(x=>x.user_id===users[0]); assert.equal(m.title,'Private title');
  await f.auth(); await f.scalar('select to_jsonb(pause_study_session($1)) value',[s.id]); await f.auth(users[1]); assert.equal((await f.snapshot()).members.find(x=>x.user_id===users[0]).state,'resting');
  await f.at('2026-10-12T11:00:00Z'); assert.equal((await f.snapshot()).members.find(x=>x.user_id===users[0]).state,'ready');
  const signals=await f.sql('select * from team_study_signals where team_id=$1',[team.id]); assert.deepEqual(Object.keys(signals[0]).sort(),['revision','team_id']);
  await f.auth(users[7]); assert.deepEqual(await f.sql('select * from team_study_signals'),[]);
  await assert.rejects(f.db.query('update team_study_signals set revision=999'),/permission denied/);
}));
test('one shared proposal starts once on valid connection, never changes personal timer', () => fixture(async () => {
  await create(); assert.equal((await f.action('propose_round',{duration_minutes:25})).ok,true);
  assert.equal((await f.action('propose_round',{duration_minutes:50})).error,'ROUND_EXISTS');
  assert.equal((await f.snapshot()).round.started_at,null); assert.equal((await f.action('connect',{session_id:users[7]})).error,'SESSION_REQUIRED');
  const s=await f.start(); await f.at('2026-10-12T09:10:00Z'); assert.equal((await f.action('connect',{session_id:s.id})).ok,true);
  const r=(await f.snapshot()).round; assert.equal(r.started_at,'2026-10-12T09:10:00+00:00'); assert.equal(r.ends_at,'2026-10-12T09:35:00+00:00');
  assert.equal((await f.action('connect',{session_id:s.id})).ok,true); assert.equal((await f.snapshot()).round.started_at,r.started_at);
  await f.action('cancel_round'); assert.equal((await f.snapshot()).round,null); assert.equal(await f.scalar('select status value from study_sessions where id=$1',[s.id]),'active');
}));
test('custom focus duration uses one server deadline and completion only notifies', () => fixture(async () => {
  const team=await create(); const s=await f.start();
  assert.equal((await f.action('propose_round',{duration_minutes:37})).ok,true);
  await f.action('connect',{session_id:s.id});
  assert.equal((await f.snapshot()).round.ends_at,'2026-10-12T09:37:00+00:00');
  await f.at('2026-10-12T09:37:00Z'); const completed=await f.snapshot();
  assert.equal(completed.round.duration_minutes,37); assert.equal(completed.round.joined,true);
  assert.equal(completed.team.id,team.id); assert.equal(completed.connection.session_id,s.id);
  assert.equal(await f.scalar('select status value from study_sessions where id=$1',[s.id]),'active');
  assert.equal((await f.action('propose_round',{duration_minutes:12})).ok,true);
  assert.equal((await f.snapshot()).round.started_at,null);
}));
test('unlimited focus starts without deadline and remains until explicitly finished', () => fixture(async () => {
  await create(); const s=await f.start();
  assert.equal((await f.action('propose_round',{duration_minutes:null})).ok,true);
  await f.action('connect',{session_id:s.id});
  const round=(await f.snapshot()).round; assert.equal(round.started_at,'2026-10-12T09:00:00+00:00');
  assert.equal(round.duration_minutes,null); assert.equal(round.ends_at,null);
  await f.at('2026-10-13T09:00:00Z'); assert.equal((await f.snapshot()).round.id,round.id);
  assert.equal((await f.action('propose_round',{duration_minutes:25})).error,'ROUND_EXISTS');
  await f.action('cancel_round'); assert.equal((await f.snapshot()).round,null);
}));
test('focus duration rejects malformed or unbounded numeric input before creating a round', () => fixture(async () => {
  await create();
  for(const payload of [{},{duration_minutes:0},{duration_minutes:-1},{duration_minutes:1441},{duration_minutes:1.5},{duration_minutes:'25'},{duration_minutes:true},{duration_minutes:{}}]) {
    assert.equal((await f.action('propose_round',payload)).error,'INVALID_PAYLOAD',JSON.stringify(payload));
    assert.equal((await f.snapshot()).round,null);
  }
  assert.equal((await f.action('propose_round',{duration_minutes:1440})).ok,true);
}));
test('team goal stays private until opted in and persists after today study ends', () => fixture(async () => {
  const team=await create(); const i=await invite(); await join(i.token); await f.auth();
  assert.equal((await f.action('set_goal',{goal:'백엔드 취업 준비',share:false})).ok,true);
  assert.equal((await f.snapshot()).members.find(m=>m.user_id===users[0]).goal,'백엔드 취업 준비');
  await f.auth(users[1]); assert.equal((await f.snapshot()).members.find(m=>m.user_id===users[0]).goal,null);
  await f.auth(); await f.action('set_goal',{goal:'백엔드 취업 준비',share:true});
  await f.auth(users[1]); assert.equal((await f.snapshot()).members.find(m=>m.user_id===users[0]).goal,'백엔드 취업 준비');
  await f.auth(); const s=await f.start(); await f.action('connect',{session_id:s.id});
  await f.at('2026-10-12T09:30:00Z'); await f.scalar('select to_jsonb(end_study_session($1,0)) value',[s.id]);
  const ended=await f.snapshot(); assert.equal(ended.team.id,team.id); assert.equal(ended.members.length,2);
  assert.equal(ended.connection,null); assert.equal(ended.members.find(m=>m.user_id===users[0]).state,'ready');
  assert.equal(ended.members.find(m=>m.user_id===users[0]).goal,'백엔드 취업 준비');
  await f.at('2026-10-13T09:00:00Z'); const next=await f.start(users[0],users[7],'2026-10-13');
  assert.equal((await f.action('connect',{session_id:next.id})).ok,true); assert.equal((await f.snapshot()).team.id,team.id);
}));
test('team goal input is member-owned, bounded and share can be revoked', () => fixture(async () => {
  await create();
  for(const payload of [{goal:'x',share:'yes'},{goal:12,share:true},{goal:'x'.repeat(161),share:true}])
    assert.equal((await f.action('set_goal',payload)).error,'INVALID_PAYLOAD');
  await f.action('set_goal',{goal:'  독서 습관  ',share:true});
  assert.equal((await f.snapshot()).members[0].goal,'독서 습관');
  await f.action('set_goal',{goal:'독서 습관',share:false}); assert.equal((await f.snapshot()).members[0].share_goal,false);
  await f.auth(users[1]); assert.equal((await f.action('set_goal',{goal:'접근 금지',share:true})).error,'TEAM_REQUIRED');
  await f.auth(); await f.action('set_goal',{goal:' ',share:true}); assert.equal((await f.snapshot()).members[0].goal,null);
}));
test('checkpointed contribution excludes pre-join, pause, camera deduction and reconnect gaps', () => fixture(async () => {
  await create(); const s=await f.start(); await f.at('2026-10-12T09:10:00Z'); await f.action('connect',{session_id:s.id});
  assert.equal((await f.snapshot()).forest.pending_sessions,1); assert.equal((await f.snapshot()).forest.accepted_seconds,0);
  await f.at('2026-10-12T09:20:00Z'); await f.scalar('select checkpoint_actual_study_exclusion($1,120) value',[s.id]);
  await f.at('2026-10-12T09:25:00Z'); await f.scalar('select to_jsonb(pause_study_session($1)) value',[s.id]);
  await f.at('2026-10-12T09:30:00Z'); await f.scalar('select to_jsonb(resume_study_session($1)) value',[s.id]);
  await f.at('2026-10-12T09:35:00Z'); await f.action('disconnect');
  await f.at('2026-10-12T09:40:00Z'); await f.action('connect',{session_id:s.id});
  await f.at('2026-10-12T09:50:00Z'); await f.scalar('select to_jsonb(end_study_session($1,120)) value',[s.id]);
  const snapshot=await f.snapshot(); assert.equal(snapshot.connection,null); assert.equal(snapshot.forest.pending_sessions,0); assert.equal(snapshot.forest.accepted_seconds,1680);
  assert.equal(await f.scalar('select duration_seconds value from study_sessions where id=$1',[s.id]),2580);
  const accepted=await f.admin(()=>f.scalar('select sum(accepted_seconds)::integer value from study_todo_segments where session_id=$1',[s.id])); assert.equal(accepted,2580);
  assert.equal((await f.snapshot()).forest.accepted_seconds,1680);
}));
test('lease end caps contribution, missing actual tracking never fabricates forest time', () => fixture(async () => {
  await create(); const s=await f.start(); await f.at('2026-10-12T09:50:00Z'); await f.action('connect',{session_id:s.id});
  await f.at('2026-10-12T11:00:00Z'); assert.equal((await f.action('connect',{session_id:s.id})).error,'SESSION_REQUIRED');
  await f.scalar('select to_jsonb(end_study_session($1,0)) value',[s.id]); assert.equal((await f.snapshot()).forest.accepted_seconds,600);
  await f.admin(()=>f.db.query("insert into study_sessions(user_id,local_date,lease_expires_at)values($1,'2026-10-12',now()+interval '1 hour')",[users[0]]));
  const id=await f.scalar("select id value from study_sessions where status='active'"); assert.equal((await f.action('connect',{session_id:id})).error,'TRACKING_REQUIRED');
}));
test('private tables and helpers are inaccessible, only two guarded public RPCs executable', () => fixture(async () => {
  await f.db.exec('savepoint denied');
  await assert.rejects(f.db.query('select * from team_study_private.members'),/permission denied/);
  await f.db.exec('rollback to denied');
  const procs=await f.admin(()=>f.sql("select proname,prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'team_study_%'"));
  assert.equal(procs.length,2); for(const p of procs){ assert.equal(p.prosecdef,true); assert.ok(p.proconfig.includes('search_path=""')); }
  assert.equal(await f.admin(()=>f.scalar("select has_function_privilege('anon','public.team_study_snapshot()','execute') value")),false);
}));

test('membership RLS helper cannot inspect membership of another account', () => fixture(async () => {
  const t=await create(); await f.auth(users[7]);
  assert.equal(await f.scalar('select team_study_private.is_member($1,$2) value',[t.id,users[0]]),false);
}));
test('fresh lease heartbeats do not broadcast but lease revival invalidates', () => fixture(async () => {
  const t=await create(); const s=await f.start();
  const before=await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id]);
  await f.admin(()=>f.db.query("update study_sessions set lease_expires_at=lease_expires_at+interval '1 minute'where id=$1",[s.id]));
  assert.equal(await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id]),before);
  await f.at('2026-10-12T11:00:00Z');
  await f.admin(()=>f.db.query("update study_sessions set lease_expires_at=now()+interval '1 hour'where id=$1",[s.id]));
  assert.ok(await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id])>before);
}));
test('tag conflict and malformed invitation attempts retain rate counters', () => fixture(async () => {
  await f.action('set_tag',{tag:'alice#ab12'}); await f.auth(users[1]);
  assert.equal((await f.action('set_tag',{tag:'ALICE#AB12'})).error,'CONFLICT');
  for(let i=0;i<19;i++) assert.equal((await f.action('respond_invite',{invite_id:'not-a-uuid',accept:true})).error,'INVALID_PAYLOAD');
  assert.equal((await f.action('respond_invite',{invite_id:'not-a-uuid',accept:true})).error,'RATE_LIMITED');
}));
test('leaving revokes signal access, keeps historical forest and stops only future contribution', () => fixture(async () => {
  const t=await create(); const i=await invite(); await join(i.token); await f.auth();const s=await f.start();
  await f.at('2026-10-12T09:10:00Z'); await f.action('connect',{session_id:s.id});
  await f.at('2026-10-12T09:20:00Z');await f.action('leave_team',{successor_id:users[1]});
  assert.deepEqual(await f.sql('select * from team_study_signals'),[]);
  await f.at('2026-10-12T09:30:00Z');await f.scalar('select to_jsonb(end_study_session($1,0)) value',[s.id]);
  await f.auth(users[1]);assert.equal((await f.snapshot()).forest.accepted_seconds,600);
  assert.equal((await f.sql('select * from team_study_signals where team_id=$1',[t.id])).length,1);
}));
test('only owner issues links and remaining member cannot close team', () => fixture(async () => {
  await create();const i=await invite();await join(i.token);
  assert.equal((await f.action('create_invite')).error,'OWNER_REQUIRED');
  assert.equal((await f.action('revoke_invite',{invite_id:i.invite_id})).error,'OWNER_REQUIRED');
  assert.equal((await f.action('leave_team',{close:true})).error,'OWNER_REQUIRED');
}));
test('current todo and title updates invalidate only when shared, never reveal raw private fields', () => fixture(async () => {
  const t=await create();const s=await f.start();const before=await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id]);
  await f.db.query("update study_todos set title='Secret changed'where user_id=$1",[users[0]]);
  assert.equal(await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id]),before);
  await f.action('set_share_title',{share:true});const shared=await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id]);
  await f.admin(()=>f.db.query('update study_actual_sessions set current_todo_id=null where session_id=$1',[s.id]));
  assert.ok(await f.scalar('select revision value from team_study_signals where team_id=$1',[t.id])>shared);
  assert.equal((await f.snapshot()).members[0].title,null);
  const text=JSON.stringify(await f.snapshot()); for(const privateKey of ['email','excluded_seconds','unknown_allocation','recovery'])assert.equal(text.includes(`"${privateKey}"`),false);
}));
test('invalid actions and malformed close flags are safe errors without leaving team', () => fixture(async () => {
  assert.equal((await f.action(null)).error,'INVALID_ACTION');await create();
  assert.equal((await f.action('leave_team',{close:'yes'})).error,'INVALID_PAYLOAD');
  assert.equal((await f.snapshot()).team.member_count,1);
}));

test('fractional checkpoints preserve final personal duration and conservative segment allocation', () => fixture(async () => {
  await create();await f.at('2026-10-12T09:00:00.500Z');const s=await f.start();
  await f.at('2026-10-12T09:10:00.800Z');await f.action('connect',{session_id:s.id});
  await f.at('2026-10-12T09:20:00.200Z');await f.action('disconnect');
  await f.at('2026-10-12T09:30:00.700Z');await f.scalar('select to_jsonb(end_study_session($1,0)) value',[s.id]);
  assert.equal(await f.scalar('select duration_seconds value from study_sessions where id=$1',[s.id]),1800);
  assert.equal(await f.admin(()=>f.scalar('select sum(accepted_seconds)::integer value from study_todo_segments where session_id=$1',[s.id])),1799);
  assert.equal((await f.snapshot()).forest.accepted_seconds,599);
}));
test('late round participation reuses one server end and cancel never disconnects members', () => fixture(async () => {
  await create();const i=await invite();await join(i.token);await f.auth();const first=await f.start();
  await f.action('propose_round',{duration_minutes:50});await f.action('connect',{session_id:first.id});
  await f.at('2026-10-12T09:20:00Z');const second=await f.start(users[1],'00000000-0000-4000-8000-000000000202');
  await f.action('connect',{session_id:second.id});const r=(await f.snapshot()).round;
  assert.equal(r.ends_at,'2026-10-12T09:50:00+00:00');assert.equal(r.joined,true);
  assert.equal((await f.action('cancel_round')).error,'OWNER_REQUIRED');await f.auth();await f.action('cancel_round');
  await f.auth(users[1]);assert.equal((await f.snapshot()).connection.session_id,second.id);
  await f.at('2026-10-12T09:51:00Z');assert.equal(await f.scalar('select status value from study_sessions where id=$1',[second.id]),'active');
}));
test('duplicate connection does not checkpoint again; disconnect retries do not double count', () => fixture(async () => {
  await create();const s=await f.start();await f.at('2026-10-12T09:10:00Z');await f.action('connect',{session_id:s.id});
  const count=await f.admin(()=>f.scalar('select count(*)::integer value from study_todo_segments where session_id=$1',[s.id]));
  await f.at('2026-10-12T09:15:00Z');await f.action('connect',{session_id:s.id});
  assert.equal(await f.admin(()=>f.scalar('select count(*)::integer value from study_todo_segments where session_id=$1',[s.id])),count);
  await f.at('2026-10-12T09:20:00Z');await f.action('disconnect');await f.action('disconnect');
  await f.at('2026-10-12T09:30:00Z');await f.scalar('select to_jsonb(end_study_session($1,0)) value',[s.id]);
  assert.equal((await f.snapshot()).forest.accepted_seconds,600);
}));
test('closing a team checkpoints both accounts but preserves active personal states and duration', () => fixture(async () => {
  await create();const i=await invite();await join(i.token);await f.auth();const first=await f.start();await f.action('connect',{session_id:first.id});
  const second=await f.start(users[1],'00000000-0000-4000-8000-000000000202');await f.action('connect',{session_id:second.id});
  await f.at('2026-10-12T09:20:00Z');await f.auth();assert.equal((await f.action('leave_team',{close:true})).ok,true);
  await f.auth(users[1]);assert.equal((await f.snapshot()).team,null);assert.equal(await f.scalar('select status value from study_sessions where id=$1',[second.id]),'active');
  await f.at('2026-10-12T09:30:00Z');await f.scalar('select to_jsonb(end_study_session($1,0)) value',[second.id]);
  assert.equal(await f.scalar('select duration_seconds value from study_sessions where id=$1',[second.id]),1800);
}));
test('owner can revoke active link after reload without storing raw token in snapshot', () => fixture(async () => {
  await create();const i=await invite();const s=await f.snapshot();
  assert.deepEqual(s.invite_links,[{id:i.invite_id,expires_at:i.expires_at}]);
  assert.equal(JSON.stringify(s).includes(i.token),false);await f.action('revoke_invite',{invite_id:s.invite_links[0].id});
  assert.deepEqual((await f.snapshot()).invite_links,[]);
}));
test('targeted invitation response retries are idempotent, cannot rejoin after departure', () => fixture(async () => {
  await f.auth(users[1]);await f.action('set_tag',{tag:'alice#ab12'});await f.auth();await create();const i=await f.action('invite_tag',{tag:'alice#ab12'});
  await f.auth(users[1]);assert.equal((await f.action('respond_invite',{invite_id:i.invite_id,accept:true})).ok,true);
  assert.equal((await f.action('respond_invite',{invite_id:i.invite_id,accept:true})).ok,true);
  await f.action('leave_team');assert.equal((await f.action('respond_invite',{invite_id:i.invite_id,accept:true})).error,'INVITE_INVALID');
}));
test('targeted invite accepted after link join disappears from received previews', () => fixture(async () => {
  await f.auth(users[1]);await f.action('set_tag',{tag:'alice#ab12'});await f.auth();await create();const i=await f.action('invite_tag',{tag:'alice#ab12'});const link=await invite();
  await join(link.token);assert.equal((await f.snapshot()).invitations.length,1);
  assert.equal((await f.action('respond_invite',{invite_id:i.invite_id,accept:true})).ok,true);
  assert.deepEqual((await f.snapshot()).invitations,[]);
}));
test('cooperative forest creates one tree for7200 finalized seconds, no active-time trees', () => fixture(async () => {
  await create();const i=await invite();await join(i.token);await f.auth();const a=await f.start();await f.action('connect',{session_id:a.id});
  const b=await f.start(users[1],'00000000-0000-4000-8000-000000000202');await f.action('connect',{session_id:b.id});
  await f.at('2026-10-12T10:00:00Z');assert.equal((await f.snapshot()).forest.trees,0);
  await f.scalar('select to_jsonb(end_study_session($1,0)) value',[b.id]);await f.auth();await f.scalar('select to_jsonb(end_study_session($1,0)) value',[a.id]);
  assert.deepEqual((await f.snapshot()).forest,{accepted_seconds:7200,pending_sessions:0,trees:1,progress_seconds:0});
}));

test('requested A스타#지니 tag is normalized, exactly found and explicitly invited', () => fixture(async () => {
  await f.auth(users[1]);assert.deepEqual(await f.action('set_tag',{tag:'  A스타#지니  '}),{ok:true,tag:'a스타#지니'});
  await f.auth();await create();assert.deepEqual(await f.action('lookup_tag',{tag:'A스타#지니'}),{ok:true,tag:'a스타#지니',display_name:'a스타'});
  assert.equal((await f.action('lookup_tag',{tag:'A스타'})).error,'INVALID_TAG');
  const invite=await f.action('invite_tag',{tag:'A스타#지니'});assert.equal(invite.ok,true);
  await f.auth(users[1]);assert.equal((await f.snapshot()).team,null);
  assert.equal((await f.action('respond_invite',{invite_id:invite.invite_id,accept:true})).ok,true);
}));
test('connection-set guard rejects a new session absent from retained prelocks', () => fixture(async () => {
  const team=await create();const invite=await f.action('create_invite');await join(invite.token);await f.auth();
  const first=await f.start();await f.action('connect',{session_id:first.id});
  const check=ids=>f.admin(()=>f.scalar('select team_study_private.connections_prelocked($1,$2::uuid[]) value',[team.id,ids]));
  assert.equal(await check([first.id]),true);
  const second=await f.start(users[1],'00000000-0000-4000-8000-000000000202');await f.action('connect',{session_id:second.id});
  assert.equal(await check([first.id]),false);assert.equal(await check([first.id,second.id]),true);
}));
test('close aborts with RETRY before checkpoint when retained connection-set guard fails', () => fixture(async () => {
  await create();const session=await f.start();await f.action('connect',{session_id:session.id});
  await f.at('2026-10-12T09:20:00Z');
  const before=await f.admin(()=>f.sql('select id,ended_at,accepted_seconds from study_todo_segments order by id'));
  // Controlled guard failure, not a claim of concurrent PostgreSQL scheduling.
  await f.admin(()=>f.db.exec(`create or replace function team_study_private.connections_prelocked(p_team uuid,p_sessions uuid[])returns boolean language sql stable set search_path=''as $$select false$$`));
  assert.deepEqual(await f.action('leave_team',{close:true}),{ok:false,error:'RETRY'});
  assert.deepEqual(await f.admin(()=>f.sql('select id,ended_at,accepted_seconds from study_todo_segments order by id')),before);
  assert.equal((await f.snapshot()).team.member_count,1);assert.equal((await f.snapshot()).connection.session_id,session.id);
}));
