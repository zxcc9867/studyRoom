'use strict';
// Isolated acceptance entrypoint: never registers the installed protocol or contacts Auth.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const electron = require('electron');
const { createStorageIO } = require('../../../main.cjs');
const { app } = electron;
const root = path.resolve(__dirname, '../../../../..');
const allowed = path.join(root, 'output', 'windows-electron-acceptance');
const userData = path.resolve(process.env.STUDY_ROOM_TEST_USER_DATA || '');
if (!userData.startsWith(allowed + path.sep) || userData === allowed) throw Error('UNSAFE_TEST_USER_DATA');
const origin = process.env.STUDY_ROOM_TEST_ORIGIN;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '')) throw Error('UNSAFE_TEST_ORIGIN');
app.setPath('userData', userData);
app.setName('StudyRoom isolated acceptance');

app.whenReady().then(async () => {
  const load = name => import(pathToFileURL(path.join(root, 'apps/desktop/src', name)).href);
  const [{ createDesktopRuntime }, { createEncryptedStorage }, { createDesktopAuth }, { createDesktopLifecycle }] = await Promise.all([
    load('desktopRuntime.mjs'), load('desktopStorage.mjs'), load('desktopAuth.mjs'), load('desktopLifecycle.mjs'),
  ]);
  const storage = createEncryptedStorage({ safeStorage: electron.safeStorage,
    ...createStorageIO(path.join(userData, 'encrypted-auth')) });
  const observations = { dialogs: [], external: [], tray: null, authReads: 0, ipc: [] };
  const permissionSession = electron.session.fromPartition('persist:study-room-desktop');
  const setCheck = permissionSession.setPermissionCheckHandler.bind(permissionSession);
  permissionSession.setPermissionCheckHandler = handler => setCheck((owner, kind, requestingOrigin, details) => {
    const allowed = handler(owner, kind, requestingOrigin, details);
    (observations.permissions ||= []).push({ phase: 'check', kind, requestingOrigin, details, allowed });
    return allowed;
  });
  const setRequest = permissionSession.setPermissionRequestHandler.bind(permissionSession);
  permissionSession.setPermissionRequestHandler = handler => setRequest((owner, kind, callback, details) => {
    handler(owner, kind, allowed => {
      (observations.permissions ||= []).push({ phase: 'request', kind, details, allowed }); callback(allowed);
    }, details);
  });
  let runtime;
  const auth = createDesktopAuth({ storage, supabase: { auth: {
    getUser: async () => { observations.authReads++; return { data: { user: { id: 'synthetic-windows-user' } }, error: null }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } }, openExternal: async url => observations.external.push(url), onChange: () => runtime?.authChanged() });
  const lifecycle = createDesktopLifecycle({ storage });
  function ObservedTray(...args) {
    try {
      const tray = new electron.Tray(...args);
      observations.tray = tray;
      const setContextMenu = tray.setContextMenu.bind(tray);
      tray.setContextMenu = menu => { observations.menu = menu; return setContextMenu(menu); };
      // Avoid desktop notifications, without replacing tray/menu/window behavior.
      tray.displayBalloon = () => { observations.balloons = (observations.balloons || 0) + 1; };
      return tray;
    } catch (error) { observations.trayError = error.message; throw error; }
  }
  const adapter = { ...electron, Tray: ObservedTray,
    ...(process.env.STUDY_ROOM_TEST_ADVERSARIAL_SUBFRAME === '1' ? {
      BrowserWindow: function AdversarialWindow(options) {
        return new electron.BrowserWindow({ ...options,
          webPreferences: { ...options.webPreferences, nodeIntegrationInSubFrames: true, sandbox: false,
            preload: path.join(__dirname, 'hostile-preload.cjs') } });
      },
    } : {}),
    dialog: { showMessageBox: async (_window, options) => {
      observations.dialogs.push({ title: options.title, buttons: options.buttons });
      return { response: options.title === '카메라 사용' ? 0 : 1 };
    } },
    shell: { openExternal: async url => observations.external.push(url) },
    ipcMain: { handle(channel, handler) {
      electron.ipcMain.handle(channel, (event, input) => {
        observations.ipc.push({ action: input?.action, top: event.senderFrame === event.sender.mainFrame,
          owning: event.sender === runtime?.window.webContents });
        return handler(event, input);
      });
    }, removeHandler: channel => electron.ipcMain.removeHandler(channel) },
  };
  runtime = createDesktopRuntime({ electron: adapter, auth, storage, lifecycle,
    origin, allowDevelopmentOrigin: true,
    preloadPath: path.join(root, 'apps/desktop/preload.cjs'),
    iconPath: path.join(root, 'apps/desktop/resources/study-room-icon.png'),
    errorPath: path.join(root, 'apps/desktop/error.html') });
  runtime.window.webContents.on('preload-error', (_event, preloadPath, error) => {
    (observations.preloadErrors ||= []).push({ preloadPath, message: error.message });
  });
  globalThis.acceptance = { runtime, storage, lifecycle, observations, userData,
    async foreignWindow(url) {
      const window = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true,
        contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'hostile-preload.cjs') } });
      await window.loadURL(url);
      const result = await window.webContents.executeJavaScript('window.attackRequest()');
      window.destroy();
      return result;
    },
  };
}).catch(error => { console.error(error); app.exit(1); });
