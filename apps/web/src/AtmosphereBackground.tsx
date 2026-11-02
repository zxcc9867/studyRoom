import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {atmosphereThemes, getAtmosphereController, type AtmosphereTheme} from './atmosphere.mjs';

// Decorative file video only: never shares the camera ref or a MediaStream.
function VideoBackground({theme}: {theme: AtmosphereTheme}) {
  const controller = getAtmosphereController(window);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const video = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);
  const [painted, setPainted] = useState(false);
  const failedRequest = useRef<number | null>(null);
  useEffect(() => { if (state.playing) setActivated(true); }, [state.playing]);
  useEffect(() => {
    const node = video.current;
    if (!node || !activated) return;
    let disposed = false;
    const report = (status: 'loading' | 'playing' | 'error') => {
      if (disposed) return;
      if (status === 'error') { failedRequest.current = state.videoRequest; setPainted(false); }
      if (status === 'playing') setPainted(true);
      controller.reportVideoPlayback(theme.id, status);
    };
    if (!state.playing) { node.pause(); return; }
    if (failedRequest.current === state.videoRequest) return;
    const playing = () => report('playing'), waiting = () => report('loading'), error = () => report('error');
    node.addEventListener('playing', playing); node.addEventListener('waiting', waiting); node.addEventListener('error', error);
    node.muted = true; node.volume = 0; node.playbackRate = state.intensity === 'subtle' ? .75 : 1;
    report('loading');
    if (failedRequest.current !== null) { failedRequest.current = null; node.load(); }
    void node.play().then(() => { if (!disposed) report('playing'); }).catch(() => report('error'));
    return () => { disposed = true; node.removeEventListener('playing', playing); node.removeEventListener('waiting', waiting); node.removeEventListener('error', error); node.pause(); };
  }, [activated, state.playing, state.videoRequest, state.intensity, controller, theme]);
  return <video ref={video} data-atmosphere-video data-painted={painted} className="atmosphere-video" aria-hidden="true" tabIndex={-1} muted loop playsInline disablePictureInPicture disableRemotePlayback preload="none" poster={theme.poster} src={activated ? theme.video : undefined} />;
}

export default function AtmosphereBackground() {
  const controller = getAtmosphereController(window);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const theme = atmosphereThemes.find(theme => theme.id === state.background)!;
  return theme.video && state.motion === 'live' ? <VideoBackground key={theme.id} theme={theme}/> : null;
}
