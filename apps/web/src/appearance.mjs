const STORAGE_KEY = 'study-room-appearance';
const preferences = ['system', 'light', 'dark'];
const normalize = value => preferences.includes(value) ? value : 'system';

// Presentation preference only: no account, study or native state is read or written.
export function createAppearanceController(host) {
  let storage;
  let preference = 'system';
  try { storage = host.localStorage; preference = normalize(storage.getItem(STORAGE_KEY)); } catch { storage = undefined; }
  const media = host.matchMedia('(prefers-color-scheme: dark)');
  const listeners = new Set();
  let snapshot;
  let persistent = Boolean(storage);
  function apply() {
    const theme = preference === 'system' ? media.matches ? 'dark' : 'light' : preference;
    host.document.documentElement.dataset.studyTheme = theme;
    host.document.documentElement.style.colorScheme = theme;
    host.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111318' : '#f4f6f3');
    if (snapshot?.preference === preference && snapshot.theme === theme && snapshot.persistent === persistent) return;
    snapshot = Object.freeze({ preference, theme, persistent });
    listeners.forEach(listener => listener());
  }
  media.addEventListener('change', apply);
  host.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage) return;
    preference = normalize(event.newValue);
    apply();
  });
  apply();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setPreference(value) {
      if (!preferences.includes(value)) return;
      preference = value;
      try { if (!storage) storage = host.localStorage; storage.setItem(STORAGE_KEY, value); persistent = true; }
      catch { persistent = false; }
      apply();
    },
  };
}

let controller;
export function getAppearanceController(host) {
  return controller ??= createAppearanceController(host);
}
