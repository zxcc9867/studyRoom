import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url), mod={exports:{}};
const bundle=await build({entryPoints:[new URL('../src/FeedInterestSettings.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent'});
new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);

test('saved interests use the deliberate change label even before the draft is edited',()=>{
  const html=renderToStaticMarkup(React.createElement(mod.exports.FeedInterestSettings,{
    preferences:{prompt:'웹 접근성',receiving:true,revision:4},searchStatus:{state:'ready',last_success_at:null},
    serviceAvailable:true,draft:'웹 접근성',busy:false,conflict:false,onDraftChange(){},onSave(){},onReceivingChange(){},onRetry(){},
  }));
  assert.match(html,/>관심 내용 변경<\/button>/);
  assert.doesNotMatch(html,/>소식 받아보기<\/button>/);
});
