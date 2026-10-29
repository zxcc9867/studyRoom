import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppearanceController} from '../src/appearance.mjs';

function environment({saved=null,dark=false,readDenied=false,writeDenied=false}={}) {
 const callbacks={},values=new Map(saved===null?[]:[['study-room-appearance',saved]]),root={dataset:{},style:{}},meta={};
 const flags={readDenied,writeDenied};
 const storage={getItem:key=>{if(flags.readDenied)throw new Error('denied');return values.get(key)??null;},setItem:(key,value)=>{if(flags.writeDenied)throw new Error('denied');values.set(key,value);}};
 const media={matches:dark,addEventListener:(_,fn)=>callbacks.media=fn};
 const host={localStorage:storage,matchMedia:()=>media,addEventListener:(_,fn)=>callbacks.storage=fn,document:{documentElement:root,querySelector:()=>({setAttribute:(key,value)=>meta[key]=value})}};
 return {host,root,meta,flags,values,system(value){media.matches=value;callbacks.media();},external(key,newValue){callbacks.storage({key,newValue,storageArea:storage});}};
}

test('appearance uses saved preference before OS and writes only its device-local key',()=>{
 const e=environment({saved:'light',dark:true}),c=createAppearanceController(e.host);
 assert.deepEqual(c.getSnapshot(),{preference:'light',theme:'light',persistent:true});
 c.setPreference('dark');assert.equal(e.root.dataset.studyTheme,'dark');assert.equal(e.root.style.colorScheme,'dark');assert.equal(e.meta.content,'#151d19');
 assert.deepEqual([...e.values],[['study-room-appearance','dark']]);
});
test('system appearance follows media changes but explicit selection and unrelated storage win',()=>{
 const e=environment(),c=createAppearanceController(e.host);e.system(true);assert.equal(c.getSnapshot().theme,'dark');
 c.setPreference('light');e.system(true);assert.equal(c.getSnapshot().theme,'light');e.external('account','dark');assert.equal(c.getSnapshot().preference,'light');
 e.external('study-room-appearance','dark');assert.equal(c.getSnapshot().theme,'dark');e.external(null,null);assert.equal(c.getSnapshot().preference,'system');
 e.system(false);assert.equal(c.getSnapshot().theme,'light');
});
test('unreadable preference storage applies system then explicit appearance without claiming persistence',()=>{
 const e=environment({readDenied:true,writeDenied:true,dark:true}),c=createAppearanceController(e.host);
 assert.deepEqual(c.getSnapshot(),{preference:'system',theme:'dark',persistent:false});
 c.setPreference('light');assert.deepEqual(c.getSnapshot(),{preference:'light',theme:'light',persistent:false});
 e.flags.readDenied=false;e.flags.writeDenied=false;c.setPreference('light');assert.equal(c.getSnapshot().persistent,true);
});
test('failed writes retain the selected theme and recover on a later explicit selection',()=>{
 const e=environment({writeDenied:true}),c=createAppearanceController(e.host);c.setPreference('dark');assert.equal(c.getSnapshot().theme,'dark');assert.equal(c.getSnapshot().persistent,false);assert.equal(e.values.size,0);
 e.flags.writeDenied=false;c.setPreference('dark');assert.equal(c.getSnapshot().persistent,true);assert.equal(e.values.get('study-room-appearance'),'dark');
});
test('appearance notifies only changed snapshots and removes view subscriptions',()=>{
 const e=environment(),c=createAppearanceController(e.host),initial=c.getSnapshot();let changes=0;const stop=c.subscribe(()=>changes++);
 e.system(false);assert.equal(c.getSnapshot(),initial);assert.equal(changes,0);c.setPreference('dark');assert.equal(changes,1);stop();c.setPreference('light');assert.equal(changes,1);
});
