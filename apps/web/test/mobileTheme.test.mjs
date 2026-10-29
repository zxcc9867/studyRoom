import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const html=readFileSync('apps/web/index.html','utf8');
const bootstrap=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
for(const [saved,system,want] of [[null,false,'light'],[null,true,'dark'],['light',true,'light'],['dark',false,'dark'],['invalid',true,'dark']])test(`pre-paint appearance respects saved=${saved} / system dark=${system}`,()=>{
 assert.ok(bootstrap,'appearance must be applied before the app module paints');
 const root={dataset:{},style:{}},meta={};
 runInNewContext(bootstrap,{localStorage:{getItem:()=>saved},matchMedia:()=>({matches:system}),document:{documentElement:root,querySelector:()=>({setAttribute:(key,value)=>meta[key]=value})}});
 assert.equal(root.dataset.studyTheme,want);assert.equal(root.style.colorScheme,want);assert.equal(meta.content,want==='dark'?'#151d19':'#f4f6f3');
});
test('pre-paint storage denial follows system instead of breaking login bootstrap',()=>{
 const root={dataset:{},style:{}};
 const host={matchMedia:()=>({matches:true}),document:{documentElement:root,querySelector:()=>({setAttribute(){}})}};
 Object.defineProperty(host,'localStorage',{get(){throw new Error('denied');}});
 assert.doesNotThrow(()=>runInNewContext(bootstrap,host));assert.equal(root.dataset.studyTheme,'dark');
});
