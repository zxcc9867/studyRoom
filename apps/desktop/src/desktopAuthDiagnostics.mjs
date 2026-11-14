const stages = new Set([
  'app.ready', 'provider.started', 'provider.opened',
  'provider.window-focused', 'provider.window-focus-pending', 'provider.window-raise-failed',
  'second-instance.received', 'second-instance.callback-found', 'second-instance.callback-missing',
  'open-url.received', 'callback.received', 'callback.validated', 'callback.completed',
  'callback.fragment-present', 'callback.extra-query',
  'callback.pending-valid', 'callback.pending-invalid', 'callback.intent-consumed', 'callback.exchange-started',
  ...['BAD_REQUEST', 'AUTH_FAILED', 'AUTH_CHANGED', 'AUTH_TIMEOUT', 'AUTH_BUSY', 'INVALID_CALLBACK',
    'STORAGE_UNAVAILABLE', 'INTERNAL_ERROR'].map(code => `callback.failed.${code}`),
]);

/** A bounded local stage trace. Credentials, URLs and dependency messages are never accepted. */
export function createAuthDiagnostics({ write, now = Date.now }) {
  let events = [];
  let latest = null;
  let writing = false;
  async function drain() {
    try {
      while (latest !== null) {
        const snapshot = latest;
        latest = null;
        try { await write(snapshot); } catch { /* Best-effort local diagnostics only. */ }
      }
    } finally { writing = false; }
  }
  return stage => {
    if (!stages.has(stage)) return;
    try {
      events.push({ at: now(), stage });
      events = events.slice(-32);
      latest = JSON.stringify({ version: 1, events });
      if (!writing) {
        writing = true;
        void Promise.resolve().then(drain);
      }
    } catch { /* Diagnostics must not change authentication outcomes. */ }
  };
}
