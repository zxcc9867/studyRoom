import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson } from '../src/feedModelJson.mjs';

test('plain JSON is parsed unchanged', () => {
  assert.deepEqual(parseModelJson('{"insights":[1]}'), { insights: [1] });
  assert.deepEqual(parseModelJson('  \n {"a":1}\n '), { a: 1 });
});

test('a fenced block is unwrapped, which is how free models actually answer', () => {
  // Observed in production: a correct object thrown away because of the fence.
  assert.deepEqual(parseModelJson('```json\n{"insights":[{"title":"AWS Glue"}]}\n```'), { insights: [{ title: 'AWS Glue' }] });
  assert.deepEqual(parseModelJson('```\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('```JSON\r\n{"a":1}\r\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('여기 결과입니다:\n```json\n{"a":1}\n```\n도움이 되었길 바랍니다.'), { a: 1 });
  assert.deepEqual(parseModelJson('```json\n{"a":1}'), { a: 1 }, 'a truncated closing fence still yields the object');
});

test('anything that is not one JSON value is rejected rather than guessed at', () => {
  for (const bad of ['', '   ', 'not json at all', '```json\nnot json\n```', '{"a":1', '```\n```', null, undefined, 42, {}]) {
    assert.equal(parseModelJson(bad), null, `rejected: ${JSON.stringify(bad)}`);
  }
});

test('a fence never lets prose smuggle in a second value', () => {
  // Only the first fenced block is read; trailing content is not concatenated.
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```\n```json\n{"b":2}\n```'), { a: 1 });
});

test('scalars and arrays parse, so the caller keeps deciding what shape is valid', () => {
  assert.deepEqual(parseModelJson('[1,2]'), [1, 2]);
  assert.equal(parseModelJson('"text"'), 'text');
  assert.equal(parseModelJson('```json\ntrue\n```'), true);
});
