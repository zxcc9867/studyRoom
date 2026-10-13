import test from 'node:test';import assert from 'node:assert/strict';
import * as presentation from '../src/teamStudyPresentation.mjs';
test('valid personal server session requires actual tracking and unexpired lease',()=>{
 const session={id:'s',status:'active',paused_at:null,lease_expires_at:'2026-10-13T01:00:00Z'};
 assert.equal(presentation.canConnectPersonalSession(session,{session_id:'s'},Date.parse('2026-10-13T00:00:00Z')),true);
 assert.equal(presentation.canConnectPersonalSession({...session,paused_at:'now'},{session_id:'s'},0),false);
 assert.equal(presentation.canConnectPersonalSession(session,{session_id:'other'},0),false);
 assert.equal(presentation.canConnectPersonalSession(session,{session_id:'s'},Date.parse('2026-10-13T02:00:00Z')),false);
});
test('round clock shares server end and never produces negative time',()=>{
 assert.equal(presentation.roundRemainingSeconds({ends_at:'2026-10-13T00:25:00Z'},Date.parse('2026-10-13T00:20:00Z')),300);
 assert.equal(presentation.roundRemainingSeconds({ends_at:'2026-10-13T00:25:00Z'},Date.parse('2026-10-13T01:00:00Z')),0);
 assert.equal(presentation.normalizePublicTag(' A스타#지니 '),'a스타#지니');
 assert.equal(presentation.normalizePublicTag('x#지니'),null);
});
test('only an elapsed finite focus signals completion, never unlimited or unstarted focus',()=>{
 const now=Date.parse('2026-10-13T00:25:00Z');
 assert.equal(presentation.isRoundComplete({started_at:'2026-10-13T00:00:00Z',ends_at:'2026-10-13T00:25:00Z'},now),true);
 assert.equal(presentation.isRoundComplete({started_at:'2026-10-13T00:00:00Z',ends_at:'2026-10-13T00:26:00Z'},now),false);
 assert.equal(presentation.isRoundComplete({started_at:'2026-10-13T00:00:00Z',ends_at:null},now),false);
 assert.equal(presentation.isRoundComplete({started_at:null,ends_at:null},now),false);
 assert.equal(presentation.isRoundComplete(null,now),false);
});
