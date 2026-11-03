import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

let createAtmosphereController, atmosphereVideoSource, atmosphereThemes;
try { ({createAtmosphereController, atmosphereVideoSource, atmosphereThemes}=await import('../src/atmosphere.mjs')); } catch {}

function environment(saved=null) {
 const values=new Map(saved===null?[]:[['study-room-atmosphere',saved]]),handlers={},root={dataset:{},style:{setProperty(key,value){this[key]=value;}}},flags={denied:false,focused:true};
 const storage={getItem:key=>{if(flags.denied)throw Error('denied');return values.get(key)??null;},setItem:(key,value)=>{if(flags.denied)throw Error('denied');values.set(key,value);}};
 const reduced={matches:false,addEventListener:(_,fn)=>handlers.reduced=fn};
 const document={documentElement:root,visibilityState:'visible',hasFocus:()=>flags.focused,addEventListener:(_,fn)=>handlers.visibility=fn};
 const host={localStorage:storage,document,matchMedia:()=>reduced,addEventListener:(type,fn)=>handlers[type]=fn};
 return {host,root,values,flags,reduced(value){reduced.matches=value;handlers.reduced();},hidden(value){document.visibilityState=value?'hidden':'visible';handlers.visibility();},focus(value){flags.focused=value;handlers[value?'focus':'blur']?.();},external(value){handlers.storage({key:'study-room-atmosphere',newValue:value,storageArea:storage});}};
}
function controller(e){assert.equal(typeof createAtmosphereController,'function','atmosphere controller must exist');return createAtmosphereController(e.host);}

test('video quality: old saved selections default to auto without rewriting storage or study data',()=>{
 const saved='{"background":"cloud-sky","motion":"live","intensity":"normal","paused":true}',e=environment(saved);e.values.set('study-session','preserved');const c=controller(e);
 assert.equal(c.getSnapshot().quality,'auto');assert.equal(c.getSnapshot().videoSource,'/themes/video/cloud-sky-hd.webm');assert.equal(c.getSnapshot().videoResolution,1080);
 assert.equal(c.getSnapshot().playing,false);assert.equal(e.values.get('study-room-atmosphere'),saved);assert.equal(e.values.get('study-session'),'preserved');
});

for(const [name,navigator,want] of [['desktop',{},1080],['Android',{userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36'},720],['iPhone',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19)'},720],['iPad desktop UA',{userAgent:'Mozilla/5.0 (Macintosh)',maxTouchPoints:5},720],['client hints',{userAgentData:{mobile:true}},720]])test(`video quality: auto chooses the device default for ${name}`,()=>{
 const e=environment('{"background":"city-night","motion":"live"}');e.host.navigator=navigator;assert.equal(controller(e).getSnapshot().videoResolution,want);
});

test('video quality: saver and high persist explicitly, reject invalid input and isolate stale playback reports',()=>{
 const e=environment(),c=controller(e);c.setPreferences({background:'cloud-sky',motion:'live',quality:'saver'});assert.equal(c.getSnapshot().videoSource,'/themes/video/cloud-sky.webm');assert.equal(c.getSnapshot().videoResolution,720);
 const request=c.getSnapshot().videoRequest;c.setPreferences({...c.getSnapshot(),quality:'high'});assert.equal(c.getSnapshot().videoResolution,1080);assert.ok(c.getSnapshot().videoRequest>request);
 c.reportVideoPlayback('cloud-sky','error',request);assert.equal(c.getSnapshot().videoStatus,'idle','late low-quality result must not overwrite the new player');
 assert.equal(controller(environment(e.values.get('study-room-atmosphere'))).getSnapshot().quality,'high');
 c.setPreferences({...c.getSnapshot(),quality:'https://bad.test'});assert.equal(c.getSnapshot().quality,'auto');
});

test('video quality: a 720p-only source never pretends to be 1080p and savings uses the real wave SD variant',()=>{
 assert.equal(typeof atmosphereVideoSource,'function');
 for(const id of ['rain-window','starry-night'])assert.deepEqual(atmosphereVideoSource(atmosphereThemes.find(t=>t.id===id),'high',false),{src:`/themes/video/${id}.webm`,resolution:720});
 assert.deepEqual(atmosphereVideoSource(atmosphereThemes.find(t=>t.id==='ocean-waves'),'saver',false),{src:'/themes/video/ocean-waves-sd.webm',resolution:720});
 assert.deepEqual(atmosphereVideoSource(atmosphereThemes.find(t=>t.id==='ocean-waves'),'high',true),{src:'/themes/video/ocean-waves.webm',resolution:1080});
});

for(const background of ['starry-night','rain-window','city-night'])test(`emotional video themes: ${background} restores the saved video and poster without touching study data`,()=>{
 const saved=JSON.stringify({background,motion:'live',intensity:'subtle',paused:false}),e=environment(saved);e.values.set('study-session','preserved');const c=controller(e);
 assert.equal(c.getSnapshot().background,background);assert.equal(c.getSnapshot().motion,'live');assert.equal(c.getSnapshot().videoStatus,'idle');assert.equal(c.getSnapshot().playing,true);
 assert.equal(e.root.style['--study-scene'],`url("/themes/video/${background}-poster.webp")`);
 c.reportVideoPlayback(background,'playing');assert.equal(c.getSnapshot().videoStatus,'playing');assert.equal(e.values.get('study-room-atmosphere'),saved);assert.equal(e.values.get('study-session'),'preserved');
});

test('emotional video themes: prepaint restores each new poster without requesting or claiming video playback',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 for(const background of ['starry-night','rain-window','city-night']){
  const root={dataset:{},style:{setProperty(key,value){this[key]=value;}}};
  vm.runInNewContext(scripts.join('\n'),{localStorage:{getItem:key=>key==='study-room-atmosphere'?JSON.stringify({background,motion:'live'}):'dark'},matchMedia:()=>({matches:false}),document:{documentElement:root,querySelector:()=>({setAttribute(){}})}});
  assert.equal(root.dataset.studyBackground,background);assert.equal(root.dataset.studyMotion,'static');assert.equal(root.style['--study-scene'],`url("/themes/video/${background}-poster.webp")`);
 }
});

test('atmosphere persists only a validated device-local background and does not change brightness or study keys',()=>{
 const e=environment();e.values.set('study-room-appearance','light');e.values.set('study-session','unchanged');const c=controller(e);
 assert.equal(c.getSnapshot().background,'charcoal');assert.equal(e.root.dataset.studyMotion,'static');
 c.setPreferences({background:'star-sea',motion:'live',intensity:'normal'});
 assert.equal(e.root.dataset.studyBackground,'star-sea');assert.equal(e.root.dataset.studyMotion,'playing');
 assert.deepEqual(JSON.parse(e.values.get('study-room-atmosphere')),{background:'star-sea',motion:'live',intensity:'normal',paused:false,quality:'auto'});
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

test('video backgrounds report actual playback separately from playback eligibility without persisting runtime state',()=>{
 const e=environment(),c=controller(e);c.setPreferences({background:'cloud-sky',motion:'live',intensity:'subtle'});
 assert.equal(c.getSnapshot().background,'cloud-sky');assert.equal(c.getSnapshot().playing,true);assert.equal(c.getSnapshot().videoStatus,'idle');
 const saved=e.values.get('study-room-atmosphere');assert.equal(typeof c.reportVideoPlayback,'function');c.reportVideoPlayback('cloud-sky','playing');assert.equal(c.getSnapshot().videoStatus,'playing');
 c.reportVideoPlayback('ocean-waves','error');assert.equal(c.getSnapshot().videoStatus,'playing','a late result from another source cannot overwrite the current source');
 c.reportVideoPlayback('cloud-sky','error');assert.equal(c.getSnapshot().videoStatus,'error');assert.equal(e.values.get('study-room-atmosphere'),saved);
 assert.equal(typeof c.retryVideo,'function');const request=c.getSnapshot().videoRequest;c.retryVideo();assert.equal(c.getSnapshot().videoRequest,request+1);assert.equal(c.getSnapshot().videoStatus,'idle');assert.equal(e.values.get('study-room-atmosphere'),saved);
});

test('video playback cannot report playing after reduced-motion or focus has stopped decoration',()=>{
 const e=environment(),c=controller(e);c.setPreferences({background:'ocean-waves',motion:'live',intensity:'normal'});assert.equal(c.getSnapshot().background,'ocean-waves');
 assert.equal(typeof c.reportVideoPlayback,'function');c.reportVideoPlayback('ocean-waves','playing');e.focus(false);c.reportVideoPlayback('ocean-waves','playing');assert.notEqual(c.getSnapshot().videoStatus,'playing');
 e.focus(true);e.reduced(true);c.reportVideoPlayback('ocean-waves','playing');assert.notEqual(c.getSnapshot().videoStatus,'playing');assert.equal(c.getSnapshot().motion,'live');
});
