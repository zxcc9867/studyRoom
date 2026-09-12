import test from 'node:test';
import assert from 'node:assert/strict';
test('canonical topics share case/width/whitespace but preserve display prompt',async()=>{
 const {canonicalTopic}=await import('./tech-feed-topics.mjs');
 assert.deepEqual(canonicalTopic('  AWS   Lambda  '),{prompt:'AWS Lambda',canonical:'aws lambda'});
 assert.equal(canonicalTopic('ＡＷＳ Lambda').canonical,'aws lambda');
});
test('private or malformed topic inputs are rejected before provider use',async()=>{
 const {canonicalTopic}=await import('./tech-feed-topics.mjs');
 for(const value of ['a','x'.repeat(301),'person@example.com','https://example.com','example.com/news','sk-abcdefghijklmnopqrstuvwxyz123456','AWS\nLambda','Bearer abcdefghijklmnopqrstuvwxyz123456',null])assert.throws(()=>canonicalTopic(value),/invalid_input/);
});
test('credential-shaped cloud keys and bare URL paths are not public technology topics',async()=>{
 const {canonicalTopic}=await import('./tech-feed-topics.mjs');
 for(const value of ['AKIAABCDEFGHIJKLMNOP','example.xyz/private/path'])assert.throws(()=>canonicalTopic(value),/invalid_input/);
});
