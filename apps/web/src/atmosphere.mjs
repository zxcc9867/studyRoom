const STORAGE_KEY = 'study-room-atmosphere';
const videoVariants = {
  'cloud-sky': {720: '/themes/video/cloud-sky.webm', 1080: '/themes/video/cloud-sky-hd.webm'},
  'ocean-waves': {720: '/themes/video/ocean-waves-sd.webm', 1080: '/themes/video/ocean-waves.webm'},
  'city-night': {720: '/themes/video/city-night.webm', 1080: '/themes/video/city-night-hd.webm'},
  'fireplace': {720: '/themes/video/fireplace.webm', 1080: '/themes/video/fireplace-hd.webm'},
  'snow-night': {720: '/themes/video/snow-night.webm', 1080: '/themes/video/snow-night-hd.webm'},
  'lake-sunset': {720: '/themes/video/lake-sunset.webm', 1080: '/themes/video/lake-sunset-hd.webm'},
  'anime-sea': {720: '/themes/video/anime-sea.webm', 1080: '/themes/video/anime-sea-hd.webm'},
};
export const atmosphereThemes = Object.freeze([
  {id: 'charcoal', name: '차콜', live: false},
  {id: 'dawn-city', name: '새벽 도시', live: false},
  {id: 'night-alley', name: '심야 골목', live: false},
  {id: 'star-sea', name: '별빛 바다', live: true},
  {id: 'sunset-sky', name: '노을 하늘', live: false},
  {id: 'rain-library', name: '비 오는 서재', live: true},
  {id: 'cloud-sky', name: '흐르는 구름', live: true, video: '/themes/video/cloud-sky.webm', poster: '/themes/video/cloud-sky-poster.webp', thumbnail: '/themes/video/cloud-sky-thumb.webp', author: 'All4sounds', source: 'https://commons.wikimedia.org/wiki/File:All4sounds_-_Cloud_Time_lapse.webm', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/'},
  {id: 'ocean-waves', name: '해변의 파도', live: true, video: '/themes/video/ocean-waves.webm', poster: '/themes/video/ocean-waves-poster.webp', thumbnail: '/themes/video/ocean-waves-thumb.webp', author: 'Lukas Beck', source: 'https://commons.wikimedia.org/wiki/File:Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'},
  {id: 'starry-night', name: '별빛 밤하늘', live: true, video: '/themes/video/starry-night.webm', poster: '/themes/video/starry-night-poster.webp', thumbnail: '/themes/video/starry-night-thumb.webp', author: 'Mike Wetzel', source: 'https://commons.wikimedia.org/wiki/File:Milky_Way_in_Glen_Canyon_National_Recreation_Area.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/'},
  {id: 'rain-window', name: '비 오는 창가', live: true, video: '/themes/video/rain-window.webm', poster: '/themes/video/rain-window-poster.webp', thumbnail: '/themes/video/rain-window-thumb.webp', author: 'slavikfi (Vjatseslav Robtsenkov)', source: 'https://commons.wikimedia.org/wiki/File:Raindrops_against_the_window_in_the_night_city,_Las_Palmas.webm', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/'},
  {id: 'city-night', name: '도시의 밤', live: true, video: '/themes/video/city-night.webm', poster: '/themes/video/city-night-poster.webp', thumbnail: '/themes/video/city-night-thumb.webp', author: 'Editor (youtube.com/user/Editor)', source: 'https://commons.wikimedia.org/wiki/File:City_at_night.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/'},
  {id: 'fireplace', name: '따뜻한 벽난로', live: true, video: '/themes/video/fireplace.webm', poster: '/themes/video/fireplace-poster.webp', thumbnail: '/themes/video/fireplace-thumb.webp', author: 'free video library', source: 'https://commons.wikimedia.org/wiki/File:Fantastic-fireplace-fire-chimney-hearth-_background_-_texture_-_motion_graphics_-_free_video_library.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/'},
  {id: 'snow-night', name: '눈 내리는 밤거리', live: true, video: '/themes/video/snow-night.webm', poster: '/themes/video/snow-night-poster.webp', thumbnail: '/themes/video/snow-night-thumb.webp', author: 'Mike E.', source: 'https://commons.wikimedia.org/wiki/File:Dec_8th_Snow_Timelapse.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/'},
  {id: 'lake-sunset', name: '노을 지는 호수', live: true, video: '/themes/video/lake-sunset.webm', poster: '/themes/video/lake-sunset-poster.webp', thumbnail: '/themes/video/lake-sunset-thumb.webp', author: 'John Brighenti', source: 'https://commons.wikimedia.org/wiki/File:Seventh_Lake_Sunset.webm', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/'},
  {id: 'anime-sea', name: '별빛 바다와 유성', live: true, video: '/themes/video/anime-sea.webm', poster: '/themes/video/anime-sea-poster.webp', thumbnail: '/themes/video/anime-sea-thumb.webp', author: '독서실', source: 'https://github.com/zxcc9867/studyRoom/blob/fix/study-dashboard-clarity/docs/media/anime-sea/README.md', attribution: 'AI 생성 원화를 바탕으로 자체 제작한 애니메이션 영상.', changes: '잔물결·반사광·유성 애니메이션·24초 무음 반복. 원화 1672×941, 영상 출력 720p/1080p.'},
].map(theme => Object.freeze({...theme, ...(['fireplace', 'snow-night', 'lake-sunset'].includes(theme.id) ? {changes: '구간 편집·1초 반복 연결·무음 재인코딩·포스터 추출·화면 채움·재생 속도 조정.'} : {}), ...(theme.video ? {videoSources: Object.freeze(videoVariants[theme.id] ?? {720: theme.video})} : {})})));

export function atmosphereVideoSource(theme, quality = 'auto', mobile = false) {
  if (!theme.video) return null;
  const resolution = quality === 'saver' || quality === 'auto' && mobile || !theme.videoSources[1080] ? 720 : 1080;
  return {src: theme.videoSources[resolution], resolution};
}

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
  return {background: theme.id, motion, intensity: value?.intensity === 'normal' ? 'normal' : 'subtle', paused: motion === 'live' && value?.paused === true, quality: ['saver', 'high'].includes(value?.quality) ? value.quality : 'auto'};
}
function parse(value) {
  try { return normalize(JSON.parse(value)); } catch { return normalize(null); }
}

// Decorative presentation only. Never observes or controls study/camera/native state.
export function createAtmosphereController(host) {
  const navigator = host.navigator;
  const mobile = navigator?.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent ?? '') || /Macintosh/i.test(navigator?.userAgent ?? '') && navigator?.maxTouchPoints > 1;
  let storage, preferences = normalize(null), persistent = false;
  try { storage = host.localStorage; preferences = parse(storage.getItem(STORAGE_KEY)); persistent = true; } catch {}
  const reduced = host.matchMedia('(prefers-reduced-motion: reduce)');
  let focused = host.document.hasFocus?.() !== false;
  const listeners = new Set();
  let videoStatus = 'idle', videoRequest = 0, videoBackground = preferences.background, videoMotion = preferences.motion, videoSource;
  let snapshot;
  function apply() {
    const hidden = host.document.visibilityState === 'hidden';
    const playing = preferences.motion === 'live' && !preferences.paused && !reduced.matches && !hidden && focused;
    const theme = atmosphereThemes.find(theme => theme.id === preferences.background);
    const source = atmosphereVideoSource(theme, preferences.quality, mobile);
    if (videoBackground !== preferences.background || videoMotion !== preferences.motion || videoSource !== source?.src) {
      videoBackground = preferences.background; videoMotion = preferences.motion; videoStatus = 'idle'; videoRequest++;
      videoSource = source?.src;
    }
    if (!playing && (videoStatus === 'playing' || videoStatus === 'loading')) videoStatus = 'paused';
    const next = {...preferences, persistent, reducedMotion: reduced.matches, hidden, focused, playing, videoStatus, videoRequest, mobile, videoSource, videoResolution: source?.resolution};
    const root = host.document.documentElement;
    root.dataset.studyBackground = preferences.background;
    root.dataset.studyMotion = preferences.motion === 'static' ? 'static' : playing ? 'playing' : 'paused';
    root.dataset.studyIntensity = preferences.intensity;
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
    reportVideoPlayback(background, status, request = videoRequest) {
      if (request !== videoRequest) return;
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
