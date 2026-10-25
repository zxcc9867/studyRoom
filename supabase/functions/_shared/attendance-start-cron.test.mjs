import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const transpile = (path, module) => ts.transpileModule(readFileSync(path,'utf8'), {
  compilerOptions: { module, target: ts.ScriptTarget.ES2022 },
}).outputText;
const recovery = await import('data:text/javascript;base64,' + Buffer.from(transpile('supabase/functions/_shared/recovery.ts',ts.ModuleKind.ESNext)).toString('base64'));

function runtime({ missed = [], ensureResult = {request:null,created:false} } = {}) {
  let handler; const calls=[]; const exports={};
  const admin={
    async rpc(name,args) {
      calls.push({name,args});
      return { data:name==='mark_missed_attendance'?missed:name==='ensure_missed_attendance_recovery'?ensureResult:[],error:null };
    },
    from() { throw new Error('A stale missed result must not write recovery rows or send notifications'); },
  };
  runInNewContext(transpile('supabase/functions/attendance-cron/index.ts',ts.ModuleKind.CommonJS) +
    '\nexports.body=buildReminderBody; exports.slack=buildSlackReminderMessage;',{
    exports,
    require(name) {
      if(name==='jsr:@supabase/functions-js/edge-runtime.d.ts')return {};
      if(name==='jsr:@supabase/supabase-js@2.57.4')return {createClient:()=>admin};
      if(name==='npm:web-push@3.6.7')return {};
      if(name==='../_shared/recovery.ts')return {...recovery,sendPendingRecoveryFollowups:async()=>[]};
      if(name==='../_shared/recovery_summary.ts')return {sendWeeklyRecoverySummaries:async()=>[]};
      if(name==='../_shared/study_focus.ts')return {sendStudyFocusSignals:async()=>({attempted:0,sent:0,failed:0})};
      throw new Error('Unexpected dependency '+name);
    },
    Deno:{serve(fn){handler=fn;},env:{get:name=>({CRON_SECRET:'fixture-secret',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-role'}[name])}},
    Date,Response,Intl,console,
  });
  return {handler,exports,calls};
}

test('cron keeps custom-secret authorization and lifecycle RPC order, then skips a corrected missed candidate',async()=>{
  const r=runtime({missed:[{user_id:'owner',local_date:'2026-10-24',reminder_at:'2026-10-24T05:00Z',deadline_at:'2026-10-24T19:00Z'}]});
  assert.equal((await r.handler(new Request('https://fixture/cron'))).status,401);
  assert.equal(r.calls.length,0);
  const response=await r.handler(new Request('https://fixture/cron',{headers:{'x-cron-secret':'fixture-secret'}}));
  assert.equal(response.status,200);
  assert.deepEqual(r.calls.slice(0,3).map(x=>x.name),['close_expired_study_sessions','get_due_reminders','mark_missed_attendance']);
  assert.deepEqual(r.calls.at(-1),{name:'ensure_missed_attendance_recovery',args:{p_user_id:'owner',p_local_date:'2026-10-24'}});
  const body=await response.json();
  assert.equal(body.missedRecoveryResults[0].skipped,true);
});

test('scheduled reminder copy describes a start before the real study-day end and a separate time goal',()=>{
  const r=runtime();
  for(const reminder_stage of ['initial','nudge']) {
    const reminder={user_id:'owner',local_date:'2026-10-25',time_zone:'Asia/Tokyo',deadline_at:'2026-10-25T19:00:00Z',reminder_stage,attendance_already_present:false};
    const body=r.exports.body(reminder,[]);
    const slack=r.exports.slack(reminder,[],'https://fixture');
    assert.match(body,/valid start earns attendance immediately/i);
    assert.match(body,/4시간 study-time goal is separate/);
    assert.match(slack,/언제든.*시작하면 즉시 출석/);
    assert.match(slack,/4시간 학습 목표는 출석과 별개/);
    assert.doesNotMatch(body+'\n'+slack,/30분|30 minutes|recover attendance|목표를 채우면 출석/);
  }
});
