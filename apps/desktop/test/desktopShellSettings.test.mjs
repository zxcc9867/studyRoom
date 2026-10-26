import test from 'node:test';
import assert from 'node:assert/strict';
import * as settings from '../src/desktopShellSettings.mjs';

const displays=[{workArea:{x:0,y:0,width:1920,height:1080}},{workArea:{x:1920,y:0,width:1280,height:1024}}];
test('shell restores only validated bounds and clamps monitor removal/oversize inside a current work area',()=>{
  assert.equal(typeof settings.validShellSettings,'function');
  assert.deepEqual(settings.validShellSettings({bounds:{x:NaN,y:0,width:900,height:700},firstHideAcknowledged:'yes',learning:'never'}),{bounds:null,firstHideAcknowledged:false});
  assert.deepEqual(settings.restoreBounds({x:2500,y:50,width:1100,height:850},displays),{x:2100,y:50,width:1100,height:850});
  assert.deepEqual(settings.restoreBounds({x:2500,y:50,width:1100,height:850},displays.slice(0,1)),{x:820,y:50,width:1100,height:850});
  assert.deepEqual(settings.restoreBounds({x:-8000,y:9000,width:9000,height:9000},displays.slice(0,1)),{x:0,y:0,width:1920,height:1080});
});

test('shell restart persists bounded geometry and first-hide acknowledgement only; corrupt state is ignored',()=>{
  let disk='broken';const writes=[];
  const io={read:()=>disk,write:value=>{writes.push(JSON.parse(value));disk=value;}};
  const first=settings.createShellSettings(io);
  assert.deepEqual(first.read(),{bounds:null,firstHideAcknowledged:false});
  first.saveBounds({x:100,y:120,width:1200,height:800,secret:'not-persisted'});
  first.acknowledgeFirstHide();
  const restarted=settings.createShellSettings(io);
  assert.deepEqual(restarted.read(),{bounds:{x:100,y:120,width:1200,height:800},firstHideAcknowledged:true});
  assert.deepEqual(Object.keys(writes.at(-1)).sort(),['bounds','firstHideAcknowledged']);
  restarted.saveBounds({x:Infinity,y:0,width:1,height:2});
  assert.deepEqual(restarted.read().bounds,{x:100,y:120,width:1200,height:800});
});
