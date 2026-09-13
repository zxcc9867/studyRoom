import test from 'node:test';
import assert from 'node:assert/strict';
import {workerAuthorized} from './tech-feed-worker-core.mjs';

test('worker authentication does not require the Node global Buffer in Edge runtime', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer');
  delete globalThis.Buffer;
  try {
    const secret = 'a'.repeat(64);
    assert.equal(workerAuthorized(secret, secret), true);
    assert.equal(workerAuthorized('b'.repeat(64), secret), false);
    assert.equal(workerAuthorized('short', secret), false);
    assert.equal(workerAuthorized(null, secret), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'Buffer', descriptor);
  }
});
