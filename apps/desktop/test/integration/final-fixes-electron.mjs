import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const {_electron}=await import(pathToFileURL(process.env.STUDY_ROOM_PLAYWRIGHT_MODULE||'C:/Users/zxcc9/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const output=path.join(root,'output/windows-electron-acceptance','final-fixes-'+randomUUID());
const html=`<!doctype html><title>Final synthetic continuity</title><script>
window.token=crypto.randomUUID();window.events=[];window.respond=true;window.currentState={userId:null,ready:true,session:null,cameraActive:false,operationPending:false,activity:'allowed'};
studyRoomDesktop.onEvent(event=>{events.push(event);if(event.type==='state-requested'&&respond)void studyRoomDesktop.request({id:event.requestId,action:'studyState',payload:currentState});});
</script>`;
async function launch(t,{userData=path.join(output,randomUUID()),failTray=false}={}){
  await mkdir(userData,{recursive:true});
  const server=createServer((_request,response)=>{response.setHeader('content-type','text/html');response.end(html);});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  let app,closed=false,cleanupPromise;
  const cleanup=()=>cleanupPromise??=(async()=>{
    if(app&&!closed){await app.evaluate(async()=>{await finalFix.cleanup();}).catch(()=>{});await app.close().catch(()=>{});}
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  })();
  t.after(cleanup);
  const env={...process.env,STUDY_ROOM_FINAL_DATA:userData,STUDY_ROOM_FINAL_ORIGIN:`http://127.0.0.1:${server.address().port}`,STUDY_ROOM_FINAL_TRAY_FAIL:failTray?'1':'0'};
  delete env.ELECTRON_RUN_AS_NODE;
  try{app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[fileURLToPath(new URL('./fixtures/final-fix-main.cjs',import.meta.url))],env,timeout:30000});}
  catch(error){await cleanup();throw error;}
  app.on('close',()=>{closed=true;});
  const page=await app.firstWindow();await page.waitForFunction(()=>typeof token==='string');
  await app.evaluate(()=>Boolean(finalFix.runtime));
  return {app,page,userData,cleanup,closed:()=>closed};
}
test('actual Electron owns SDK automatic-refresh failure with same process/window/document and visible recovery', {timeout:45000},async t=>{
  const f=await launch(t);const identity=await f.app.evaluate(()=>({id:finalFix.runtime.window.id,contents:finalFix.runtime.window.webContents.id,pid:process.pid}));
  const token=await f.page.evaluate(()=>window.token);
  const result=await f.app.evaluate(async()=>finalFix.degrade());
  assert.deepEqual(result,{secure:false,identity:{userId:null},cleaned:true,refreshes:1});
  assert.equal(f.closed(),false);assert.equal(await f.page.evaluate(()=>window.token),token);
  assert.deepEqual(await f.app.evaluate(()=>({id:finalFix.runtime.window.id,contents:finalFix.runtime.window.webContents.id,pid:process.pid})),identity);
  assert.equal(await f.app.evaluate(()=>finalFix.runtime.window.isVisible()),true);
  assert.ok(await f.app.evaluate(()=>finalFix.observations.dialogs.some(d=>d.title==='독서실 로그인 저장소 확인')));
  console.log('FINAL_ELECTRON_AUTH '+JSON.stringify({...identity,...result,sameDocument:true,visible:true}));
});
test('actual Electron failed tray recovery/cancel/safe quit preserves document; shell bounds and notice persist on restart',{timeout:60000},async t=>{
  const f=await launch(t,{failTray:true});const token=await f.page.evaluate(()=>window.token);
  await f.page.evaluate(()=>{window.respond=false;});
  await f.app.evaluate(()=>{finalFix.observations.responses.push(2,1);finalFix.runtime.window.close();});
  // Unknown -> warned process-only dialog -> Cancel, no process/window destruction.
  await f.page.waitForTimeout(180);assert.equal(f.closed(),false);
  assert.ok(await f.app.evaluate(()=>finalFix.observations.dialogs.some(d=>d.title==='종료 상태 확인 필요')));
  await f.page.evaluate(()=>{window.respond=true;});
  await f.app.evaluate(()=>{finalFix.observations.failTray=false;finalFix.observations.responses.push(0);finalFix.runtime.window.close();});
  await f.page.waitForTimeout(100);
  assert.equal(await f.app.evaluate(()=>finalFix.observations.trayAttempts),2);
  await f.app.evaluate(()=>{finalFix.runtime.window.setBounds({x:60,y:70,width:1000,height:800});finalFix.runtime.window.close();});
  assert.equal(await f.app.evaluate(()=>finalFix.runtime.window.isVisible()),false);
  assert.equal(await f.page.evaluate(()=>window.token),token);
  assert.equal(await f.app.evaluate(()=>finalFix.observations.balloons),1);
  await f.cleanup();
  const restarted=await launch(t,{userData:f.userData,failTray:true});
  const bounds=await restarted.app.evaluate(()=>finalFix.runtime.window.getBounds());
  assert.equal(bounds.width,1000);assert.equal(bounds.height,800);
  await restarted.app.evaluate(()=>{finalFix.observations.failTray=false;finalFix.observations.responses.push(0);finalFix.runtime.window.close();});
  await restarted.page.waitForTimeout(100);await restarted.app.evaluate(()=>finalFix.runtime.window.close());
  assert.equal(await restarted.app.evaluate(()=>finalFix.observations.balloons),0);
  await restarted.cleanup();
  const quitting=await launch(t,{failTray:true});
  await quitting.page.evaluate(()=>studyRoomDesktop.request({id:'prime-native',action:'authStatus',payload:{}}));
  const close=once(quitting.app,'close');
  await quitting.app.evaluate(()=>{finalFix.observations.responses.push(2);finalFix.runtime.window.close();});
  await Promise.race([close,new Promise((_,reject)=>setTimeout(()=>reject(Error('SAFE_QUIT_TIMEOUT')),5000))]);
  console.log('FINAL_ELECTRON_SHELL '+JSON.stringify({sameDocument:true,bounds,firstNotice:1,restartNotice:0,safeQuit:true}));
});
