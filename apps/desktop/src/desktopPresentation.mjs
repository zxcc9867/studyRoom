// Local geometry only. No authentication, study, media, or persistence dependency.
export function createDesktopPresentation({window, getDisplays = () => []}) {
  let snapshot = null;
  let mode = 'normal';
  const status = () => ({mode});
  const alive = () => !window.isDestroyed();
  function clamp(bounds) {
    const areas = getDisplays().map(display=>display.workArea).filter(area=>area
      && ['x','y','width','height'].every(key=>Number.isFinite(area[key])) && area.width>0 && area.height>0);
    if (!areas.length) return {...bounds};
    const distance = area => Math.max(area.x-bounds.x,0,bounds.x-area.x-area.width)**2
      + Math.max(area.y-bounds.y,0,bounds.y-area.y-area.height)**2;
    const area=areas.reduce((best,next)=>distance(next)<distance(best)?next:best);
    const width=Math.min(bounds.width,area.width),height=Math.min(bounds.height,area.height);
    return {x:Math.max(area.x,Math.min(bounds.x,area.x+area.width-width)),
      y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-height)),width,height};
  }
  function restore() {
    if (!snapshot) return status();
    if (!alive()) {snapshot=null;mode='normal';return status();}
    const bounds=clamp(snapshot.bounds);
    window.setMinimumSize?.(Math.min(snapshot.minimum[0],bounds.width),Math.min(snapshot.minimum[1],bounds.height));
    window.setBounds(bounds);
    if(snapshot.maximized)window.maximize?.();
    snapshot=null;mode='normal';
    return status();
  }
  function set(value) {
    if (!alive()) throw Error('WINDOW_UNAVAILABLE');
    if (value.mode==='normal') return restore();
    if (!snapshot) {
      snapshot={bounds:{...(window.getNormalBounds?.()??window.getBounds())},
        maximized:window.isMaximized?.()===true,
        minimum:window.getMinimumSize?.()??[375,600]};
      // Mark before mutations so a partial OS failure can still be recovered.
      mode='mini';
      const bounds=clamp({...snapshot.bounds,width:420,height:560});
      window.setMinimumSize?.(Math.min(375,bounds.width),Math.min(460,bounds.height));
      if(snapshot.maximized)window.unmaximize?.();
      window.setBounds(bounds);
    }
    return status();
  }
  function clampCurrent() {
    if(!alive())return;
    if(mode==='mini') {
      const bounds=clamp(window.getBounds?.()??window.getNormalBounds());
      window.setMinimumSize?.(Math.min(375,bounds.width),Math.min(460,bounds.height));
      window.setBounds(bounds);
    }
  }
  return {status,set,restore,clampCurrent};
}
