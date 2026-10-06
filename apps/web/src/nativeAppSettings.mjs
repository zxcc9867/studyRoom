const permissionStates = ['granted', 'denied', 'unsupported', 'unknown'];
const updaterStates = ['idle', 'checking', 'latest', 'available', 'downloading', 'verifying', 'ready', 'cancelled', 'failed', 'permission_required', 'install_pending', 'installed'];
function supported(host) {
  return Boolean(host?.studyRoomNativeSettings === true && host.ReactNativeWebView?.postMessage && host.top === host && host.location?.hash === '#settings');
}
function validSnapshot(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 4) return false;
  const p = value.permissions;
  return (value.versionName === null || typeof value.versionName === 'string' && value.versionName.length > 0 && value.versionName.length <= 32)
    && (value.versionCode === null || Number.isSafeInteger(value.versionCode) && value.versionCode > 0)
    && updaterStates.includes(value.updaterStatus) && p && typeof p === 'object' && Object.keys(p).length === 3
    && ['camera', 'notifications', 'focus'].every(key => permissionStates.includes(p[key]));
}
export function getNativeSettingsInfo(host, timeoutMs = 5000) {
  if (!supported(host)) return Promise.resolve({ status: 'unsupported' });
  return new Promise(resolve => {
    const requestId = host.crypto.randomUUID();
    const finish = result => { clearTimeout(timer); host.removeEventListener('study-room-native-message', receive); resolve(result); };
    const receive = event => {
      const m = event.detail;
      if (!supported(host) || m?.type !== 'STUDY_NATIVE_SETTINGS_INFO' || m.requestId !== requestId || Object.keys(m).length !== 3 || !validSnapshot(m.snapshot)) return;
      finish({ status: 'ready', snapshot: m.snapshot });
    };
    const timer = setTimeout(() => finish({ status: 'failure' }), Math.max(1, Math.min(30000, timeoutMs)));
    host.addEventListener('study-room-native-message', receive);
    try { host.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STUDY_WEB_SETTINGS_INFO', requestId })); }
    catch { finish({ status: 'failure' }); }
  });
}
export function openNativeSettings(host, target) {
  if (!supported(host) || !['update', 'focus', 'permissions'].includes(target)) return false;
  try { host.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STUDY_WEB_OPEN_SETTINGS', requestId: host.crypto.randomUUID(), target })); return true; }
  catch { return false; }
}
