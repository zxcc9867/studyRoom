import test from 'node:test';
import assert from 'node:assert/strict';
import {feedPageView} from '../src/feedPresentation.mjs';

test('unsaving an article keeps cursor page boundaries so the next unseen item is not skipped',()=>{
 const cached=Array.from({length:40},(_,id)=>({id,saved:id!==0}));
 const first=feedPageView(cached,1,null,true);
 assert.equal(first.items.length,19);
 assert.equal(feedPageView(cached,2,null,true).items[0].id,20);
});
test('an empty saved page still offers the next cursor page',()=>{
 const cached=Array.from({length:20},(_,id)=>({id,saved:false}));
 const result=feedPageView(cached,1,'next',true);
 assert.deepEqual(result.items,[]);assert.equal(result.hasNext,true);
});
test('unsaving the only item on the last saved page returns to the previous nonempty page',()=>{
 const cached=Array.from({length:21},(_,id)=>({id,saved:id<20}));
 const result=feedPageView(cached,2,null,true);
 assert.equal(result.page,1);assert.equal(result.items.length,20);assert.equal(result.hasNext,false);
});
