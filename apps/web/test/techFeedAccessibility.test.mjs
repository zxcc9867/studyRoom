import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url), mod={exports:{}};
const bundle=await build({
  entryPoints:[new URL('../src/FeedInterestSettings.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],
  bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent',
});
new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);

test('changing search availability is announced by the status badge live region',()=>{
  const html=renderToStaticMarkup(React.createElement(mod.exports.FeedInterestSettings,{
    preferences:{prompt:'웹 접근성',receiving:true,revision:4},
    searchStatus:{state:'quota_exhausted',last_success_at:null},serviceAvailable:true,
    draft:'웹 접근성',busy:false,conflict:false,onDraftChange(){},onSave(){},onReceivingChange(){},onRetry(){},
  }));
  assert.match(html,/<span class="feed-search-state is-quota_exhausted" role="status" aria-live="polite">/);
  assert.match(html,/웹 검색 무료 한도를 모두 사용했어요/);
});
