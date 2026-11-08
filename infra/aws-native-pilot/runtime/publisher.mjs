export function withDeadline(ms, work) {
  const controller = new AbortController();
  let timer;
  return Promise.race([
    Promise.resolve().then(() => work(controller.signal)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('deadline_exceeded'));
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function bestEffortSignal(publish, owner, payload, ms = 1500) {
  try {
    await withDeadline(ms, signal => publish(owner, payload, signal));
  } catch {
    // PostgreSQL already committed; polling is the recovery path for a missed signal.
  }
}

export function createPublisher({ url, sign, request = fetch }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.pathname !== '/event' ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('invalid_event_endpoint');
  }
  return async (owner, payload, signal = AbortSignal.timeout(1500)) => {
    const body = JSON.stringify({ channel: `/study/${owner}`, events: [JSON.stringify(payload)] });
    const { headers } = await sign({
      protocol: endpoint.protocol, hostname: endpoint.hostname, path: endpoint.pathname,
      method: 'POST', headers: { host: endpoint.host, 'content-type': 'application/json' }, body,
    });
    const response = await request(endpoint, { method: 'POST', headers, body, signal, redirect: 'error' });
    if (!response.ok) throw new Error('event_publish_failed');
    const result = await response.json();
    if (result.successful?.length !== 1 || result.failed?.length) throw new Error('event_publish_failed');
  };
}

let iamSigner;
async function signWithIam(request) {
  iamSigner ??= Promise.all([
    import('@smithy/signature-v4'), import('@aws-sdk/credential-provider-node'), import('@aws-crypto/sha256-js'),
  ]).then(([{ SignatureV4 }, { defaultProvider }, { Sha256 }]) => new SignatureV4({
    credentials: defaultProvider(), region: process.env.AWS_REGION, service: 'appsync', sha256: Sha256,
  }));
  return (await iamSigner).sign(request);
}

export function publishEvent(owner, payload, signal) {
  return createPublisher({ url: process.env.APPSYNC_HTTP_URL, sign: signWithIam })(owner, payload, signal);
}
