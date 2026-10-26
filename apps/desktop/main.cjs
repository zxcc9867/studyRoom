'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');

function createStorageIO(directory) {
  const filename = key => path.join(directory, createHash('sha256').update(key).digest('hex') + '.bin');
  return {
    async read(key) {
      try { return await fs.readFile(filename(key)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async write(key, ciphertext) {
      if (!Buffer.isBuffer(ciphertext)) throw Error('STORAGE_UNAVAILABLE');
      await fs.mkdir(directory, { recursive: true });
      const target = filename(key);
      const temp = target + '.' + randomUUID() + '.tmp';
      try { await fs.writeFile(temp, ciphertext, { flag: 'wx', mode: 0o600 }); await fs.rename(temp, target); }
      finally { await fs.rm(temp, { force: true }).catch(() => {}); }
    },
    async remove(key) { await fs.rm(filename(key), { force: true }); },
  };
}

function captureEarlyCallbacks(app) {
  const callbacks = [];
  const openUrl = (event, url) => { event.preventDefault(); callbacks.push(url); };
  const secondInstance = (_event, argv) => {
    const url = argv?.find(value => typeof value === 'string' && value.startsWith('studyroom-desktop:'));
    if (url) callbacks.push(url);
  };
  app.on('open-url', openUrl); app.on('second-instance', secondInstance);
  return { consume() {
    app.removeListener('open-url', openUrl); app.removeListener('second-instance', secondInstance);
    return callbacks.splice(0);
  } };
}

async function bootstrap() {
  const electron = require('electron');
  const { app, dialog } = electron;
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.setName('독서실');
  app.setAppUserModelId('app.studyroom.desktop');
  const argv = process.argv.slice(1);
  // Test/development controls are read only in an unpackaged app; production cannot override its origin or data root.
  const option = name => !app.isPackaged ? argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) : undefined;
  const userData = option('desktop-user-data');
  if (userData) app.setPath('userData', path.resolve(userData));
  if (app.isPackaged) app.setAsDefaultProtocolClient('studyroom-desktop');
  else app.setAsDefaultProtocolClient('studyroom-desktop', process.execPath, [path.resolve(__dirname)]);
  const earlyCallbacks = captureEarlyCallbacks(app);
  await app.whenReady();
  try {
    const [{ createClient }, { createEncryptedStorage, createSdkStorage }, { createDesktopAuth }, { createDesktopRuntime }, { publicConfig }, { createShellSettings }] = await Promise.all([
      import('@supabase/supabase-js'), import('./src/desktopStorage.mjs'), import('./src/desktopAuth.mjs'),
      import('./src/desktopRuntime.mjs'), import('./scripts/prepare.mjs'),
      import('./src/desktopShellSettings.mjs'),
    ]);
    const resources = path.join(__dirname, 'resources');
    const input = JSON.parse(await fs.readFile(path.join(resources, 'public-config.json'), 'utf8'));
    const config = publicConfig({ VITE_SUPABASE_URL: input.supabaseUrl, VITE_SUPABASE_ANON_KEY: input.supabaseAnonKey });
    const storage = createEncryptedStorage({ safeStorage: electron.safeStorage,
      ...createStorageIO(path.join(app.getPath('userData'), 'encrypted-auth')) });
    let auth, runtime;
    const sdkStorage = createSdkStorage({ storage, onFailure: () => { auth?.storageFailed(); runtime?.storageFailed(); } });
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: {
      storage: sdkStorage, flowType: 'pkce', persistSession: true, detectSessionInUrl: false, autoRefreshToken: true,
    } });
    auth = createDesktopAuth({ supabase, storage, openExternal: url => electron.shell.openExternal(url),
      onChange: () => runtime?.authChanged() });
    const developmentOrigin = option('desktop-origin');
    const settingsPath=path.join(app.getPath('userData'),'shell-settings.json');
    const shellSettings=createShellSettings({read:()=>fsSync.readFileSync(settingsPath,'utf8'),write:value=>{
      fsSync.mkdirSync(path.dirname(settingsPath),{recursive:true});
      const temp=settingsPath+'.'+randomUUID()+'.tmp';
      try{fsSync.writeFileSync(temp,value,{flag:'wx',mode:0o600});fsSync.renameSync(temp,settingsPath);}
      finally{try{fsSync.rmSync(temp,{force:true});}catch{}}
    }});
    runtime = createDesktopRuntime({ electron, auth, storage,
      shellSettings,
      preloadPath: path.join(__dirname, 'preload.cjs'), iconPath: path.join(resources, 'study-room-icon.png'),
      errorPath: path.join(__dirname, 'error.html'), build: '0.1.0',
      ...(developmentOrigin ? { origin: developmentOrigin, allowDevelopmentOrigin: true } : {}),
    });
    for (const url of [...earlyCallbacks.consume(), ...argv.filter(value => value.startsWith('studyroom-desktop:'))]) void runtime.handleCallback(url);
    app.on('will-quit', () => runtime.dispose());
  } catch {
    await dialog.showMessageBox({ type: 'error', title: '독서실 시작 실패',
      message: '앱을 시작하지 못했습니다.', detail: '공개 연결 설정 또는 설치 파일을 확인하고 다시 실행하세요. 인증 정보는 로그에 기록하지 않습니다.', buttons: ['닫기'] });
    app.exit(1);
  }
}

module.exports = { createStorageIO, captureEarlyCallbacks, bootstrap };
if (require.main === module) void bootstrap();
