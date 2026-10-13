import test from 'node:test';
import assert from 'node:assert/strict';
import * as invite from '../src/teamStudyInvite.mjs';
const token='a'.repeat(64);
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('captures only valid invitation fragments and removes token from address',()=>{
 const s=storage();let address;
 assert.equal(invite.captureTeamInvite({hash:'#together?invite='+token,storage:s,now:100,replaceHash:h=>address=h}),token);
 assert.equal(address,'#together');
 assert.equal(invite.readTeamInvite(s,200),token);
 assert.equal(invite.captureTeamInvite({hash:'#access_token=oauth',storage:s,now:300}),token);
});
test('rejects malformed tokens and expires storage without leaking stored input',()=>{
 const s=storage();assert.equal(invite.isTeamInviteToken(token),true);
 for(const value of ['a'.repeat(63),'A'.repeat(64),'mail@example.test',null])assert.equal(invite.isTeamInviteToken(value),false);
 invite.captureTeamInvite({hash:'#together?invite='+token,storage:s,now:100});
 assert.equal(invite.readTeamInvite(s,100+7*86400000),null);
 invite.captureTeamInvite({hash:'#together?invite='+token,storage:s,now:100});invite.clearTeamInvite(s);
 assert.equal(invite.readTeamInvite(s,101),null);
});
