const STORAGE_KEY = 'study-room-atmosphere';
export const atmosphereThemes = Object.freeze([
  {id: 'charcoal', name: '차콜', live: false},
  {id: 'dawn-city', name: '새벽 도시', live: false},
  {id: 'night-alley', name: '심야 골목', live: false},
  {id: 'star-sea', name: '별빛 바다', live: true},
  {id: 'sunset-sky', name: '노을 하늘', live: false},
  {id: 'rain-library', name: '비 오는 서재', live: true},
  {id: 'cloud-sky', name: '흐르는 구름', live: true, video: '/themes/video/cloud-sky.webm', poster: '/themes/video/cloud-sky-poster.webp', thumbnail: '/themes/video/cloud-sky-thumb.webp', author: 'All4sounds', source: 'https://commons.wikimedia.org/wiki/File:All4sounds_-_Cloud_Time_lapse.webm', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/'},
  {id: 'ocean-waves', name: '해변의 파도', live: true, video: '/themes/video/ocean-waves.webm', poster: '/themes/video/ocean-waves-poster.webp', thumbnail: '/themes/video/ocean-waves-thumb.webp', author: 'Lukas Beck', source: 'https://commons.wikimedia.org/wiki/File:Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'},
].map(Object.freeze));

export function atmosphereKind(theme) { return theme.video ? '영상 라이브' : theme.live ? '이미지 효과' : '정적 이미지'; }
export function atmospherePlayback(snapshot) {
  if (snapshot.motion !== 'live') return '정적 이미지';
  if (snapshot.reducedMotion) return '움직임 줄이기로 정지';
  if (snapshot.paused) return '라이브 일시정지';
  if (!snapshot.focused || snapshot.hidden) return '비활성 창에서 정지';
  const theme = atmosphereThemes.find(theme => theme.id === snapshot.background);
  if (!theme?.video) return '이미지 효과 재생 중';
  return snapshot.videoStatus === 'playing' ? '영상 라이브 재생 중' : snapshot.videoStatus === 'error' ? '영상을 재생하지 못했어요' : '영상 불러오는 중';
}

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
  let videoStatus = 'idle', videoRequest = 0, videoBackground = preferences.background, videoMotion = preferences.motion;
  let snapshot;
  function apply() {
    const hidden = host.document.visibilityState === 'hidden';
    const playing = preferences.motion === 'live' && !preferences.paused && !reduced.matches && !hidden && focused;
    if (videoBackground !== preferences.background || videoMotion !== preferences.motion) {
      videoBackground = preferences.background; videoMotion = preferences.motion; videoStatus = 'idle'; videoRequest++;
    }
    if (!playing && (videoStatus === 'playing' || videoStatus === 'loading')) videoStatus = 'paused';
    const next = {...preferences, persistent, reducedMotion: reduced.matches, hidden, focused, playing, videoStatus, videoRequest};
    const root = host.document.documentElement;
    root.dataset.studyBackground = preferences.background;
    root.dataset.studyMotion = preferences.motion === 'static' ? 'static' : playing ? 'playing' : 'paused';
    root.dataset.studyIntensity = preferences.intensity;
    const theme = atmosphereThemes.find(theme => theme.id === preferences.background);
    root.style.setProperty('--study-scene', preferences.background === 'charcoal' ? 'none' : `url("${theme.poster ?? `/themes/${preferences.background}.webp`}")`);
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
    reportVideoPlayback(background, status) {
      if (background !== preferences.background || !atmosphereThemes.find(theme => theme.id === background)?.video) return;
      if (!['idle','loading','playing','paused','error'].includes(status) || status === 'playing' && !snapshot.playing) return;
      videoStatus = status; apply();
    },
    retryVideo() { videoStatus = 'idle'; videoRequest++; apply(); },
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
