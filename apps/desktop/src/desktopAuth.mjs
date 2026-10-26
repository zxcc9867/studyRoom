import { createDesktopPolicy, DESKTOP_AUTH_CALLBACK } from './desktopPolicy.mjs';

const PENDING_KEY = 'desktop-pkce-pending-v1';
const LOGOUT_KEY = 'desktop-signed-out-v1';
const policy = createDesktopPolicy();
const boundedText = (value, max = 128) => typeof value === 'string' && value.length > 0
  && value.length <= max && !/[\x00-\x20\x7f]/.test(value);
const authError = code => new Error(code);
const knownErrors = new Set(['BAD_REQUEST', 'AUTH_FAILED', 'AUTH_CHANGED', 'AUTH_TIMEOUT', 'AUTH_BUSY', 'INVALID_CALLBACK']);

export function createDesktopAuth({ supabase, storage, openExternal, now = Date.now, onChange = () => {}, timeoutMs = 10000 }) {
  let generation = 0;
  let userId = null;
  let identityKnown = false;
  let signedOut = false;
  let disposed = false;
  let busy = false;
  let pending = null;
  let pendingVersion = 0;
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
    return value && Object.keys(value).length === 3 && ['google', 'github'].includes(value.provider)
      && Number.isFinite(value.createdAt) && now() >= value.createdAt && now() - value.createdAt <= 300000
      && (value.userId === null || boundedText(value.userId));
  }
  async function clearPending() {
    pendingVersion += 1;
    pending = null;
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
      pending = validPending(decoded) ? decoded : null;
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

  function authorizeUrl(value, provider) {
    try {
      const configured = new URL(supabase.supabaseUrl);
      if (configured.protocol !== 'https:' || configured.username || configured.password || configured.search || configured.hash) throw authError('AUTH_FAILED');
      const expected = new URL('auth/v1/authorize', `${configured.href.replace(/\/$/, '')}/`);
      const url = new URL(value);
      const names = [...url.searchParams.keys()];
      if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password
        || url.hash || names.length !== new Set(names).size
        || names.some(name => !['provider', 'redirect_to', 'code_challenge', 'code_challenge_method', 'skip_http_redirect'].includes(name))
        || url.searchParams.get('provider') !== provider
        || url.searchParams.get('redirect_to') !== DESKTOP_AUTH_CALLBACK
        || !boundedText(url.searchParams.get('code_challenge'), 256)
        || url.searchParams.get('code_challenge_method') !== 's256'
        || (url.searchParams.has('skip_http_redirect') && url.searchParams.get('skip_http_redirect') !== 'true')) throw authError('AUTH_FAILED');
      return url.href;
    } catch { throw authError('AUTH_FAILED'); }
  }

  return {
    storageFailed() {
      if (disposed) return;
      if (refreshStoppedForStorage) return; // One degradation owns one bounded cleanup, including its own failed removal.
      generation += 1;
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
        if (result?.error) throw authError('AUTH_FAILED');
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
        const startingUser = await verifiedUser(epoch);
        // OAuth and email OTP preparation both own the SDK's shared PKCE verifier until they settle.
        work = trackVerifierOperation(() => supabase.auth.signInWithOAuth({ provider,
          options: { redirectTo: DESKTOP_AUTH_CALLBACK, skipBrowserRedirect: true } }));
        const result = await bounded(() => work.result);
        assertCurrent(epoch);
        if (result?.error) throw authError('AUTH_FAILED');
        const url = authorizeUrl(result?.data?.url, provider);
        pending = { provider, createdAt: now(), userId: startingUser };
        pendingVersion += 1;
        await bounded(() => storage.setItem(PENDING_KEY, JSON.stringify(pending)));
        assertCurrent(epoch);
        await bounded(() => openExternal(url));
        assertCurrent(epoch);
        return { opened: true };
      } catch (error) {
        work?.abandon();
        await clearPending().catch(() => {});
        throw knownErrors.has(error?.message) ? authError(error.message) : authError('AUTH_FAILED');
      } finally {
        if (work) work.release();
        else busy = false;
      }
    },
    async handleCallback(url) {
      const { code } = policy.parseAuthCallback(url);
      if (disposed || busy || callbacks.has(code)) throw authError('INVALID_CALLBACK');
      const epoch = generation;
      await hydrated;
      assertCurrent(epoch);
      await ensureStorageIsolation();
      assertCurrent(epoch);
      if (!validPending(pending)) {
        await clearPending();
        throw authError('INVALID_CALLBACK');
      }
      const attempt = pending;
      const current = await verifiedUser(epoch);
      if (current !== attempt.userId || !pending) {
        await clearPending();
        throw authError('INVALID_CALLBACK');
      }
      // Consume persisted intent before any exchange; concurrent/replayed callbacks cannot reuse it.
      callbacks.add(code);
      if (callbacks.size > 32) callbacks.delete(callbacks.values().next().value);
      await clearPending();
      assertCurrent(epoch);
      return authenticate(() => supabase.auth.exchangeCodeForSession(code));
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
      for (const controller of controllers) controller.abort();
      subscription.unsubscribe();
    },
  };
}
