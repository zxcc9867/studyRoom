import test from 'node:test';
import assert from 'node:assert/strict';
import {isCurrentFeedRequest} from '../src/techFeed.mjs';

test('an old-account action cannot write through a newer generation or aborted lifetime',()=>{
  const oldLifetime=new AbortController();
  assert.equal(isCurrentFeedRequest(4,4,oldLifetime.signal),true);
  assert.equal(isCurrentFeedRequest(4,5,oldLifetime.signal),false);
  oldLifetime.abort();
  assert.equal(isCurrentFeedRequest(5,5,oldLifetime.signal),false);
});
