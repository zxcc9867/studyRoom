import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coachSettingsDraft} from '../src/coachSettingsDraft.mjs';
import {validateSettings} from '../../../supabase/functions/_shared/coach-domain.mjs';

test('database-shaped settings survive channel-only edit and save/read roundtrip',()=>{
  const stored={enabled:true,summary_time:'09:00:00',quiet_start:'22:00:00',quiet_end:'08:00:00',channels:{slack:false,web_push:false,email:false},availability:[{weekday:1,start:'19:00',end:'20:00'}],time_zone:'Asia/Tokyo'};
  const edited={...coachSettingsDraft(stored),channels:{...stored.channels,email:true}};
  const request={action:'settings',settings:edited};
  assert.doesNotThrow(()=>validateSettings(request.settings),'server accepts the edited database-shaped settings');
  for(const field of ['summary_time','quiet_start','quiet_end'])assert.match(request.settings[field],/^([01]\d|2[0-3]):[0-5]\d$/,'API requires minute-precision time');
  assert.deepEqual(request.settings.channels,{slack:false,web_push:false,email:true});
  assert.equal(request.settings.time_zone,'Asia/Tokyo');
  assert.deepEqual(request.settings.availability,stored.availability);
  const persisted={...request.settings,summary_time:request.settings.summary_time+':00',quiet_start:request.settings.quiet_start+':00',quiet_end:request.settings.quiet_end+':00'};
  assert.deepEqual(coachSettingsDraft(persisted),edited);
  assert.equal(stored.summary_time,'09:00:00','source state is not mutated');
});
test('new minute values remain unchanged and malformed values are not silently repaired',()=>{
  assert.deepEqual(coachSettingsDraft({summary_time:'09:30',quiet_start:'22:00',quiet_end:'08:00'}),{summary_time:'09:30',quiet_start:'22:00',quiet_end:'08:00'});
  assert.equal(coachSettingsDraft({summary_time:'09:30unexpected'}).summary_time,'09:30unexpected');
});
