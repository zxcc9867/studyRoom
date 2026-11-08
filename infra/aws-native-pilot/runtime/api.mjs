import { isUuid, store } from './store.mjs';
import { bestEffortSignal, publishEvent } from './publisher.mjs';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function input(event) {
  const { body, isBase64Encoded } = event;
  if (typeof body !== 'string' || body.length > 1024) return null;
  try {
    const text = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function createApi({ db, publish }) {
  return async event => {
    const claims = event?.requestContext?.authorizer?.jwt?.claims;
    if (claims?.token_use !== 'access' || !isUuid(claims.sub)) return json(401, { error: 'unauthorized' });
    const owner = claims.sub.toLowerCase();
    const id = event.pathParameters?.id;
    try {
      switch (event.routeKey) {
        case 'GET /records':
          return json(200, { records: await db.listRecords(owner) });
        case 'GET /records/{id}':
        case 'GET /coaching/{id}': {
          if (!isUuid(id)) return json(404, { error: 'not_found' });
          const row = event.routeKey === 'GET /records/{id}' ? await db.getRecord(owner, id) : await db.getJob(owner, id);
          return row ? json(200, row) : json(404, { error: 'not_found' });
        }
        case 'POST /records': {
          const body = input(event);
          if (!body || Object.keys(body).length !== 1 ||
            !Number.isInteger(body.minutes) || body.minutes < 1 || body.minutes > 240) {
            return json(400, { error: 'invalid_input' });
          }
          const row = await db.insertRecord(owner, body.minutes);
          await bestEffortSignal(publish, owner, { kind: 'record', id: row.id });
          return json(201, row);
        }
        case 'POST /coaching': {
          const body = input(event);
          if (!body || Object.keys(body).length !== 0) return json(400, { error: 'invalid_input' });
          const job = await db.insertJob(owner);
          if (!job) return json(429, { error: 'coaching_limit' });
          await bestEffortSignal(publish, owner, { kind: 'coaching', id: job.id });
          return json(202, job);
        }
        default:
          return json(404, { error: 'not_found' });
      }
    } catch {
      return json(500, { error: 'internal_error' });
    }
  };
}

export const handler = createApi({ db: store, publish: publishEvent });
