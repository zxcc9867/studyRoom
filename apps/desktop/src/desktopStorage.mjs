import { AuthRetryableFetchError } from '@supabase/supabase-js';

// The SDK resolves its shared refresh result for public AuthError instances. An ordinary
// adapter rejection also rejects an unobserved SDK deferred in the pinned SDK. Keep this
// translation at the SDK storage boundary: the write still FAILS, health still degrades,
// and the native owner immediately revokes identity until deliberate local isolation.
export function createSdkStorage({ storage, onFailure = () => {} }) {
  const invoke = async (method, ...args) => {
    try { return await storage[method](...args); }
    catch {
      onFailure();
      throw new AuthRetryableFetchError('STORAGE_UNAVAILABLE', 503);
    }
  };
  return {
    getItem: key => invoke('getItem', key),
    setItem: (key, value) => invoke('setItem', key, value),
    removeItem: key => invoke('removeItem', key),
  };
}

// The injected disk adapter owns paths/atomic replacement; this module only handles ciphertext.
export function createEncryptedStorage({ safeStorage, read, write, remove }) {
  const memory = new Map();
  const revisions = new Map();
  let available = false;
  try { available = safeStorage.isEncryptionAvailable() === true; } catch { /* Memory-only mode. */ }
  let healthy = true;
  let tail = Promise.resolve();
  const enqueue = operation => {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  };
  const unavailable = () => { healthy = false; throw new Error('STORAGE_UNAVAILABLE'); };

  return {
    get secure() { return available && healthy; },
    async getItem(key) {
      await tail;
      if (memory.has(key)) return memory.get(key);
      if (!available || !healthy) return null;
      const revision = revisions.get(key);
      try {
        const ciphertext = await read(key);
        if (revision !== revisions.get(key)) return memory.get(key) ?? null;
        if (ciphertext === null || ciphertext === undefined) return null;
        const value = safeStorage.decryptString(ciphertext);
        if (typeof value !== 'string') return null;
        memory.set(key, value);
        return value;
      } catch {
        healthy = false;
        return null;
      }
    },
    setItem(key, value) {
      if (typeof key !== 'string' || typeof value !== 'string') return Promise.reject(new Error('STORAGE_UNAVAILABLE'));
      memory.set(key, value);
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      return enqueue(async () => {
        if (!available || !healthy) return;
        try { await write(key, safeStorage.encryptString(value)); } catch { unavailable(); }
      });
    },
    removeItem(key) {
      memory.delete(key);
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      return enqueue(async () => {
        try { await remove(key); } catch { unavailable(); }
      });
    },
  };
}
