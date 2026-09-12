import test from 'node:test';
import assert from 'node:assert/strict';
import {currentFeedState, preferenceRefreshResult} from '../src/techFeed.mjs';

function feedState({prompt='PostgreSQL',receiving=false,revision=4,serviceAvailable=false}={}) {
  return {
    enabled:true,
    sources:[],
    interests:[],
    last_success_at:null,
    preferences:{prompt,receiving,revision},
    search_status:{state:receiving?'waiting':'paused',last_success_at:null},
    service_available:serviceAvailable,
  };
}

test('resume adopts authoritative availability without clearing the loaded article page',()=>{
  const stale=feedState();
  const authoritative=feedState({receiving:true,revision:5,serviceAvailable:true});
  const articles=[{id:'topic-a-1'}];

  const result=preferenceRefreshResult(stale.preferences.prompt,authoritative,articles,'20');

  assert.equal(result.state.service_available,true);
  assert.equal(result.state.preferences.receiving,true);
  assert.equal(result.resetFeed,false);
  assert.equal(result.articles,articles);
  assert.equal(result.cursor,'20');
});

test('conflict with a different authoritative topic invalidates populated pagination',()=>{
  const authoritative=feedState({prompt:'Rust async',receiving:true,revision:9,serviceAvailable:true});

  const result=preferenceRefreshResult('PostgreSQL',authoritative,[{id:'postgres-21'}],'20');

  assert.equal(result.resetFeed,true);
  assert.deepEqual(result.articles,[]);
  assert.equal(result.cursor,null);
  assert.equal(result.state.preferences.prompt,'Rust async');
});

test('an account can render only state loaded for that same account',()=>{
  const accountA=feedState({prompt:'Account A'});

  assert.equal(currentFeedState(accountA,'account-a','account-b'),null);
  assert.equal(currentFeedState(accountA,'account-a','account-a'),accountA);
  assert.equal(currentFeedState(null,'','account-b'),null);
});
