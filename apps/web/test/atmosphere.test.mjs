import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

let createAtmosphereController;
try { ({createAtmosphereController}=await import('../src/atmosphere.mjs')); } catch {}

function environment(saved=null) {
 const values=new Map(saved===null?[]:[['study-room-atmosphere',saved]]),handlers={},root={dataset:{},style:{setProperty(key,value){this[key]=value;}}},flags={denied:false,focused:true};
 const storage={getItem:key=>{if(flags.denied)throw Error('denied');return values.get(key)??null;},setItem:(key,value)=>{if(flags.denied)throw Error('denied');values.set(key,value);}};
 const reduced={matches:false,addEventListener:(_,fn)=>handlers.reduced=fn};
 const document={documentElement:root,visibilityState:'visible',hasFocus:()=>flags.focused,addEventListener:(_,fn)=>handlers.visibility=fn};
 const host={localStorage:storage,document,matchMedia:()=>reduced,addEventListener:(type,fn)=>handlers[type]=fn};
 return {host,root,values,flags,reduced(value){reduced.matches=value;handlers.reduced();},hidden(value){document.visibilityState=value?'hidden':'visible';handlers.visibility();},focus(value){flags.focused=value;handlers[value?'focus':'blur']?.();},external(value){handlers.storage({key:'study-room-atmosphere',newValue:value,storageArea:storage});}};
}
function controller(e){assert.equal(typeof createAtmosphereController,'function','atmosphere controller must exist');return createAtmosphereController(e.host);}

test('atmosphere persists only a validated device-local background and does not change brightness or study keys',()=>{
 const e=environment();e.values.set('study-room-appearance','light');e.values.set('study-session','unchanged');const c=controller(e);
 assert.equal(c.getSnapshot().background,'charcoal');assert.equal(e.root.dataset.studyMotion,'static');
 c.setPreferences({background:'star-sea',motion:'live',intensity:'normal'});
 assert.equal(e.root.dataset.studyBackground,'star-sea');assert.equal(e.root.dataset.studyMotion,'playing');
 assert.deepEqual(JSON.parse(e.values.get('study-room-atmosphere')),{background:'star-sea',motion:'live',intensity:'normal',paused:false});
 assert.equal(e.values.get('study-room-appearance'),'light');assert.equal(e.values.get('study-session'),'unchanged');
 assert.equal(controller(environment(e.values.get('study-room-atmosphere'))).getSnapshot().background,'star-sea');
});

test('atmosphere pauses only decorative motion for reduced motion and hidden windows, then resumes the selected live theme',()=>{
 const e=environment(),c=controller(e);c.setPreferences({background:'rain-library',motion:'live',intensity:'subtle'});
 assert.equal(c.getSnapshot().playing,true);e.hidden(true);assert.equal(c.getSnapshot().playing,false);assert.equal(e.root.dataset.studyMotion,'paused');
 e.reduced(true);e.hidden(false);assert.equal(c.getSnapshot().playing,false);assert.equal(c.getSnapshot().motion,'live');
 e.reduced(false);assert.equal(c.getSnapshot().playing,true);
 c.setPreferences({background:'dawn-city',motion:'live',intensity:'subtle'});assert.equal(c.getSnapshot().motion,'static');assert.equal(c.getSnapshot().playing,false);
});

test('atmosphere rejects arbitrary URLs, malformed JSON and unsupported values',()=>{
 for(const saved of ['broken','null','[]','{"background":"https://attacker.test/x","motion":"live","intensity":"wild"}']){
  const e=environment(saved),c=controller(e);assert.equal(c.getSnapshot().background,'charcoal');assert.equal(c.getSnapshot().motion,'static');assert.equal(c.getSnapshot().intensity,'subtle');
 }
 const e=environment(),c=controller(e);c.setPreferences({background:'rain-library',motion:'live',intensity:'normal'});e.external('{"background":"sunset-sky","motion":"live"}');
 assert.equal(c.getSnapshot().background,'sunset-sky');assert.equal(c.getSnapshot().motion,'static');
 e.external(null);assert.equal(c.getSnapshot().background,'charcoal');
});

test('atmosphere keeps current selection on storage failure and reports recovery without notifying unchanged state',()=>{
 const e=environment(),c=controller(e);let changes=0;const stop=c.subscribe(()=>changes++);e.hidden(false);assert.equal(changes,0);
 e.flags.denied=true;c.setPreferences({background:'rain-library',motion:'live',intensity:'subtle'});assert.equal(c.getSnapshot().background,'rain-library');assert.equal(c.getSnapshot().persistent,false);
 e.flags.denied=false;c.setPreferences({background:'rain-library',motion:'live',intensity:'subtle'});assert.equal(c.getSnapshot().persistent,true);assert.equal(changes,2);
 stop();e.hidden(true);assert.equal(changes,2);
});

test('prepaint applies the same safe background, motion default and charcoal brightness before React mounts',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 for(const [saved,want] of [['{"background":"rain-library","motion":"live","intensity":"normal"}','rain-library'],['{"background":"url(https://bad.test)"}','charcoal']]){
  const root={dataset:{},style:{setProperty(key,value){this[key]=value;}}},meta={};
  vm.runInNewContext(scripts.join('\n'),{localStorage:{getItem:key=>key==='study-room-appearance'?'dark':saved},matchMedia:()=>({matches:false}),document:{documentElement:root,querySelector:()=>({setAttribute:(k,v)=>meta[k]=v})}});
  assert.equal(root.dataset.studyBackground,want);assert.equal(root.dataset.studyMotion,'static');assert.equal(meta.content,'#111318');
 }
});

test('explicit live pause persists without discarding the selected live mode and survives window visibility changes',()=>{
 const e=environment(),c=controller(e);c.setPreferences({background:'star-sea',motion:'live',intensity:'subtle',paused:true});
 assert.equal(c.getSnapshot().playing,false);assert.equal(c.getSnapshot().motion,'live');
 e.hidden(true);e.hidden(false);assert.equal(c.getSnapshot().playing,false);
 assert.equal(controller(environment(e.values.get('study-room-atmosphere'))).getSnapshot().playing,false);
 c.setPreferences({...c.getSnapshot(),paused:false});assert.equal(c.getSnapshot().playing,true);
});

test('a real saved preference received from another tab clears an earlier local write failure',()=>{
 const e=environment(),c=controller(e);e.flags.denied=true;c.setPreferences({background:'star-sea',motion:'live',intensity:'subtle'});
 assert.equal(c.getSnapshot().persistent,false);e.flags.denied=false;
 const saved='{"background":"rain-library","motion":"static","intensity":"subtle"}';e.values.set('study-room-atmosphere',saved);e.external(saved);
 assert.equal(c.getSnapshot().background,'rain-library');assert.equal(c.getSnapshot().persistent,true);
});

test('unfocused desktop windows pause decoration even when native background study keeps document visible',()=>{
 const e=environment(),c=controller(e);c.setPreferences({background:'rain-library',motion:'live',intensity:'subtle'});
 e.focus(false);assert.equal(e.host.document.visibilityState,'visible');assert.equal(c.getSnapshot().playing,false);
 e.focus(true);assert.equal(c.getSnapshot().playing,true);assert.equal(c.getSnapshot().motion,'live');
});
