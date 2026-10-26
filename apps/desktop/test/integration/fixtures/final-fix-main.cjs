'use strict';
// Synthetic-only, isolated Electron entry: no protocol registration, real HTTP Auth or real userData.
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const electron=require('electron');
const {createStorageIO}=require('../../../main.cjs');
const root=path.resolve(__dirname,'../../../../..');
const allowed=path.join(root,'output','windows-electron-acceptance');
const userData=path.resolve(process.env.STUDY_ROOM_FINAL_DATA||'');
if(!userData.startsWith(allowed+path.sep))throw Error('UNSAFE_TEST_USER_DATA');
const origin=process.env.STUDY_ROOM_FINAL_ORIGIN;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin||''))throw Error('UNSAFE_TEST_ORIGIN');
electron.app.setPath('userData',userData);
// A rejection is a hard failing process exit, never a suppressor/SDK-deferred observer.
process.on('unhandledRejection',()=>electron.app.exit(91));
electron.app.whenReady().then(async()=>{
  const load=name=>import(pathToFileURL(path.join(root,'apps/desktop/src',name)).href);
  const [{createClient},{createEncryptedStorage,createSdkStorage},{createDesktopAuth},{createDesktopRuntime},{createShellSettings}]=await Promise.all([
    import('@supabase/supabase-js'),load('desktopStorage.mjs'),load('desktopAuth.mjs'),load('desktopRuntime.mjs'),load('desktopShellSettings.mjs')]);
  const io=createStorageIO(path.join(userData,'encrypted-auth'));
  let failWrite=false,auth,runtime;
  const storage=createEncryptedStorage({safeStorage:electron.safeStorage,...io,write:async(key,value)=>{
    if(failWrite&&key==='sb-final-auth-token'){failWrite=false;throw Error('synthetic atomic write unavailable');}await io.write(key,value);
  }});
  const observations={refreshes:0,dialogs:[],trayAttempts:0,balloons:0,responses:[1],failTray:process.env.STUDY_ROOM_FINAL_TRAY_FAIL==='1'};
  const user={id:'synthetic-final-user',aud:'authenticated',role:'authenticated',email:'fixture@synthetic.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const syntheticSession=()=>({access_token:Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic',refresh_token:'synthetic-final-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user});
  const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
  const sdk=createClient('https://final-refresh.synthetic.invalid','sb_publishable_synthetic_test_only',{
    global:{fetch:async(input,init={})=>{
      const url=new URL(String(input));if(url.origin!=='https://final-refresh.synthetic.invalid')throw Error('UNEXPECTED_TRANSPORT');
      if(url.pathname==='/auth/v1/verify')return json(syntheticSession());
      if(url.pathname==='/auth/v1/token'){observations.refreshes++;return json(syntheticSession());}
      if(url.pathname==='/auth/v1/user')return json(user);
      if(url.pathname==='/auth/v1/logout'){if(url.searchParams.get('scope')!=='local')throw Error('NONLOCAL_LOGOUT');return new Response(null,{status:204});}
      throw Error('UNEXPECTED_ENDPOINT');
    }},auth:{storage:createSdkStorage({storage,onFailure:()=>{auth?.storageFailed();runtime?.storageFailed();}}),storageKey:'sb-final-auth-token',persistSession:true,detectSessionInUrl:false,autoRefreshToken:false,flowType:'pkce'}});
  auth=createDesktopAuth({supabase:sdk,storage,openExternal:async()=>{throw Error('NO_EXTERNAL_AUTH');},onChange:()=>runtime?.authChanged()});
  const shellPath=path.join(userData,'shell-settings.json');
  const shellSettings=createShellSettings({read:()=>fs.readFileSync(shellPath,'utf8'),write:value=>fs.writeFileSync(shellPath,value)});
  function Tray(...args){observations.trayAttempts++;if(observations.failTray)throw Error('synthetic tray unavailable');const tray=new electron.Tray(...args);tray.displayBalloon=()=>{observations.balloons++;};return tray;}
  runtime=createDesktopRuntime({electron:{...electron,Tray,dialog:{showMessageBox:async(...args)=>{
    const options=args.at(-1);observations.dialogs.push({title:options.title,buttons:options.buttons});return {response:observations.responses.shift()??1};
  }}},auth,storage,shellSettings,origin,allowDevelopmentOrigin:true,quitProbeTimeoutMs:100,
    preloadPath:path.join(root,'apps/desktop/preload.cjs'),iconPath:path.join(root,'apps/desktop/resources/study-room-icon.png'),errorPath:path.join(root,'apps/desktop/error.html')});
  globalThis.finalFix={runtime,observations,shellSettings,
    async degrade(){
      await auth.verifyCode('fixture@synthetic.invalid','12345678');
      const session=JSON.parse(await storage.getItem('sb-final-auth-token'));session.expires_at=Math.floor(Date.now()/1000)+30;
      await storage.setItem('sb-final-auth-token',JSON.stringify(session));
      runtime.window.close();failWrite=true;await sdk.auth.startAutoRefresh();
      const deadline=Date.now()+3000;
      while((storage.secure||await io.read('sb-final-auth-token')!==null)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
      return {secure:storage.secure,identity:await auth.status(),cleaned:await io.read('sb-final-auth-token')===null,refreshes:observations.refreshes};
    },async cleanup(){runtime.dispose();await sdk.auth.stopAutoRefresh();for(const window of electron.BrowserWindow.getAllWindows())window.destroy();}
  };
}).catch(()=>electron.app.exit(92));
