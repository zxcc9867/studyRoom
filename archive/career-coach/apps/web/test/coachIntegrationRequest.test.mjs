import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestIntegration} from '../src/coachIntegrationRequest.mjs';

test('calendar and repository interactions deliver required provider to transport',async()=>{
  const calls=[];const request=async(name,body)=>{calls.push({name,body});return {ok:true};};
  for(const [payload,provider] of [
    [{action:'calendars'},'google'],
    [{action:'select_calendars',calendar_ids:['primary','shared']},'google'],
    [{action:'repositories'},'github'],
    [{action:'select_repository',owner:'learner',name:'project',selected:true,ai_enabled:false},'github'],
    [{action:'select_repository',owner:'learner',name:'project',selected:true,ai_enabled:true},'github'],
    [{action:'select_repository',owner:'learner',name:'project',selected:false,ai_enabled:false},'github'],
  ]){
    assert.deepEqual(await requestIntegration(request,payload),{ok:true});
    assert.deepEqual(calls.at(-1),{name:'coach-integrations',body:{...payload,provider}});
    assert.equal('provider' in payload,false,'caller payload is not mutated');
  }
});
test('dynamic provider actions retain chosen provider and status stays unscoped',async()=>{
  const calls=[];const request=async(name,body)=>{calls.push(body);return {};};
  await requestIntegration(request,{action:'status'});
  for(const provider of ['google','github'])for(const action of ['connect','disconnect','sync'])await requestIntegration(request,{action,provider});
  assert.deepEqual(calls[0],{action:'status'});assert.deepEqual(calls[6],{action:'sync',provider:'github'});
});
test('mismatched and missing providers reject before any transport call',()=>{
  const request=()=>{assert.fail('must not invoke transport');};
  assert.throws(()=>requestIntegration(request,{action:'calendars',provider:'github'}));
  assert.throws(()=>requestIntegration(request,{action:'connect'}));
  assert.throws(()=>requestIntegration(request,{action:'disconnect',provider:'other'}));
});
