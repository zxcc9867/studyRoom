import { createDesktopPolicy } from './desktopPolicy.mjs';
import { createDesktopLifecycle } from './desktopLifecycle.mjs';
import { restoreBounds } from './desktopShellSettings.mjs';

export const PRODUCTION_ORIGIN = 'https://study-room-attendance.vercel.app';
export const REQUEST_CHANNEL = 'study-room-desktop:request';
export const EVENT_CHANNEL = 'study-room-desktop:event';
const PUBLIC_ERRORS = new Set(['BAD_REQUEST', 'AUTH_FAILED', 'AUTH_CHANGED', 'AUTH_TIMEOUT', 'AUTH_BUSY',
  'INVALID_CALLBACK', 'STORAGE_UNAVAILABLE', 'UNTRUSTED_DOCUMENT', 'DUPLICATE_REQUEST']);
const fail = code => { throw new Error(code); };

/** Owns one native window, never the web/server study lifecycle. Electron is an OS adapter. */
export function createDesktopRuntime({ electron, auth, storage, preloadPath, iconPath, errorPath,
  origin = PRODUCTION_ORIGIN, allowDevelopmentOrigin = false, now = Date.now,
  lifecycle = createDesktopLifecycle({ now, storage }), build = '0.1.0', confirmCamera,
  schedule = setImmediate, quitProbeTimeoutMs = 5000, shellSettings }) {
  const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = electron;
  if (origin !== PRODUCTION_ORIGIN) {
    const url = new URL(origin);
    if (app.isPackaged || !allowDevelopmentOrigin || url.protocol !== 'http:'
      || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) fail('INVALID_ORIGIN');
  }
  const policy = createDesktopPolicy({ origin });
  const savedShell = shellSettings?.read();
  const bounds = restoreBounds(savedShell?.bounds, electron.screen?.getAllDisplays());
  const window = new BrowserWindow({
    ...bounds, minWidth: Math.min(375,bounds.width), minHeight: Math.min(600,bounds.height), title: '독서실', icon: iconPath,
    webPreferences: { preload: preloadPath, sandbox: true, contextIsolation: true,
      nodeIntegration: false, nodeIntegrationInSubFrames: false, webSecurity: true,
      backgroundThrottling: false, partition: 'persist:study-room-desktop', webviewTag: false,
      ...(origin !== PRODUCTION_ORIGIN ? { additionalArguments: [`--study-room-development-origin=${origin}`] } : {}) },
  });
  window.setMenuBarVisibility(false);
  const contents = window.webContents;
  let epoch = 0;
  let authGeneration = 0;
  let verified = null;
  let verification = null;
  let consent = null;
  let tray = null;
  let quitting = false;
  let disposed = false;
  let firstHide = savedShell?.firstHideAcknowledged !== true;
  let trayRecovery = false;
  let storageRecovery = false;
  let boundsTimer;
  let failed = false;
  let recoveryPending = false;
  let quitDialog = false;
  let quitIntent = null;
  let cameraDialog = false;
  let probe = null;
  let probeSequence = 0;
  let quitChecking = false;
  const requests = new Set();
  const completed = new Set();

  const trusted = () => !disposed && !contents.isDestroyed() && policy.isTrustedUrl(contents.getURL())
    && policy.isTrustedUrl(contents.mainFrame?.url);
  function guard(event, capturedEpoch) {
    if (!trusted() || epoch !== capturedEpoch || !policy.isTrustedSender(event, contents)) fail('UNTRUSTED_DOCUMENT');
  }
  function invalidate() {
    settleProbe(false);
    epoch += 1; consent = null; verified = null; verification = null; quitIntent = null;
    requests.clear(); completed.clear(); lifecycle.invalidate();
    refreshTray();
  }
  function restore() {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
  }
  function emit(value) { if (trusted()) contents.send(EVENT_CHANNEL, value); }
  function authChanged() {
    settleProbe(false);
    authGeneration += 1; verified = null; verification = null; consent = null;
    lifecycle.invalidate(); quitIntent = null; refreshTray();
    // Supabase invokes auth listeners synchronously: no SDK reads in that callback.
    schedule(() => emit({ type: 'auth-changed' }));
  }
  async function verifiedUser(force = false) {
    // Study heartbeats are local proof, not an Auth polling loop. Auth events/navigation
    // invalidate this verified identity; explicit authStatus always revalidates remotely.
    if (!force && verified) return verified.value;
    if (verification) return verification;
    const documentEpoch = epoch;
    const operation = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const generation = authGeneration;
        const value = await auth.status();
        if (documentEpoch !== epoch) fail('UNTRUSTED_DOCUMENT');
        if (generation !== authGeneration) continue;
        verified = { value, at: now() };
        return value;
      }
      fail('AUTH_CHANGED');
    })();
    verification = operation;
    try { return await operation; } finally { if (verification === operation) verification = null; }
  }
  async function openHttps(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || value.length > 8192) return;
      await shell.openExternal(url.href);
    } catch { /* Untrusted or unavailable external URLs are not rendered as native errors. */ }
  }
  function refreshTray() {
    if (!tray) return;
    const current = lifecycle.view();
    const labels = { unknown: '상태 확인 필요', 'signed-out': '로그아웃', studying: '공부 중', paused: '일시정지', idle: '대기 중' };
    const label = current.fresh && current.known ? `${labels[current.status]} · 이 PC 카메라 ${current.cameraActive ? '켜짐' : '꺼짐'}` : labels.unknown;
    tray.setToolTip(`독서실 · ${label}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `독서실 · ${label}`, enabled: false },
      { label: '독서실 열기', click: restore }, { type: 'separator' },
      { label: '독서실 종료', click: () => { void requestQuit(); } },
    ]));
  }
  function hideToTray() {
    if (!tray) { restore(); void recoverTray(); return; }
    refreshTray(); window.hide();
    if (firstHide) {
      firstHide = false;
      tray.displayBalloon?.({ title: '독서실은 계속 실행 중입니다', content: '공부와 카메라는 유지됩니다. 트레이에서 다시 열거나 종료할 수 있습니다.', iconType: 'info' });
      shellSettings?.acknowledgeFirstHide();
    }
  }
  function createTray() {
    try {
      tray = new Tray(iconPath); tray.on('double-click', restore); tray.on('click', restore);
      tray.on('right-click', refreshTray); refreshTray(); return true;
    } catch { tray?.destroy(); tray = null; return false; }
  }
  async function recoverTray() {
    if (trayRecovery || tray || disposed || quitting) return;
    trayRecovery = true; restore();
    let choice = 1;
    try {
      const result = await dialog.showMessageBox(window, {type:'warning',title:'독서실 트레이 복구',
        message:'트레이 아이콘을 만들지 못했습니다.',detail:'창을 계속 열어 둡니다. 다시 시도하거나, 현재 학습·저장 상태를 확인한 뒤 앱 종료를 선택할 수 있습니다. X는 공부를 강제 종료하지 않습니다.',
        buttons:['트레이 다시 시도','창 유지','앱 종료'],defaultId:1,cancelId:1,noLink:true});
      choice=result.response;
    } catch { /* Keep the native window visible; X can reopen recovery. */ }
    finally { trayRecovery=false; }
    if(disposed||quitting)return;
    if(choice===0&&!createTray())schedule(()=>{void recoverTray();});
    else if(choice===2)await requestQuit();
  }
  function storageFailed() {
    authChanged(); restore();
    if(storageRecovery||disposed||quitting)return;
    storageRecovery=true;
    void dialog.showMessageBox(window,{type:'warning',title:'독서실 로그인 저장소 확인',
      message:'암호화 로그인 정보를 저장하지 못했습니다.',detail:'보안을 위해 앱 로그인을 해제했습니다. 저장 상태를 확인하고 독서실에서 다시 로그인하세요. 암호화 저장소가 복구되기 전에는 로그인이 이 실행에만 유지됩니다. 학습 저장 성공을 보장하지 않습니다.',buttons:['확인']})
      .catch(()=>{}).finally(()=>{storageRecovery=false;});
  }
  function saveBounds() {
    if(disposed||window.isDestroyed()||window.isMinimized()||window.isMaximized?.())return;
    const value=window.getNormalBounds?.()??window.getBounds?.();
    if(value)shellSettings?.saveBounds(value);
  }
  const queueBounds = () => {clearTimeout(boundsTimer);boundsTimer=setTimeout(saveBounds,250);};
  const clampDisplay = () => {
    if(window.isDestroyed())return;
    const value=window.getNormalBounds?.()??window.getBounds?.();
    if(value){window.setBounds?.(restoreBounds(value,electron.screen?.getAllDisplays()));saveBounds();}
  };
  window.on('move',queueBounds);window.on('resize',queueBounds);
  electron.screen?.on('display-removed',clampDisplay);electron.screen?.on('display-metrics-changed',clampDisplay);
  function finishQuit() {
    if (quitting) return;
    quitting = true; auth.dispose(); app.quit();
  }
  async function loadProduction() {
    failed = false; invalidate();
    try { await window.loadURL(origin); } catch { void recover(); }
  }
  async function recover() {
    if (recoveryPending || disposed || quitting) return;
    recoveryPending = true; failed = true; invalidate(); restore();
    try {
      const result = await dialog.showMessageBox(window, { type: 'warning', title: '독서실 연결 확인',
        message: '화면을 사용할 수 없습니다.', detail: '학습 종료나 서버 저장 완료를 확인하지 못했습니다. 다시 연결하거나 취소할 수 있습니다. 종료는 트레이 메뉴에서 선택하세요.',
        buttons: ['다시 연결', '취소'], defaultId: 0, cancelId: 1 });
      if (disposed || quitting) return;
      if (result.response === 0) { recoveryPending = false; await loadProduction(); }
      else { await window.loadFile(errorPath).catch(() => {}); }
    } finally { recoveryPending = false; }
  }
  async function requestQuit() {
    if (quitting || disposed || quitDialog || quitChecking) return;
    quitChecking = true;
    refreshTray();
    const observed = trusted() && await requestCurrentState();
    quitChecking = false;
    if (disposed || quitting) return;
    const validProof = observed && observed.epoch === epoch && observed.authGeneration === authGeneration;
    // A later unrelated idle heartbeat may not upgrade a matching pending proof.
    // Conversely, a newly pending operation must downgrade a safe probe before exit.
    let decision = { action: 'blocked' };
    if (validProof) {
      decision = observed.decision;
      if (decision.action === 'quit') decision = lifecycle.requestQuit();
    }
    if (decision.action === 'quit') { finishQuit(); return; }
    restore();
    if (decision.action === 'request-web' && trusted()) {
      quitIntent = { epoch, requestId: decision.requestId };
      emit({ type: 'quit-requested', requestId: decision.requestId, ...observed.context });
      return;
    }
    quitDialog = true;
    let retryQuit = false;
    try {
      const result = await dialog.showMessageBox(window, { type: 'warning', title: '종료 상태 확인 필요',
        message: '학습 종료·저장 상태를 확인할 수 없습니다.',
        detail: '프로세스만 종료하면 카메라와 이 PC의 실행은 중단되지만 서버 학습 종료·저장 성공을 보장하지 않습니다. 다른 기기의 공부를 종료하지 않습니다. 기존 서버 복구 정책이 적용됩니다.',
        buttons: ['다시 확인', '취소', '프로세스만 종료'], defaultId: 1, cancelId: 1, noLink: true });
      if (disposed || quitting) return;
      if (result.response === 2) finishQuit();
      else if (result.response === 0) {
        if (failed) await loadProduction();
        else retryQuit = true;
      }
    } finally { quitDialog = false; }
    if (retryQuit) schedule(() => { void requestQuit(); });
  }
  function settleProbe(accepted) {
    if (!probe) return;
    const current = probe; probe = null;
    clearTimeout(current.timer); current.resolve(accepted);
  }
  function requestCurrentState() {
    return new Promise(resolve => {
      const requestId = `quit-state-${++probeSequence}`;
      probe = { requestId, epoch, authGeneration, resolve,
        timer: setTimeout(() => settleProbe(false), quitProbeTimeoutMs) };
      emit({ type: 'state-requested', requestId });
    });
  }
  function allowPermission(owner, kind, requestingOrigin, details) {
    const permissionOrigin = canonicalPermissionOrigin(requestingOrigin);
    const currentMainDocument = owner === contents && trusted() && permissionOrigin === origin
      && details?.isMainFrame === true && policy.isTrustedUrl(details.requestingUrl)
      && (details.securityOrigin === undefined || canonicalPermissionOrigin(details.securityOrigin) === origin);
    if (kind === 'clipboard-sanitized-write') {
      return Boolean(currentMainDocument && window.isVisible() && window.isFocused());
    }
    return Boolean(currentMainDocument && consent && consent.epoch === epoch
      && consent.frame === contents.mainFrame
      && policy.allowPermission(kind, { ...details, requestingOrigin: permissionOrigin }));
  }
  function canonicalPermissionOrigin(value) {
    try {
      if (typeof value !== 'string' || !value || value.length > 8192 || /[\x00-\x20\x7f]/.test(value)
        || !/^[a-z][a-z\d+.-]*:\/\/[^/\\?#]+\/?$/i.test(value)) return null;
      const url = new URL(value);
      if (url.username || url.password || url.pathname !== '/' || url.origin === 'null') return null;
      return url.origin;
    } catch { return null; }
  }
  contents.session.setPermissionCheckHandler((owner, kind, requestingOrigin, details) => allowPermission(owner, kind, requestingOrigin, details));
  contents.session.setPermissionRequestHandler((owner, kind, callback, details) => {
    let requestingOrigin = '';
    try { requestingOrigin = new URL(details?.requestingUrl).origin; } catch { /* deny */ }
    callback(allowPermission(owner, kind, requestingOrigin, details));
  });
  contents.session.setDisplayMediaRequestHandler((_request, callback) => callback({}));

  ipcMain.handle(REQUEST_CHANNEL, async (event, input) => {
    const capturedEpoch = epoch;
    const capturedAuth = authGeneration;
    let request;
    let ownsRequest = false;
    try {
      guard(event, capturedEpoch);
      request = policy.parseRequest(input);
      if (requests.has(request.id) || completed.has(request.id)) fail('DUPLICATE_REQUEST');
      requests.add(request.id); ownsRequest = true;
      const { action, payload, id } = request;
      let value;
      switch (action) {
        case 'info': value = { platform: 'windows', version: app.getVersion(), build, protocolVersion: 1, secureStorage: storage.secure }; break;
        case 'authStatus': value = await verifiedUser(true); break;
        case 'sendCode': value = await auth.sendCode(payload.email); break;
        case 'verifyCode': value = await auth.verifyCode(payload.email, payload.code); break;
        case 'signInProvider': value = await auth.signInProvider(payload.provider); break;
        case 'webTicket':
          value = await auth.webTicket(id);
          if (capturedAuth !== authGeneration) fail('AUTH_CHANGED');
          break;
        case 'signOut': authChanged(); value = await auth.signOut(); break;
        case 'openCameraSettings': await shell.openExternal('ms-settings:privacy-webcam'); value = { opened: true }; break;
        case 'cameraConsent': {
          if (cameraDialog) fail('AUTH_BUSY');
          cameraDialog = true;
          let allowed;
          try { allowed = confirmCamera ? await confirmCamera() : (await dialog.showMessageBox(window, {
            type: 'question', title: '카메라 사용', message: '공부 착석 확인에 카메라를 사용하시겠습니까?',
            detail: '기존 독서실의 착석 확인을 위해 이 창에서 영상만 사용합니다. 마이크와 화면 공유는 허용하지 않습니다. X로 숨겨도 카메라는 계속 동작합니다.',
            buttons: ['카메라 사용', '취소'], defaultId: 1, cancelId: 1,
          })).response === 0; } finally { cameraDialog = false; }
          guard(event, capturedEpoch);
          if (capturedAuth !== authGeneration) fail('AUTH_CHANGED');
          consent = allowed ? { epoch, frame: contents.mainFrame } : null;
          value = { allowed: Boolean(allowed) }; break;
        }
        case 'studyState': {
          const identity = await verifiedUser();
          guard(event, capturedEpoch);
          if (capturedAuth !== authGeneration || identity.userId !== payload.userId) fail('AUTH_CHANGED');
          value = lifecycle.update(payload); refreshTray();
          if (probe?.requestId === id && probe.epoch === epoch && probe.authGeneration === authGeneration) {
            const context = Object.freeze({ userId: payload.userId, sessionId: payload.session?.id ?? null,
              localEngagement: lifecycle.view().localEngagement });
            settleProbe({ epoch, authGeneration, decision: lifecycle.requestQuit(), context });
          }
          break;
        }
        case 'cancelQuit':
          if (!lifecycle.cancelQuit(payload.requestId)) fail('BAD_REQUEST');
          quitIntent = null; value = { cancelled: true }; break;
        default: fail('BAD_REQUEST');
      }
      guard(event, capturedEpoch);
      if (action === 'studyState' && quitIntent?.epoch === epoch && lifecycle.requestQuit().action === 'quit') finishQuit();
      return { id, ok: true, value };
    } catch (error) {
      return { id: request?.id ?? (typeof input?.id === 'string' && input.id.length <= 128 ? input.id : ''), ok: false,
        error: PUBLIC_ERRORS.has(error?.message) ? error.message : 'INTERNAL_ERROR' };
    } finally {
      if (ownsRequest && epoch === capturedEpoch) {
        requests.delete(request.id); completed.add(request.id);
        if (completed.size > 256) completed.delete(completed.values().next().value);
      }
    }
  });
  contents.on('did-start-navigation', (details, _url, isInPlace, isMainFrame) => {
    const main = details.isMainFrame ?? isMainFrame;
    const same = details.isSameDocument ?? isInPlace;
    if (main && !same) invalidate();
  });
  const navigation = (event, url) => {
    const target = event.url ?? url;
    if (!policy.isTrustedUrl(target)) { event.preventDefault(); void openHttps(target); }
  };
  contents.on('will-navigate', navigation);
  contents.on('will-redirect', navigation);
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (policy.isTrustedUrl(url)) { void window.loadURL(url).catch(() => recover()); }
    else void openHttps(url);
    return { action: 'deny' };
  });
  contents.on('render-process-gone', () => { void recover(); });
  contents.on('did-fail-load', (_event, code, _description, _url, main) => {
    if (main && code !== -3) void recover();
  });
  window.on('close', event => { saveBounds(); if (!quitting) { event.preventDefault(); hideToTray(); } });
  const secondInstance = (_event, argv) => {
    restore();
    const callback = argv?.find(value => typeof value === 'string' && value.startsWith('studyroom-desktop:'));
    if (callback) void handleCallback(callback);
  };
  const activate = () => restore();
  const beforeQuit = event => { if (!quitting) { event.preventDefault(); void requestQuit(); } };
  const openUrl = (event, value) => { event.preventDefault(); void handleCallback(value); };
  app.on('second-instance', secondInstance); app.on('activate', activate);
  app.on('before-quit', beforeQuit); app.on('open-url', openUrl);
  async function handleCallback(value) {
    restore();
    try { policy.parseAuthCallback(value); await auth.handleCallback(value); authChanged(); }
    catch { await dialog.showMessageBox(window, { type: 'warning', message: '로그인을 완료하지 못했습니다.',
      detail: '독서실에서 로그인을 다시 시작하세요. 시간이 초과된 경우 앱을 다시 실행해야 할 수 있습니다.', buttons: ['확인'] }); }
  }
  if(!createTray())schedule(()=>recoverTray());
  const trayClock = setInterval(refreshTray, 5000);
  trayClock.unref?.();
  void window.loadURL(origin).catch(() => recover());
  return {
    window, requestQuit, restore, authChanged, handleCallback, storageFailed,
    dispose() {
      clearTimeout(boundsTimer);saveBounds();
      disposed = true; invalidate(); auth.dispose(); tray?.destroy(); ipcMain.removeHandler(REQUEST_CHANNEL);
      clearInterval(trayClock);
      app.removeListener('second-instance', secondInstance); app.removeListener('activate', activate);
      app.removeListener('before-quit', beforeQuit); app.removeListener('open-url', openUrl);
      electron.screen?.removeListener('display-removed',clampDisplay);electron.screen?.removeListener('display-metrics-changed',clampDisplay);
      contents.session.setPermissionCheckHandler(() => false);
      contents.session.setPermissionRequestHandler((_wc, _kind, callback) => callback(false));
    },
  };
}
