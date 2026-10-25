import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const source = readFileSync("supabase/functions/slack-recovery-interactions/index.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
// Execute the real submission handler. Only its Edge runtime registration and
// unrelated coach imports are stubbed; Supabase still builds the actual requests.
runInNewContext(`${outputText}\nexports.submit = handleRecoverySubmission;`, {
  exports,
  require(name) {
    if (name === "jsr:@supabase/functions-js/edge-runtime.d.ts") return {};
    if (name === "jsr:@supabase/supabase-js@2.57.4") return { createClient };
    if (name === "../_shared/coach-notifications.ts" || name === "../_shared/coach-store.ts") return {};
    throw new Error(`Unexpected dependency: ${name}`);
  },
  Deno: { serve() {} }, Response, Intl,
  Date: class extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-08-28T16:00:00Z"])); }
  },
});


for (const finalStatus of ['submitted', 'resolved']) {
  test('Slack delegates submission atomically; final state ' + finalStatus + ' cannot create an orphan task', async () => {
    const writes = [];
    const requestId = '22222222-2222-4222-8222-222222222222';
    const userId = '11111111-1111-4111-8111-111111111111';
    const client = createClient('https://recovery-fixture.supabase.co', 'fixture-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init = {}) => {
        const table = new URL(input).pathname.split('/').at(-1);
        if (table === 'study_recovery_requests' && init.method === 'GET') {
          return Response.json([{ id: requestId, user_id: userId, local_date: '2026-10-25', trigger_type: 'missed_attendance', status: 'pending' }]);
        }
        if (table === 'profiles' && init.method === 'GET') return Response.json([{ time_zone: 'Asia/Tokyo' }]);
        writes.push({ table, method: init.method, body: JSON.parse(init.body) });
        if (table === 'submit_slack_study_recovery_request' && init.method === 'POST') return Response.json({ id: requestId, status: finalStatus });
        if (table === 'study_todos' && init.method === 'POST') return Response.json({ id: 'legacy-task' });
        if (table === 'study_recovery_requests' && init.method === 'PATCH') return Response.json([]);
        throw new Error('Submission must not issue separate task/recovery writes: ' + table);
      } },
    });
    const field = value => ({ value });
    const response = await exports.submit(client, {
      type: 'view_submission', user: { id: 'slack-owner' },
      view: { private_metadata: requestId, state: { values: {
        reason: { reason: field('일정이 겹침') },
        makeup_todo_title: { makeup_todo_title: field('오늘 10분 복습') },
        pledge_todo_title: { pledge_todo_title: field('내일 다시 시작') },
      } } },
    });
    assert.deepEqual(await response.json(), { response_action: 'clear' });
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0], { table: 'submit_slack_study_recovery_request', method: 'POST', body: {
      p_request_id: requestId, p_user_id: userId, p_slack_submitter_id: 'slack-owner',
      p_reason: '일정이 겹침', p_makeup_todo_title: '오늘 10분 복습', p_pledge_todo_title: '내일 다시 시작',
    } });
  });
}
