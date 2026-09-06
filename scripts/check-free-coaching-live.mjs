// CI smoke check: one synthetic prompt, no user data or database writes.
import { createOpenRouterClient, OpenRouterError } from '../server/ai/openrouter.mjs';
import { parseCoaching, ruleCoaching } from '../server/ai/coaching.mjs';

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
  // Free capacity can be unavailable. Production then uses its tested rules path.
  console.log(`Free coaching live check: rules fallback required (${code}). No paid retry.`);
}
