import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/desktopPresentation.mjs').catch(() => ({}));

function fixture({maximized = false, pinned = false, bounds = {x:100,y:100,width:1100,height:800}, area = {x:0,y:0,width:1920,height:1040}} = {}) {
  let destroyed = false, minimum = [375,600];
  const window = {isDestroyed:()=>destroyed, getNormalBounds:()=>({...bounds}), getBounds:()=>({...bounds}),
    isMaximized:()=>maximized, isAlwaysOnTop:()=>pinned, getMinimumSize:()=>minimum,
    unmaximize:()=>{maximized=false;}, maximize:()=>{maximized=true;}, setAlwaysOnTop:value=>{pinned=value;},
    setBounds:value=>{bounds={...value};}, setMinimumSize:(...value)=>{minimum=value;}};
  assert.equal(typeof module.createDesktopPresentation,'function','presentation owner is available');
  const owner = module.createDesktopPresentation({window, getDisplays:()=>[{workArea:area}]});
  return {owner,window,read:()=>({bounds,maximized,pinned,minimum}),destroy:()=>{destroyed=true;}};
}

test('mini captures normal geometry once and restores maximized state without touching pin',()=>{
  const f=fixture({maximized:true,pinned:true});
  f.window.setAlwaysOnTop=()=>assert.fail('presentation must not change always-on-top');
  assert.deepEqual(f.owner.set({mode:'mini'}),{mode:'mini'});
  assert.deepEqual(f.read().bounds,{x:100,y:100,width:420,height:560});
  assert.deepEqual(f.read().minimum,[375,460]);
  assert.equal(f.read().maximized,false);
  f.owner.set({mode:'mini'}); f.owner.set({mode:'mini'});
  assert.deepEqual(f.owner.set({mode:'normal'}),{mode:'normal'});
  assert.deepEqual(f.read(),{bounds:{x:100,y:100,width:1100,height:800},maximized:true,pinned:true,minimum:[375,600]});
  f.owner.restore(); assert.equal(f.read().pinned,true);
});

test('mini and restore clamp to changed or small display work areas and cleanup is destroyed-safe',()=>{
  const f=fixture({bounds:{x:3000,y:2000,width:1100,height:800},area:{x:0,y:0,width:350,height:430}});
  f.owner.set({mode:'mini'});
  assert.deepEqual(f.read().bounds,{x:0,y:0,width:350,height:430});
  assert.deepEqual(f.read().minimum,[350,430]);
  f.owner.restore(); assert.deepEqual(f.read().bounds,{x:0,y:0,width:350,height:430});
  f.owner.set({mode:'mini'}); f.destroy();
  assert.doesNotThrow(()=>{f.owner.restore();f.owner.restore();});
});

test('failed geometry restore keeps a recoverable snapshot',()=>{
  const f=fixture();f.owner.set({mode:'mini'});
  const setBounds=f.window.setBounds;f.window.setBounds=()=>{throw Error('OS_FAILURE');};
  assert.throws(()=>f.owner.restore(),/OS_FAILURE/);assert.equal(f.owner.status().mode,'mini');
  f.window.setBounds=setBounds;f.owner.restore();assert.equal(f.owner.status().mode,'normal');
  assert.deepEqual(f.read().bounds,{x:100,y:100,width:1100,height:800});
});
