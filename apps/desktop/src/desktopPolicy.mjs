const DEFAULT_ORIGIN = 'https://study-room-attendance.vercel.app';
export const DESKTOP_AUTH_CALLBACK = 'studyroom-desktop://auth/callback';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keys = (value, allowed) => record(value) && Object.keys(value).length === allowed.length
  && allowed.every(key => Object.hasOwn(value, key));
const text = (value, limit = 128) => typeof value === 'string' && value.length > 0
  && value.length <= limit && !/[\x00-\x20\x7f]/.test(value);
const email = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const fail = code => { throw new Error(code); };

export function createDesktopPolicy({ origin = DEFAULT_ORIGIN } = {}) {
  const configured = new URL(origin);
  if (configured.origin !== origin || configured.username || configured.password
    || !(configured.protocol === 'https:' || (configured.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname)))) fail('INVALID_ORIGIN');

  function isTrustedUrl(value) {
    try {
      if (typeof value !== 'string' || value.length > 8192) return false;
      const url = new URL(value);
      return url.origin === origin && !url.username && !url.password;
    } catch { return false; }
  }

  function isTrustedSender(event, webContents) {
    try {
      return Boolean(webContents && event?.sender === webContents && event.senderFrame
        && event.senderFrame === webContents.mainFrame && isTrustedUrl(event.senderFrame.url)
        && isTrustedUrl(webContents.getURL()));
    } catch { return false; }
  }

  function parseRequest(value) {
    if (!keys(value, ['id', 'action', 'payload']) || !text(value.id) || !record(value.payload)) fail('BAD_REQUEST');
    const { id, action, payload } = value;
    switch (action) {
      case 'info': case 'authStatus': case 'webTicket': case 'signOut': case 'cameraConsent': case 'openCameraSettings':
        if (!keys(payload, [])) fail('BAD_REQUEST');
        break;
      case 'sendCode':
        if (!keys(payload, ['email']) || !email(payload.email)) fail('BAD_REQUEST');
        break;
      case 'verifyCode':
        if (!keys(payload, ['email', 'code']) || !email(payload.email) || !/^\d{8}$/.test(payload.code)
          || typeof payload.code !== 'string') fail('BAD_REQUEST');
        break;
      case 'signInProvider':
        if (!keys(payload, ['provider']) || !['google', 'github'].includes(payload.provider)) fail('BAD_REQUEST');
        break;
      case 'cancelQuit':
        if (!keys(payload, ['requestId']) || !text(payload.requestId)) fail('BAD_REQUEST');
        break;
      case 'studyState': {
        if (!keys(payload, ['userId', 'ready', 'session', 'cameraActive', 'operationPending', 'activity'])
          || !(payload.userId === null || text(payload.userId)) || typeof payload.ready !== 'boolean'
          || typeof payload.cameraActive !== 'boolean' || typeof payload.operationPending !== 'boolean'
          || !['studying', 'allowed', 'unknown'].includes(payload.activity)) fail('BAD_REQUEST');
        if (payload.session !== null && (!keys(payload.session, ['id', 'paused'])
          || !text(payload.session.id) || typeof payload.session.paused !== 'boolean'
          || payload.userId === null)) fail('BAD_REQUEST');
        break;
      }
      default: fail('BAD_REQUEST');
    }
    return { id, action, payload: { ...payload, ...(action === 'studyState'
      ? { session: payload.session === null ? null : { ...payload.session } } : {}) } };
  }

  function parseAuthCallback(value) {
    try {
      if (typeof value !== 'string' || value.length > 4096 || value.includes('#')) fail('INVALID_CALLBACK');
      const url = new URL(value);
      if (url.protocol !== 'studyroom-desktop:' || url.hostname !== 'auth' || url.pathname !== '/callback'
        || url.port || url.username || url.password || [...url.searchParams.keys()].length !== 1
        || !url.searchParams.has('code') || !text(url.searchParams.get('code'), 2048)) fail('INVALID_CALLBACK');
      return { code: url.searchParams.get('code') };
    } catch { fail('INVALID_CALLBACK'); }
  }

  function allowPermission(kind, details) {
    if (kind !== 'media' || !details || details.isMainFrame !== true
      || details.requestingOrigin !== origin) return false;
    const request = Object.hasOwn(details, 'mediaTypes');
    const check = Object.hasOwn(details, 'mediaType');
    if (request && (!Array.isArray(details.mediaTypes) || details.mediaTypes.length !== 1
      || details.mediaTypes[0] !== 'video')) return false;
    if (check && details.mediaType !== 'video') return false;
    return request || check;
  }

  return { isTrustedUrl, isTrustedSender, parseRequest, parseAuthCallback, allowPermission };
}
