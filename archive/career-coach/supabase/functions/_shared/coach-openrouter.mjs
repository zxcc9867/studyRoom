// Server-only integration. Never import this module from apps/web or apps/mobile.
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  throw new Error('OpenRouter is only available on the server.');
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ERROR_MESSAGES = {
  configuration: 'AI configuration is invalid.',
  disabled: 'AI is not configured.',
  invalid_input: 'AI input is invalid.',
  cancelled: 'AI request was cancelled.',
  timeout: 'AI request timed out.',
  rate_limit: 'AI request rate limit reached.',
  upstream: 'AI provider request failed.',
  network: 'AI provider could not be reached.',
  invalid_response: 'AI provider returned an invalid response.',
};

export class OpenRouterError extends Error {
  constructor(code, status) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.upstream);
    this.name = 'OpenRouterError';
    this.code = code;
    if (Number.isInteger(status) && status >= 100 && status <= 599) this.status = status;
  }
}

function setting(env, name) {
  const value = env[name];
  if (value == null) return '';
  if (typeof value !== 'string') throw new OpenRouterError('configuration');
  return value.trim();
}

function integerSetting(env, name, fallback, min, max) {
  const value = setting(env, name);
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new OpenRouterError('configuration');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new OpenRouterError('configuration');
  }
  return number;
}

export function getOpenRouterConfig(env = process.env) {
  const apiKey = setting(env, 'OPENROUTER_API_KEY');
  const model = setting(env, 'OPENROUTER_MODEL');
  // Legacy routing settings cannot opt this application into paid inference.
  const freeModel = model === 'openrouter/free' || /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+:free$/.test(model)
    ? model : 'openrouter/free';
  const siteUrl = setting(env, 'OPENROUTER_SITE_URL');
  const appName = setting(env, 'OPENROUTER_APP_NAME');
  // Headers must be single-line ASCII; do not let fetch errors echo secret values.
  if ([apiKey, siteUrl, appName].some((value) => /[^\x20-\x7e]/.test(value))) {
    throw new OpenRouterError('configuration');
  }
  if (model && (model.length > 256 || /\s/.test(model))) throw new OpenRouterError('configuration');
  if (siteUrl) {
    try {
      const url = new URL(siteUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      throw new OpenRouterError('configuration');
    }
  }
  return Object.freeze({
    enabled: Boolean(apiKey && model), apiKey, model: freeModel, siteUrl, appName,
    maxTokens: integerSetting(env, 'OPENROUTER_MAX_TOKENS', 1024, 1, 8192),
    timeoutMs: integerSetting(env, 'OPENROUTER_TIMEOUT_MS', 20000, 1000, 55000),
  });
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 32) {
    throw new OpenRouterError('invalid_input');
  }
  let characters = 0;
  return messages.map((message) => {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)
      || typeof message.content !== 'string' || !message.content.trim()) {
      throw new OpenRouterError('invalid_input');
    }
    characters += message.content.length;
    if (characters > 32000) throw new OpenRouterError('invalid_input');
    return { role: message.role, content: message.content };
  });
}

async function readResponse(response, signal) {
  if (!response.body?.getReader) throw new OpenRouterError('invalid_response');
  const reader = response.body.getReader();
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new OpenRouterError('invalid_response');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new OpenRouterError('invalid_response'); }
  } finally {
    signal.removeEventListener('abort', onAbort);
    // Cancellation may fail on an already aborted network stream.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function normalizeResult(data) {
  if (!data || typeof data !== 'object' || data.error) throw new OpenRouterError('upstream');
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()
    || typeof data.id !== 'string' || typeof data.model !== 'string') {
    throw new OpenRouterError('invalid_response');
  }
  const usage = {};
  for (const field of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    const value = data.usage?.[field];
    if (Number.isSafeInteger(value) && value >= 0) usage[field] = value;
  }
  return { id: data.id, text, model: data.model, usage };
}

export function createOpenRouterClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = getOpenRouterConfig(env);
  if (typeof fetchImpl !== 'function') throw new OpenRouterError('configuration');
  return Object.freeze({
    async generateText({ messages, signal } = {}) {
      if (!config.enabled) throw new OpenRouterError('disabled');
      const safeMessages = validateMessages(messages);
      if (signal != null && !(signal instanceof AbortSignal)) throw new OpenRouterError('invalid_input');
      if (signal?.aborted) throw new OpenRouterError('cancelled');
      const controller = new AbortController();
      let abortCode;
      let rejectAbort;
      const abortPromise = new Promise((_, reject) => { rejectAbort = reject; });
      const abort = (code) => {
        if (abortCode) return;
        abortCode = code;
        rejectAbort(new OpenRouterError(code));
        controller.abort();
      };
      const onCancel = () => abort('cancelled');
      signal?.addEventListener('abort', onCancel, { once: true });
      const timer = setTimeout(() => abort('timeout'), config.timeoutMs);
      try {
        const headers = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
        if (config.siteUrl) headers['HTTP-Referer'] = config.siteUrl;
        if (config.appName) headers['X-OpenRouter-Title'] = config.appName;
        const request = async () => {
          const response = await fetchImpl(ENDPOINT, {
            method: 'POST', headers, signal: controller.signal,
            redirect: 'error',
            body: JSON.stringify({
              model: config.model,
              provider: { max_price: { prompt: 0, completion: 0, request: 0 }, data_collection: 'deny' },
              messages: safeMessages, stream: false, max_tokens: config.maxTokens,
            }),
          });
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            throw new OpenRouterError(response.status === 429 ? 'rate_limit' : 'upstream', response.status);
          }
          return normalizeResult(await readResponse(response, controller.signal));
        };
        return await Promise.race([request(), abortPromise]);
      } catch (error) {
        if (abortCode) throw new OpenRouterError(abortCode);
        if (error instanceof OpenRouterError) throw error;
        throw new OpenRouterError('network');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onCancel);
      }
    },
  });
}
