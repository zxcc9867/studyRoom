import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emailChannelConnected,setEmailConnection} from '../src/coachEmailConnection.mjs';

test('email profile without delivery target is not connected',()=>{
  const profile={email:'fixture@example.test',email_reminders_enabled:true};
  assert.equal(emailChannelConnected([],profile),false);
  assert.equal(emailChannelConnected([{kind:'slack',enabled:true}],profile),false);
  assert.equal(emailChannelConnected([{kind:'email',enabled:false}],profile),false);
  assert.equal(emailChannelConnected([{kind:'email',enabled:true}],profile),true);
  assert.equal(emailChannelConnected([{kind:'email',enabled:true}],{...profile,email_reminders_enabled:false}),false);
});
test('email connection uses verified-address server actions without passing client address',async()=>{
  const calls=[];const request=async(name,body)=>{calls.push({name,body});return {connected:body.action==='connect_email'};};
  assert.deepEqual(await setEmailConnection(request,true),{connected:true});
  assert.deepEqual(await setEmailConnection(request,false),{connected:false});
  assert.deepEqual(calls,[{name:'coach-notifications',body:{action:'connect_email'}},{name:'coach-notifications',body:{action:'disconnect_email'}}]);
});
