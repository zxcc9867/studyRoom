import { createDesktopPolicy, DESKTOP_AUTH_CALLBACK } from './desktopPolicy.mjs';

const PENDING_KEY = 'desktop-pkce-pending-v1';
const LOGOUT_KEY = 'desktop-signed-out-v1';
const policy = createDesktopPolicy();
const boundedText = (value, max = 128) => typeof value === 'string' && value.length > 0
  && value.length <= max && !/[\x00-\x20\x7f]/.test(value);
const authError = code => new Error(code);
const knownErrors = new Set(['BAD_REQUEST', 'AUTH_FAILED', 'AUTH_CHANGED', 'AUTH_TIMEOUT', 'AUTH_BUSY', 'INVALID_CALLBACK',
  'AUTH_EMAIL_RATE_LIMIT', 'AUTH_RATE_LIMIT', 'AUTH_NETWORK_ERROR']);
// Only fixed public classifications cross IPC, never provider messages or account details.
function emailRequestError(error) {
  if (error?.code === 'over_email_send_rate_limit') return authError('AUTH_EMAIL_RATE_LIMIT');
  if (error?.status === 429) return authError('AUTH_RATE_LIMIT');
  if (error?.name === 'AuthRetryableFetchError' && error?.status === 0) return authError('AUTH_NETWORK_ERROR');
  return authError('AUTH_FAILED');
}

export function createDesktopAuth({ supabase, storage, openExternal, now = Date.now, onChange = () => {}, timeoutMs = 10000, onDiagnostic = () => {}, createProviderCallback, onProviderComplete = () => {} }) {
  const diagnose = stage => { try { onDiagnostic(stage); } catch { /* Best-effort only. */ } };
  let generation = 0;
  let userId = null;
  let identityKnown = false;
  let signedOut = false;
  let disposed = false;
  let busy = false;
  let pending = null;
  let pendingVersion = 0;
  let providerCallback = null;
  let isolatingFallback = false;
  let fallbackIsolated = false;
  let fallbackIsolation = null;
  let refreshStoppedForStorage = false;
  let activeAuthentication = null;
  const rawCleanups = new Set();
  const callbacks = new Set();
  const controllers = new Set();

  function announce() {
    if (!disposed) onChange({ type: 'auth-changed' });
  }
  function assertCurrent(epoch) {
    if (disposed || epoch !== generation) throw authError('AUTH_CHANGED');
  }
  async function bounded(operation) {
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        timer = setTimeout(() => reject(authError('AUTH_TIMEOUT')), timeoutMs);
      })]);
    } catch (error) {
      throw knownErrors.has(error?.message) ? authError(error.message) : authError('AUTH_FAILED');
    } finally { clearTimeout(timer); }
  }
  function validPending(value) {
    return value && (Object.keys(value).length === 3 || (Object.keys(value).length === 4 && value.transport === 'loopback')) && ['google', 'github'].includes(value.provider)
      && Number.isFinite(value.createdAt) && now() >= value.createdAt && now() - value.createdAt <= 300000
      && (value.userId === null || boundedText(value.userId));
  }
  async function clearPending() {
    pendingVersion += 1;
    pending = null;
    providerCallback?.receiver?.close();
    providerCallback = null;
    await bounded(() => storage.removeItem(PENDING_KEY));
  }
  function trackVerifierOperation(operation) {
    let settled = false;
    let abandoned = false;
    let quarantined = false;
    const result = Promise.resolve().then(operation).finally(async () => {
      if (abandoned) await clearPending().catch(() => {});
      settled = true;
      if (quarantined) busy = false;
    });
    return {
      result,
      abandon() { abandoned = true; },
      release() {
        if (settled) busy = false;
        else quarantined = true;
      },
    };
  }
  function storageIsolation() {
    if (storage.secure !== false || fallbackIsolated) return Promise.resolve();
    if (!fallbackIsolation) {
      // Unreadable old ciphertext must not outlive a successful memory-only identity.
      signedOut = true;
      userId = null;
      identityKnown = true;
      announce();
      fallbackIsolation = Promise.resolve().then(async () => {
        isolatingFallback = true;
        try {
          await rawLocalSignOut();
          fallbackIsolated = true;
        } finally { isolatingFallback = false; }
      });
    }
    return fallbackIsolation;
  }
  async function ensureStorageIsolation() {
    await bounded(storageIsolation);
  }
  const hydrationVersion = pendingVersion;
  const hydrated = bounded(async () => {
    if (typeof supabase.auth.initialize === 'function') {
      const initialized = await supabase.auth.initialize();
      if (initialized?.error) throw authError('AUTH_FAILED');
    }
    const values = await Promise.all([storage.getItem(PENDING_KEY), storage.getItem(LOGOUT_KEY)]);
    await ensureStorageIsolation();
    return values;
  }).then(([value, logout]) => {
    if (pendingVersion !== hydrationVersion || disposed) return;
    if (logout === '1') { signedOut = true; userId = null; identityKnown = true; }
    try {
      const decoded = value ? JSON.parse(value) : null;
      // A loopback port is process-local. Never revive its intent as a custom-URI login after restart.
      pending = validPending(decoded) && decoded.transport !== 'loopback' ? decoded : null;
    } catch { pending = null; }
  });
  // Keep a failed adapter from producing an unhandled rejection before the first request.
  void hydrated.catch(() => {});

  function acceptIdentity(next) {
    if (identityKnown && next !== userId) {
      generation += 1;
      void clearPending().catch(() => {});
    }
    const changed = !identityKnown || next !== userId;
    userId = next;
    identityKnown = true;
    if (changed) announce();
  }

  async function verifiedUser(epoch) {
    await hydrated;
    assertCurrent(epoch);
    if (signedOut) return null;
    const result = await bounded(() => supabase.auth.getUser());
    assertCurrent(epoch);
    if (result?.error && result.error.name !== 'AuthSessionMissingError') throw authError('AUTH_FAILED');
    const id = result?.data?.user?.id ?? null;
    if (id !== null && !boundedText(id)) throw authError('AUTH_FAILED');
    acceptIdentity(id);
    assertCurrent(epoch);
    return id;
  }

  const subscription = supabase.auth.onAuthStateChange((event, session) => {
    if (disposed) return;
    if (event === 'SIGNED_OUT') {
      if (isolatingFallback) return; // Expected SDK-only cleanup; preserve native barriers and the waiting caller's epoch.
      generation += 1;
      userId = null;
      identityKnown = true;
      signedOut = true;
      void clearPending().catch(() => {});
      announce();
    } else if (!busy && !signedOut && identityKnown && boundedText(session?.user?.id)
      && session.user.id !== userId) {
      acceptIdentity(session.user.id);
    }
  }).data.subscription;

  function rawLocalSignOut() {
    const raw = Promise.resolve().then(() => supabase.auth.signOut({ scope: 'local' })).then(result => {
      if (result?.error) throw authError('AUTH_FAILED');
    });
    rawCleanups.add(raw);
    const settled = () => rawCleanups.delete(raw);
    void raw.then(settled, settled);
    return raw;
  }
  async function localSignOut() {
    await bounded(rawLocalSignOut);
  }
  function assertNoRawCleanup() {
    if (rawCleanups.size) throw authError('AUTH_BUSY');
  }
  function releaseAuthentication(flight) {
    if (activeAuthentication === flight && flight.quarantined && flight.rawSettled && (!flight.cleanup || flight.cleanupSettled)) {
      activeAuthentication = null;
      busy = false;
    }
  }
  function cleanupAuthentication(flight) {
    if (!flight.cleanup) {
      // Called only after this raw SDK mutation settles. An earlier explicit logout
      // cannot cover a session created by its late result, even if fallback was isolated.
      flight.cleanup = Promise.resolve().then(async () => {
        await bounded(() => storage.setItem(LOGOUT_KEY, '1')).catch(() => {});
        if (flight.isolationRequired || (storage.secure === false && !fallbackIsolated)) await storageIsolation();
        else await rawLocalSignOut();
      }).finally(() => { flight.cleanupSettled = true; releaseAuthentication(flight); });
      void flight.cleanup.catch(() => {});
    }
    return flight.cleanup;
  }

  async function authenticate(operation) {
    if (disposed) throw authError('AUTH_CHANGED');
    if (busy) throw authError('AUTH_BUSY');
    assertNoRawCleanup();
    busy = true;
    const epoch = ++generation;
    const flight = { rawSettled: false, quarantined: false, isolationRequired: false, cleanup: null, cleanupSettled: false };
    activeAuthentication = flight;
    let sessionCreated = false;
    const afterRawSettlement = async () => {
      flight.rawSettled = true;
      // The SDK may persist a session before resolving. A cancelled/timed-out call must remove it even if it resolves late.
      if (disposed || generation !== epoch || flight.isolationRequired) await cleanupAuthentication(flight);
    };
    const operationResult = Promise.resolve().then(operation).then(async result => {
      await afterRawSettlement();
      return result;
    }, async error => { await afterRawSettlement(); throw error; }).finally(() => releaseAuthentication(flight));
    try {
      const result = await bounded(() => operationResult);
      if (disposed || generation !== epoch) throw authError('AUTH_CHANGED');
      if (result?.error) throw authError('AUTH_FAILED');
      const id = result?.data?.user?.id ?? result?.data?.session?.user?.id;
      if (!boundedText(id)) throw authError('AUTH_FAILED');
      sessionCreated = true;
      if (storage.secure === false && !fallbackIsolated) {
        flight.isolationRequired = true;
        await bounded(() => cleanupAuthentication(flight));
        throw authError('AUTH_CHANGED'); // Storage degraded during the SDK request; require a fresh deliberate login after cleanup.
      }
      await bounded(() => storage.removeItem(LOGOUT_KEY));
      assertCurrent(epoch);
      // Own authentication is the intentional identity transition for this epoch.
      userId = id;
      identityKnown = true;
      signedOut = false;
      if (refreshStoppedForStorage) {
        await bounded(() => supabase.auth.startAutoRefresh());
        refreshStoppedForStorage = false;
        assertCurrent(epoch);
      }
      announce();
      return { userId: id };
    } catch (error) {
      if (sessionCreated) {
        signedOut = true;
        userId = null;
        await bounded(() => storage.setItem(LOGOUT_KEY, '1')).catch(() => {});
        if (!flight.cleanup) await bounded(() => cleanupAuthentication(flight)).catch(() => {});
      }
      if (error?.message === 'AUTH_TIMEOUT') {
        generation += 1;
        signedOut = true;
        userId = null;
        identityKnown = true;
        await bounded(() => storage.setItem(LOGOUT_KEY, '1'));
        announce();
      }
      throw knownErrors.has(error?.message) ? authError(error.message) : authError('AUTH_FAILED');
    } finally {
      flight.quarantined = true;
      releaseAuthentication(flight);
    }
  }

  function validate(action, payload) {
    return policy.parseRequest({ id: 'auth', action, payload }).payload;
  }

  function authorizeUrl(value, provider, redirectTo = DESKTOP_AUTH_CALLBACK) {
    try {
      const configured = new URL(supabase.supabaseUrl);
      if (configured.protocol !== 'https:' || configured.username || configured.password || configured.search || configured.hash) throw authError('AUTH_FAILED');
      const expected = new URL('auth/v1/authorize', `${configured.href.replace(/\/$/, '')}/`);
      const url = new URL(value);
      const names = [...url.searchParams.keys()];
      if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password
        || url.hash || names.length !== new Set(names).size
        || names.some(name => !['provider', 'redirect_to', 'code_challenge', 'code_challenge_method', 'skip_http_redirect', 'prompt'].includes(name))
        || url.searchParams.get('provider') !== provider
        || url.searchParams.get('redirect_to') !== redirectTo
        || !boundedText(url.searchParams.get('code_challenge'), 256)
        || url.searchParams.get('code_challenge_method') !== 's256'
        || (url.searchParams.has('skip_http_redirect') && url.searchParams.get('skip_http_redirect') !== 'true')
        || (url.searchParams.has('prompt') && (provider !== 'google' || url.searchParams.get('prompt') !== 'select_account'))) throw authError('AUTH_FAILED');
      return url.href;
    } catch { throw authError('AUTH_FAILED'); }
  }

  async function consumeCallback(code, scope = null) {
    if (disposed || busy || callbacks.has(code) || (scope ? providerCallback !== scope : providerCallback !== null)) throw authError('INVALID_CALLBACK');
    const epoch = generation;
    await hydrated;
    assertCurrent(epoch);
    await ensureStorageIsolation();
    assertCurrent(epoch);
    if (scope && providerCallback !== scope) throw authError('INVALID_CALLBACK');
    if (!validPending(pending) || (!scope && pending.transport === 'loopback')) {
      diagnose('callback.pending-invalid');
      await clearPending();
      throw authError('INVALID_CALLBACK');
    }
    const attempt = pending;
    diagnose('callback.pending-valid');
    const current = await verifiedUser(epoch);
    if (current !== attempt.userId || pending !== attempt || (scope && providerCallback !== scope)) {
      // A slower prior callback may finish preflight after a new deliberate login.
      // It must reject itself without consuming or closing the successor's intent.
      if (pending === attempt && (!scope || providerCallback === scope)) await clearPending();
      throw authError('INVALID_CALLBACK');
    }
    callbacks.add(code);
    if (callbacks.size > 32) callbacks.delete(callbacks.values().next().value);
    await clearPending();
    assertCurrent(epoch);
    diagnose('callback.intent-consumed');
    return authenticate(() => {
      diagnose('callback.exchange-started');
      return supabase.auth.exchangeCodeForSession(code);
    });
  }

  return {
    storageFailed() {
      if (disposed) return;
      if (refreshStoppedForStorage) return; // One degradation owns one bounded cleanup, including its own failed removal.
      generation += 1;
      providerCallback?.receiver?.close(); providerCallback = null;
      signedOut = true; userId = null; identityKnown = true;
      fallbackIsolated = false; fallbackIsolation = null;
      refreshStoppedForStorage = true;
      if (activeAuthentication) activeAuthentication.isolationRequired = true;
      // No SDK reads in its storage callback/lock. Public timer control is queued and owned.
      void Promise.resolve().then(() => supabase.auth.stopAutoRefresh()).catch(() => {});
      announce();
      // The SDK lock is released after its typed error result. Own the subsequent
      // local-only cleanup so an older encrypted identity cannot survive a restart.
      if (activeAuthentication) {
        if (activeAuthentication.rawSettled) void cleanupAuthentication(activeAuthentication).catch(() => {});
      } else void ensureStorageIsolation().catch(() => {});
    },
    async status() {
      if (disposed) throw authError('AUTH_CHANGED');
      await hydrated;
      if (disposed) throw authError('AUTH_CHANGED');
      if (signedOut) return { userId: null };
      const epoch = generation;
      return { userId: await verifiedUser(epoch) };
    },
    async sendCode(email) {
      validate('sendCode', { email });
      if (disposed) throw authError('AUTH_CHANGED');
      if (busy) throw authError('AUTH_BUSY');
      busy = true;
      const epoch = generation;
      let work;
      try {
        await hydrated;
        assertCurrent(epoch);
        await ensureStorageIsolation();
        assertCurrent(epoch);
        await clearPending();
        assertCurrent(epoch);
        assertNoRawCleanup();
        work = trackVerifierOperation(() => supabase.auth.signInWithOtp({ email }));
        const result = await bounded(() => work.result);
        assertCurrent(epoch);
        if (result?.error) throw emailRequestError(result.error);
        return { sent: true };
      } catch (error) {
        work?.abandon();
        await clearPending().catch(() => {});
        throw error;
      } finally {
        if (work) work.release();
        else busy = false;
      }
    },
    async verifyCode(email, code) {
      validate('verifyCode', { email, code });
      if (disposed) throw authError('AUTH_CHANGED');
      if (busy) throw authError('AUTH_BUSY');
      const epoch = generation;
      await hydrated;
      assertCurrent(epoch);
      await ensureStorageIsolation();
      assertCurrent(epoch);
      await clearPending();
      assertCurrent(epoch);
      return authenticate(() => supabase.auth.verifyOtp({ email, token: code, type: 'email' }));
    },
    async signInProvider(provider) {
      validate('signInProvider', { provider });
      diagnose('provider.started');
      if (disposed) throw authError('AUTH_CHANGED');
      if (busy) throw authError('AUTH_BUSY');
      busy = true;
      const epoch = generation;
      let work;
      let callbackScope = null;
      let releaseOpening;
      const openingSettled = new Promise(resolve => { releaseOpening = resolve; });
      try {
        await hydrated;
        assertCurrent(epoch);
        await ensureStorageIsolation();
        assertCurrent(epoch);
        await clearPending();
        assertCurrent(epoch);
        assertNoRawCleanup();
        const startingUser = await verifiedUser(epoch);
        let redirectTo = DESKTOP_AUTH_CALLBACK;
        if (provider === 'google' && createProviderCallback) {
          const scope = { receiver: null };
          callbackScope = scope;
          providerCallback = scope;
          scope.receiver = createProviderCallback({
            onCallback: async code => {
              await openingSettled;
              diagnose('callback.received');
              try {
                assertCurrent(epoch);
                if (providerCallback !== scope) throw authError('INVALID_CALLBACK');
                diagnose('callback.validated');
                await consumeCallback(code, scope);
                diagnose('callback.completed');
                onProviderComplete();
              } catch (error) {
                diagnose(`callback.failed.${knownErrors.has(error?.message) ? error.message : 'INTERNAL_ERROR'}`);
                throw error;
              }
            },
            onExpire: () => { if (providerCallback === scope) void clearPending().catch(() => {}); },
          });
          redirectTo = await bounded(() => scope.receiver.ready);
          assertCurrent(epoch);
          if (providerCallback !== scope || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/auth\/callback\/[a-f0-9]{64}$/.test(redirectTo)
            || Number(new URL(redirectTo).port) > 65535) throw authError('AUTH_FAILED');
        }
        // OAuth and email OTP preparation both own the SDK's shared PKCE verifier until they settle.
        work = trackVerifierOperation(() => supabase.auth.signInWithOAuth({ provider,
          options: { redirectTo, skipBrowserRedirect: true,
            ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}) } }));
        const result = await bounded(() => work.result);
        assertCurrent(epoch);
        if (result?.error) throw authError('AUTH_FAILED');
        const url = authorizeUrl(result?.data?.url, provider, redirectTo);
        if (callbackScope && providerCallback !== callbackScope) throw authError('AUTH_CHANGED');
        pending = { provider, createdAt: now(), userId: startingUser, ...(callbackScope ? { transport: 'loopback' } : {}) };
        pendingVersion += 1;
        await bounded(() => storage.setItem(PENDING_KEY, JSON.stringify(pending)));
        assertCurrent(epoch);
        let browserUrl = url;
        if (callbackScope) {
          if (providerCallback !== callbackScope) throw authError('AUTH_CHANGED');
          browserUrl = callbackScope.receiver.authorizationEntry(url);
          if (browserUrl !== redirectTo.replace('/auth/callback/', '/auth/start/')) throw authError('AUTH_FAILED');
        }
        await bounded(() => openExternal(browserUrl));
        assertCurrent(epoch);
        diagnose('provider.opened');
        return { opened: true };
      } catch (error) {
        work?.abandon();
        await clearPending().catch(() => {});
        throw knownErrors.has(error?.message) ? authError(error.message) : authError('AUTH_FAILED');
      } finally {
        if (work) work.release();
        else busy = false;
        releaseOpening();
      }
    },
    async handleCallback(url) {
      const { code } = policy.parseAuthCallback(url);
      return consumeCallback(code);
    },
    async webTicket(requestId) {
      policy.parseRequest({ id: requestId, action: 'webTicket', payload: {} });
      if (disposed || busy) throw authError('AUTH_CHANGED');
      const epoch = generation;
      const expectedUser = await verifiedUser(epoch);
      if (!expectedUser) throw authError('AUTH_CHANGED');
      const sessionResult = await bounded(() => supabase.auth.getSession());
      assertCurrent(epoch);
      const session = sessionResult?.data?.session;
      if (sessionResult?.error || session?.user?.id !== expectedUser
        || !boundedText(session?.access_token, 16384)) throw authError('AUTH_CHANGED');
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const result = await bounded(() => supabase.functions.invoke('mobile-web-auth', {
          method: 'POST', body: {}, headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal, timeout: timeoutMs,
        }));
        assertCurrent(epoch);
        if (userId !== expectedUser || signedOut) throw authError('AUTH_CHANGED');
        const ticket = result?.data;
        if (result?.error || ticket?.user_id !== expectedUser || ticket?.verification_type !== 'magiclink'
          || !boundedText(ticket?.token_hash, 4096)) throw authError('AUTH_FAILED');
        return { type: 'STUDY_WEB_AUTH_TICKET', requestId, userId: expectedUser, tokenHash: ticket.token_hash };
      } finally {
        controller.abort();
        controllers.delete(controller);
      }
    },
    async signOut() {
      generation += 1;
      signedOut = true;
      userId = null;
      identityKnown = true;
      for (const controller of controllers) controller.abort();
      announce();
      const results = await Promise.allSettled([
        bounded(() => storage.setItem(LOGOUT_KEY, '1')),
        clearPending(),
        localSignOut(),
      ]);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      return { signedOut: true };
    },
    dispose() {
      disposed = true;
      generation += 1;
      providerCallback?.receiver?.close(); providerCallback = null;
      for (const controller of controllers) controller.abort();
      subscription.unsubscribe();
    },
  };
}
