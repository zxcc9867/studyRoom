import { isEmbeddedStudyApp, postEmbeddedMessage } from './embeddedAuth.mjs';

export function requestNativeCameraPermission(host, timeoutMs = 120000) {
  if (!isEmbeddedStudyApp(host)) return Promise.resolve('unavailable');
  const requestId = host.crypto.randomUUID();
  return new Promise((resolve) => {
    const finish = (status) => {
      clearTimeout(timer);
      host.removeEventListener('study-room-native-message', receive);
      resolve(status);
    };
    const receive = (event) => {
      const message = event.detail;
      if (message?.type !== 'STUDY_NATIVE_CAMERA_PERMISSION' || message.requestId !== requestId) return;
      if (!['granted', 'denied', 'blocked', 'cancelled', 'unavailable'].includes(message.status)) return;
      finish(message.status);
    };
    // Older installed APKs have no preflight bridge; retain their existing OS prompt path.
    const supported = host.studyRoomNativeCameraPermission === true;
    const timer = setTimeout(() => finish('unavailable'), supported ? timeoutMs : Math.min(timeoutMs, 800));
    host.addEventListener('study-room-native-message', receive);
    postEmbeddedMessage(host, { type: 'STUDY_WEB_CAMERA_PERMISSION', requestId });
  });
}

export function openNativeAppSettings(host) {
  return postEmbeddedMessage(host, { type: 'STUDY_WEB_OPEN_APP_SETTINGS', requestId: host.crypto.randomUUID() });
}
