import { isDesktopStudyApp } from './desktopBridge.mjs';

export const supabaseAuthStorageKey = "study-room-attendance-auth-session";
const desktopBootstraps = new WeakMap();
const optionsFor = desktop => ({
  autoRefreshToken: true,
  detectSessionInUrl: false,
  persistSession: !desktop,
  storageKey: supabaseAuthStorageKey,
});

export function createSupabaseAuthOptions(host = typeof window === 'undefined' ? undefined : window) {
  const desktop = isDesktopStudyApp(host);
  if (desktop) {
    try {
      // This partition previously used browser persistence. Remove only the
      // renderer credential, before constructing a client that could hydrate it.
      host.localStorage.removeItem(supabaseAuthStorageKey);
    } catch {
      throw new Error('DESKTOP_AUTH_STORAGE_CLEANUP_FAILED');
    }
  }
  return optionsFor(desktop);
}

// The client and its UI gate share one cleanup latch per desktop document.
// Failure permits only an empty memory client, never authentication or hydration.
export function getSupabaseAuthBootstrap(host = typeof window === 'undefined' ? undefined : window) {
  if (!isDesktopStudyApp(host)) return { options: createSupabaseAuthOptions(host), failed: false, assertReady() {}, retry() {} };
  if (desktopBootstraps.has(host)) return desktopBootstraps.get(host);
  let failed = false;
  let options;
  try { options = createSupabaseAuthOptions(host); }
  catch { failed = true; options = optionsFor(true); }
  const bootstrap = {
    options,
    get failed() { return failed; },
    assertReady() { if (failed) throw new Error('DESKTOP_AUTH_STORAGE_CLEANUP_FAILED'); },
    retry() {
      if (!failed) return;
      createSupabaseAuthOptions(host);
      failed = false;
    },
  };
  desktopBootstraps.set(host, bootstrap);
  return bootstrap;
}
