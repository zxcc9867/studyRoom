import { isUuid, store } from './store.mjs';
import { bestEffortSignal, publishEvent, withDeadline } from './publisher.mjs';

function jobId(record) {
  if (typeof record.body !== 'string' || record.body.length > 128) return null;
  try {
    const message = JSON.parse(record.body);
    return message && Object.keys(message).length === 1 && isUuid(message.id) ? message.id : null;
  } catch {
    return null;
  }
}

export function createWorker({ db, generate, publish }) {
  return async event => {
    const outcomes = await Promise.all((event.Records ?? []).map(async record => {
      const id = jobId(record);
      if (!id) return null;
      try {
        const job = await db.claimJob(id);
        if (!job) return null;
        let result = null;
        try {
          const generated = await withDeadline(15_000, signal => generate(signal));
          if (typeof generated === 'string') result = generated.trim().slice(0, 1000) || null;
        } catch {
          // A timed-out or failed invocation may still have been charged. Never invoke again.
        }
        const status = result ? 'done' : 'failed';
        if (await db.finishJob(id, status, result)) {
          await bestEffortSignal(publish, job.owner, { kind: 'coaching', id });
        }
        return null;
      } catch {
        // Retry the delivery for transient database errors, but claimJob will not re-run a claimed job.
        return { itemIdentifier: record.messageId };
      }
    }));
    return { batchItemFailures: outcomes.filter(Boolean) };
  };
}

let bedrock;
async function generateCoaching(abortSignal) {
  bedrock ??= import('@aws-sdk/client-bedrock-runtime').then(({ BedrockRuntimeClient, ConverseCommand }) =>
    ({ client: new BedrockRuntimeClient({ maxAttempts: 1 }), ConverseCommand }));
  const { client, ConverseCommand } = await bedrock;
  const response = await client.send(new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID,
    messages: [{
      role: 'user',
      content: [{ text: 'An imaginary student studied for 25 minutes. Suggest one short, kind next step in plain text.' }],
    }],
    inferenceConfig: { maxTokens: 100, temperature: 0.2 },
  }), { abortSignal });
  return response.output?.message?.content?.map(part => part.text ?? '').join(' ') ?? '';
}

export const handler = createWorker({ db: store, generate: generateCoaching, publish: publishEvent });
