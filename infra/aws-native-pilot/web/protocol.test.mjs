import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAuthorization, finishAuthorization } from './oauth.mjs';
import { subscribeToStudy } from './realtime.mjs';

const cfg = {cognitoDomain:'https://test.auth.us-east-1.amazoncognito.com', clientId:'test-client'};
const here = 'https://example.cloudfront.net/';

test('builds a PKCE authorization code flow and never exchanges an unmatched state', async () => {
  const {url, pending} = await makeAuthorization(cfg, here);
  assert.equal(url.origin, cfg.cognitoDomain);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('code_challenge'), /^[\w-]{43}$/);
  assert.notEqual(url.searchParams.get('code_challenge'), pending.verifier);
  assert.equal(url.searchParams.get('redirect_uri'), here);
  let calls = 0;
  await assert.rejects(finishAuthorization(cfg, new URL(here + '?code=short&state=wrong'), pending, async () => { calls++; }), /state/);
  assert.equal(calls, 0);
  await assert.rejects(finishAuthorization(cfg, new URL(here + '?code=short&state=' + pending.state), {...pending, createdAt:0}, async () => { calls++; }), /state/);
  assert.equal(calls, 0);
  const tokens = await finishAuthorization(cfg, new URL(here + '?code=short&state=' + pending.state), pending, async (target, req) => {
    assert.equal(target, cfg.cognitoDomain + '/oauth2/token');
    assert.equal(req.body.get('code_verifier'), pending.verifier);
    assert.equal(req.body.get('code'), 'short');
    return new Response('{"access_token":"mock.jwt.value","token_type":"Bearer"}');
  });
  assert.equal(tokens, 'mock.jwt.value');
});

const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
class SocketDouble extends EventTarget {
  static last;
  sent = [];
  readyState = 1;
  constructor(url, protocols) {
    super();
    Object.assign(this, {url, protocols});
    SocketDouble.last = this;
  }
  send(message) { this.sent.push(JSON.parse(message)); }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  receive(message) { this.dispatchEvent(new MessageEvent('message', {data:JSON.stringify(message)})); }
}
const options = {
  httpUrl:'https://pilot.appsync-api.us-east-1.amazonaws.com/event',
  realtimeUrl:'wss://pilot.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime',
  token:'mock.jwt.value', subject, socket:SocketDouble
};

test('subscribes only after handshake and consumes events for its own subscription id', async () => {
  const events = [];
  const sub = subscribeToStudy({...options, onEvent:value => events.push(value)});
  const ws = SocketDouble.last;
  try {
    assert.equal(ws.protocols[0], 'aws-appsync-event-ws');
    assert.deepEqual(JSON.parse(Buffer.from(ws.protocols[1].slice(7), 'base64url')), {
      host:'pilot.appsync-api.us-east-1.amazonaws.com', Authorization:'mock.jwt.value'
    });
    ws.dispatchEvent(new Event('open'));
    assert.deepEqual(ws.sent, [{type:'connection_init'}]);
    ws.receive({type:'connection_ack', connectionTimeoutMs:5000});
    const msg = ws.sent[1];
    assert.equal(msg.type, 'subscribe');
    assert.equal(msg.channel, '/study/' + subject);
    ws.receive({type:'subscribe_success', id:msg.id});
    await sub.ready;
    ws.receive({type:'data', id:'other', event:['{"kind":"record","id":"b"}']});
    ws.receive({type:'data', id:msg.id, event:['{"kind":"record","id":"a"}']});
    assert.deepEqual(events, [{kind:'record', id:'a'}]);
  } finally { sub.close(); }
});

test('distinguishes subscription denial from loss of connection', async () => {
  const sub = subscribeToStudy(options);
  const ws = SocketDouble.last;
  ws.receive({type:'connection_ack', connectionTimeoutMs:5000});
  ws.receive({type:'subscribe_error', id:ws.sent[0].id});
  await assert.rejects(sub.ready, error => error.code === 'subscription_denied');
});
