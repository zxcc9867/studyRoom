import { createCoachingService, CoachingError } from '../server/ai/coaching.mjs';
import { createCoachingStore } from '../server/ai/coaching-store.mjs';

export function createHandler({ env = process.env, fetchImpl = fetch, generate } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: '지원하지 않는 요청이에요.' }); }
    try {
      const signal = AbortSignal.timeout(50000);
      const authorization = req.headers.authorization;
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._-]+$/.test(authorization) || authorization.length > 8192) throw new CoachingError(401, '로그인 후 이용해 주세요.');
      let body = req.body;
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > 2048) throw new CoachingError(400, '요청이 너무 커요.');
        try { body = JSON.parse(body); } catch { throw new CoachingError(400, '요청 내용을 확인해 주세요.'); }
      }
      if (Buffer.byteLength(JSON.stringify(body) || '') > 2048) throw new CoachingError(400, '요청이 너무 커요.');
      const store = createCoachingStore({ env, token: authorization.slice(7), fetchImpl, signal });
      const userId = await store.authenticate();
      const result = await createCoachingService({ store, env, generate })(userId, body, signal);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(error instanceof CoachingError ? error.status : 503).json({ error: error instanceof CoachingError ? error.message : '코칭을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    }
  };
}
export default createHandler();
