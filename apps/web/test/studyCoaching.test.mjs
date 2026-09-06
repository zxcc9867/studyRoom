import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStudyCoaching, requestStudyCoaching } from '../src/studyCoaching.mjs';

const valid = { id: 'coach-1', source: 'rules', title: '작게 시작하기', firstAction: '10분 동안 첫 문단 읽기', reason: '시작 행동을 줄여보세요.', evidence: ['최근 28일 기록'], createdAt: '2026-09-06T00:00:00Z', feedback: null };
const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' }, access_token: 'fixture-token' } }, error: null }) } };

test('coaching parser accepts both sources and rejects malformed guidance', () => {
  assert.deepEqual(parseStudyCoaching(valid), valid);
  assert.equal(parseStudyCoaching({ ...valid, source: 'ai' }).source, 'ai');
  for (const patch of [{ source: 'unknown' }, { firstAction: '' }, { evidence: [null] }, { feedback: 'unknown' }, { createdAt: 'invalid' }]) {
    assert.throws(() => parseStudyCoaching({ ...valid, ...patch }));
  }
});

test('authenticated request sends todo id only and parses coaching response', async () => {
  const result = await requestStudyCoaching({ supabase, userId: 'user-1', payload: { action: 'generate', todoId: 'todo-1' }, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/study-coaching');
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    assert.deepEqual(JSON.parse(options.body), { action: 'generate', todoId: 'todo-1' });
    return Response.json(valid);
  } });
  assert.equal(result.firstAction, valid.firstAction);
});

test('changed account and cancellation block request before sending', async () => {
  let calls = 0;
  const options = { supabase, userId: 'other-user', payload: { action: 'generate', todoId: 'todo-1' }, fetchImpl: async () => { calls++; return Response.json(valid); } };
  await assert.rejects(requestStudyCoaching(options), /로그인/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(requestStudyCoaching({ ...options, userId: 'user-1', signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('error bodies are never exposed and feedback response is validated', async () => {
  const options = { supabase, userId: 'user-1', payload: { action: 'feedback', coachingId: 'coach-1', feedback: 'helpful' } };
  await assert.rejects(requestStudyCoaching({ ...options, fetchImpl: async () => Response.json({ error: 'private upstream body' }, { status: 500 }) }), error => !error.message.includes('private'));
  await assert.rejects(requestStudyCoaching({ ...options, fetchImpl: async () => Response.json({ ok: false }) }), /피드백/);
  assert.deepEqual(await requestStudyCoaching({ ...options, fetchImpl: async () => Response.json({ ok: true }) }), { ok: true });
});
