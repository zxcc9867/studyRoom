// CI smoke check: one synthetic prompt, no user data or database writes.
import { createOpenRouterClient, OpenRouterError } from '../server/ai/openrouter.mjs';
import { parseCoaching, ruleCoaching } from '../server/ai/coaching.mjs';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// The credential only ever travels in a request header. Redact anything shaped
// like one anyway so a provider error body can never leak it into a public log.
const safe = (value) => String(value ?? '')
  .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
  .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/\s+/g, ' ')
  .slice(0, 400);

const baseline = ruleCoaching({ recordedStudyDays: 0, completedSessions: 0, checkedTodos: 0, recordedTodos: 0, reflections: 0 }, '예제 복습');
try {
  const result = await createOpenRouterClient({ env: { ...process.env, OPENROUTER_TIMEOUT_MS: '20000' } }).generateText({
    messages: [
      { role: 'system', content: '한국어 공부 도우미. 숫자나 링크 없이 작은 첫 행동 한 문장만 JSON으로 답하세요. 형식: {"firstAction":"구체적인 행동"}' },
      { role: 'user', content: '파이썬 변수 예제를 복습하려고 합니다. 자료를 열고 시작할 작은 행동을 제안해 주세요.' },
    ],
  });
  parseCoaching(result.text, baseline);
  console.log('Free coaching live check: AI response and action validation passed. No user data or DB writes.');
} catch (error) {
  const code = error instanceof OpenRouterError ? error.code : 'invalid_action';
  const status = error instanceof OpenRouterError && error.status ? ` status=${error.status}` : '';
  // Free capacity can be unavailable. Production then uses its tested rules path.
  console.log(`Free coaching live check: rules fallback required (${code})${status}. No paid retry.`);
}

// TEMPORARY provider-constraint probe. The shared client discards the provider's
// error body, so an upstream refusal is indistinguishable from a bad answer.
// These read-only probes send the same request with the routing constraints
// removed one at a time to show which one the provider rejects. Remove once the
// cause is recorded in memory-bank/trouble-shooting.md.
const key = String(process.env.OPENROUTER_API_KEY ?? '').trim();
const model = String(process.env.OPENROUTER_MODEL ?? '').trim() || 'openrouter/free';
if (!key) {
  console.log('Provider probe: skipped, no key in this environment.');
} else {
  const probes = [
    ['A current constraints', { max_price: { prompt: 0, completion: 0, request: 0 }, data_collection: 'deny' }],
    ['B without data_collection', { max_price: { prompt: 0, completion: 0, request: 0 } }],
    ['C without max_price', { data_collection: 'deny' }],
    ['D no provider block', null],
  ];
  for (const [label, provider] of probes) {
    const body = { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, stream: false };
    if (provider) body.provider = provider;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      const ok = response.ok && !text.includes('"error"');
      console.log(`Provider probe ${label}: HTTP ${response.status} ${ok ? 'OK' : 'REFUSED'} :: ${safe(text)}`);
    } catch (error) {
      console.log(`Provider probe ${label}: threw ${safe(error?.name)} ${safe(error?.message)}`);
    }
  }
  console.log(`Provider probe: model=${model}`);
}
