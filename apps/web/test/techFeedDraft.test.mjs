import test from 'node:test';
import assert from 'node:assert/strict';
import {feedTodoDraft} from '../src/techFeed.mjs';
test('long source title is bounded to server todo title limit',()=>{
 const draft=feedTodoDraft({id:'a',title:'긴 제목'.repeat(80)},'2026-09-12');
 assert.ok(draft.title.length<=180);
});
