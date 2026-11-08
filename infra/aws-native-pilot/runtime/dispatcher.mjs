import { store } from './store.mjs';
import { bestEffortSignal, publishEvent, withDeadline } from './publisher.mjs';

export function createDispatcher({ db, send, publish }) {
  return async () => {
    try {
      const expired = await db.expireJobs();
      const queued = await db.reserveDispatch();
      const [outcomes] = await Promise.all([
        Promise.allSettled(queued.map(async job => {
          await withDeadline(3000, signal => send(job.id, signal));
          await db.markDispatched(job.id);
        })),
        Promise.all(expired.map(job => bestEffortSignal(publish, job.owner, { kind: 'coaching', id: job.id }))),
      ]);
      return { dispatched: outcomes.filter(outcome => outcome.status === 'fulfilled').length, expired: expired.length };
    } catch {
      throw new Error('dispatch_failed');
    }
  };
}

let queue;
async function sendToQueue(id, abortSignal) {
  queue ??= import('@aws-sdk/client-sqs').then(({ SQSClient, SendMessageCommand }) =>
    ({ client: new SQSClient({ maxAttempts: 1 }), SendMessageCommand }));
  const { client, SendMessageCommand } = await queue;
  await client.send(new SendMessageCommand({
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: JSON.stringify({ id }),
  }), { abortSignal });
}

export const handler = createDispatcher({ db: store, send: sendToQueue, publish: publishEvent });
