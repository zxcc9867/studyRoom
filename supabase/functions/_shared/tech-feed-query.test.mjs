import test from 'node:test';
import assert from 'node:assert/strict';
import {focusedSearchQuery} from './tech-feed-query.mjs';

test('interest search alternates technical English and Korean reading intents',()=>{
 const queries=Array.from({length:5},(_,index)=>focusedSearchQuery('AWS Lambda',index));
 assert.equal(queries[0],'AWS Lambda engineering deep dive internals 동작 원리');
 assert.match(queries[1],/AWS Lambda 실서비스 기술 구현 사례 아키텍처 설계/);
 assert.match(queries[3],/AWS Lambda 한국어 실무 기술 튜토리얼 구현 방법/);
 assert.match(queries[2],/engineering case study architecture/);
 assert.match(queries[4],/technical guide tutorial best practices/);
 assert.ok(queries.every(query=>[...query].length<=300));
});

test('multiple interests retain a shared cursor without extra search calls',()=>{
 assert.match(focusedSearchQuery('AWS, 백엔드',0),/^AWS engineering/);
 assert.match(focusedSearchQuery('AWS, 백엔드',1),/^백엔드 engineering/);
 assert.match(focusedSearchQuery('AWS, 백엔드',2),/^AWS 실서비스 기술 구현/);
});
