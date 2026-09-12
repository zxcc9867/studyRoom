import test from 'node:test';
import assert from 'node:assert/strict';
import {archivedCareerResponse} from './archived-career.mjs';
test('retired endpoint refuses legacy mutations without any network work',async()=>{const response=archivedCareerResponse(new Request('https://example.com',{method:'POST',body:'{"action":"save_career"}'}));assert.equal(response.status,410);assert.deepEqual(await response.json(),{error:'커리어 코칭은 보관된 기능입니다. 기술 피드를 이용해 주세요.',archived:true});});
test('retired endpoint permits CORS preflight without activating a feature',()=>{const response=archivedCareerResponse(new Request('https://example.com',{method:'OPTIONS'}));assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');});
