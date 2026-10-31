const STORAGE_KEY = 'study-room-atmosphere';
export const atmosphereThemes = Object.freeze([
  {id: 'charcoal', name: '차콜', live: false},
  {id: 'dawn-city', name: '새벽 도시', live: false},
  {id: 'night-alley', name: '심야 골목', live: false},
  {id: 'star-sea', name: '별빛 바다', live: true},
  {id: 'sunset-sky', name: '노을 하늘', live: false},
  {id: 'rain-library', name: '비 오는 서재', live: true},
].map(Object.freeze));

function normalize(value) {
  const theme = atmosphereThemes.find(theme => theme.id === value?.background) ?? atmosphereThemes[0];
  const motion = theme.live && value?.motion === 'live' ? 'live' : 'static';
  return {background: theme.id, motion, intensity: value?.intensity === 'normal' ? 'normal' : 'subtle', paused: motion === 'live' && value?.paused === true};
}
function parse(value) {
  try { return normalize(JSON.parse(value)); } catch { return normalize(null); }
}

// Decorative presentation only. Never observes or controls study/camera/native state.
export function createAtmosphereController(host) {
  let storage, preferences = normalize(null), persistent = false;
  try { storage = host.localStorage; preferences = parse(storage.getItem(STORAGE_KEY)); persistent = true; } catch {}
  const reduced = host.matchMedia('(prefers-reduced-motion: reduce)');
  let focused = host.document.hasFocus?.() !== false;
  const listeners = new Set();
  let snapshot;
  function apply() {
    const hidden = host.document.visibilityState === 'hidden';
    const playing = preferences.motion === 'live' && !preferences.paused && !reduced.matches && !hidden && focused;
    const next = {...preferences, persistent, reducedMotion: reduced.matches, hidden, focused, playing};
    const root = host.document.documentElement;
    root.dataset.studyBackground = preferences.background;
    root.dataset.studyMotion = preferences.motion === 'static' ? 'static' : playing ? 'playing' : 'paused';
    root.dataset.studyIntensity = preferences.intensity;
    root.style.setProperty('--study-scene', preferences.background === 'charcoal' ? 'none' : `url("/themes/${preferences.background}.webp")`);
    if (snapshot && Object.keys(next).every(key => snapshot[key] === next[key])) return;
    snapshot = Object.freeze(next);
    listeners.forEach(listener => listener());
  }
  reduced.addEventListener('change', apply);
  host.document.addEventListener('visibilitychange', apply);
  // Electron keeps visibilityState=visible with backgroundThrottling:false so
  // study/camera can continue in the tray. Pause decoration on window blur too.
  host.addEventListener('blur', () => { focused = false; apply(); });
  host.addEventListener('focus', () => { focused = true; apply(); });
  host.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage) return;
    preferences = parse(event.newValue);
    try { persistent = Boolean(storage) && storage.getItem(STORAGE_KEY) === event.newValue; } catch { persistent = false; }
    apply();
  });
  apply();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setPreferences(value) {
      preferences = normalize(value);
      try { storage ??= host.localStorage; storage.setItem(STORAGE_KEY, JSON.stringify(preferences)); persistent = true; }
      catch { persistent = false; }
      apply();
    },
  };
}

let controller;
export function getAtmosphereController(host) {
  return controller ??= createAtmosphereController(host);
}
