import test from 'node:test';
import assert from 'node:assert/strict';
import * as presentation from '../src/feedPresentation.mjs';

test('page navigation replaces the visible twenty articles without losing earlier pages',()=>{
  assert.equal(typeof presentation.feedPageView,'function');
  const articles=Array.from({length:43},(_,id)=>({id:String(id)}));
  const page=presentation.feedPageView(articles,2,null);
  assert.deepEqual(page.items.map(item=>item.id),Array.from({length:20},(_,id)=>String(id+20)));
  assert.deepEqual(page.numbers,[1,2,3]);
  assert.equal(page.hasNext,true);
  assert.equal(presentation.feedPageView(articles,1,null).items[0].id,'0');
  assert.equal(presentation.feedPageView(articles,3,null).hasNext,false);
});
test('cursor enables the next unknown page without inventing a total page count',()=>{
  assert.equal(typeof presentation.feedPageView,'function');
  const result=presentation.feedPageView(Array.from({length:20},(_,id)=>({id})),1,'next');
  assert.equal(result.hasNext,true);
  assert.equal(result.loadedPages,1);
  assert.deepEqual(result.numbers,[1]);
});
test('removing the final saved article clamps the current page back to existing content',()=>{
  assert.equal(typeof presentation.feedPageView,'function');
  const result=presentation.feedPageView(Array.from({length:20},(_,id)=>({id})),2,null);
  assert.equal(result.page,1);
  assert.equal(result.items.length,20);
  const empty=presentation.feedPageView([],4,null);
  assert.equal(empty.page,1);assert.deepEqual(empty.items,[]);assert.equal(empty.hasNext,false);
});
test('long excerpts have a short honest preview and retain the full original text',()=>{
  assert.equal(typeof presentation.feedExcerptView,'function');
  const original='가나다 '.repeat(100)+'마지막 문장';
  const result=presentation.feedExcerptView(original);
  assert.ok(result.preview.length<280);assert.equal(result.full,original.trim());
  assert.equal(result.expandable,true);assert.ok(result.preview.endsWith('…'));
  assert.deepEqual(presentation.feedExcerptView('짧은 소개'),{preview:'짧은 소개',full:'짧은 소개',expandable:false});
});
