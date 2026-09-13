
test('translation failures expose only safe stage codes, never provider bodies or credentials',async()=>{
 for(const [response,code]of [[json({message:'PRIVATE_RESPONSE'},403),'usage_http_403'],[json({character_count:0,character_limit:null}),'usage_invalid_limit'],[json({character_count:0,character_limit:500000,products:[]}),'usage_pro_response']]){
  const translator=createDeepLTranslation({env,fetchImpl:async()=>response});
  const store={claimTranslations:async()=>[{id:'a',lease:'l',title:'Title',excerpt:''}],finishTranslation:async()=>true};
  const result=await runTranslationWorker({store,pilotIds:['owner'],translator});
  assert.equal(result.error_code,code);assert.equal(result.attempted,0);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_RESPONSE|test-free-key/);
 }
});
import {createTechFeedHandler} from './tech-feed-api.mjs';

test('API exposes safe translation configuration and provider state without keys',async()=>{
 const id='00000000-0000-4000-8000-000000000101';
 for(const [extra,expected]of [[{},'not_configured'],[{DEEPL_API_KEY:'test-free-key:fx'},'quota_exhausted'],[{DEEPL_API_KEY:'test-free-key:fx',TECH_FEED_TRANSLATION_ENABLED:'false'},'paused']]){
  let queried=0;
  const handler=createTechFeedHandler({env:()=>({TECH_FEED_ENABLED:'true',TECH_FEED_ACCESS_MODE:'self_service',...extra}),authenticate:async()=>({id,store:{state:async()=>({sources:[],preferences:{prompt:'AI',receiving:true}}),translationStatus:async()=>{queried++;return{state:'quota_exhausted'};}}})});
  const response=await handler(new Request('https://example.com/feed',{method:'POST',body:JSON.stringify({action:'state'})}));
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.translation_service,expected);
  assert.equal(queried,expected==='quota_exhausted'?1:0);assert.doesNotMatch(JSON.stringify(body),/test-free-key|DEEPL_API_KEY/);
 }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeepLTranslation} from './tech-feed-translation.mjs';
import {runTranslationWorker} from './tech-feed-translation-worker.mjs';
const env={DEEPL_API_KEY:'test-free-key:fx'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('DeepL client uses only fixed Free endpoints and preserves ordered Korean results',async()=>{
 const calls=[];const provider=createDeepLTranslation({env,fetchImpl:async(url,init)=>{calls.push([url,init]);return url.endsWith('/usage')?json({character_count:100,character_limit:500000}):json({translations:[{text:'새 기술'},{text:'활용 소개'}]});}});
 assert.deepEqual(await provider.checkUsage(),{remaining:499900});assert.deepEqual(await provider.translate(['New tech','Introduction']),['새 기술','활용 소개']);
 assert.deepEqual(calls.map(c=>c[0]),['https://api-free.deepl.com/v2/usage','https://api-free.deepl.com/v2/translate']);
 assert.equal(calls[1][1].redirect,'error');assert.equal(calls[1][1].headers.Authorization,'DeepL-Auth-Key test-free-key:fx');
 assert.deepEqual(JSON.parse(calls[1][1].body),{text:['New tech','Introduction'],target_lang:'KO',preserve_formatting:true});
});
test('missing, paid and paused keys never cause a provider request',async()=>{
 for(const [config,state]of [[{},'not_configured'],[{DEEPL_API_KEY:'paid-key'},'unavailable'],[{...env,TECH_FEED_TRANSLATION_ENABLED:'false'},'paused']]){
  let calls=0;const p=createDeepLTranslation({env:config,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
  assert.equal(p.availability(),state);await assert.rejects(()=>p.checkUsage());assert.equal(calls,0);
 }
});
test('usage requires a finite Free quota and never assumes unknown quota is available',async()=>{
 for(const usage of [{},{character_count:0,character_limit:null},{character_count:-1,character_limit:500000},{character_count:0,character_limit:500000,products:[]}])await assert.rejects(()=>createDeepLTranslation({env,fetchImpl:async()=>json(usage)}).checkUsage(),/unavailable/);
 assert.deepEqual(await createDeepLTranslation({env,fetchImpl:async()=>json({character_count:500000,character_limit:500000})}).checkUsage(),{remaining:0});
});
test('quota, rate limit and invalid responses are bounded failures with no POST retry',async()=>{
 for(const [response,message]of [[json({},456),'quota_exhausted'],[json({},429),'unavailable'],[json({translations:[]}),'unavailable'],[json({translations:[{text:' '}]}),'unavailable'],[json({translations:[{text:'x'.repeat(131073)}]}),'unavailable']]){
  let calls=0;const p=createDeepLTranslation({env,fetchImpl:async()=>{calls++;return response;}});
  await assert.rejects(()=>p.translate(['title']),new RegExp(message));assert.equal(calls,1);
 }
});
test('no key does not claim work or touch coaching quota',async()=>{
 const result=await runTranslationWorker({store:{claimTranslations(){throw Error('must not claim');}},pilotIds:['owner'],translator:createDeepLTranslation({env:{}})});
 assert.equal(result.state,'not_configured');assert.equal(result.attempted,0);
});
test('insufficient provider characters do not POST; failure after reservation is charged once',async()=>{
 for(const remaining of [0,500000]){
  const events=[];const store={claimTranslations:async()=>[{id:'a',lease:'l',title:'A😀',excerpt:''}],reserveTranslation:async()=>{events.push('reserve');return{state:'reserved'};},finishTranslation:async(...args)=>{events.push(args[3]);return true;}};
  const translator={availability:()=> 'waiting',checkUsage:async()=>({remaining}),translate:async()=>{events.push('post');throw Error('PRIVATE_KEY');}};
  const result=await runTranslationWorker({store,pilotIds:['owner'],translator});
  assert.deepEqual(events,remaining?['reserve','post','unavailable']:['quota_exhausted']);assert.equal(result.characters,remaining?2:0);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_KEY/);
 }
});
test('empty excerpts are not sent, title and excerpt pairs remain aligned',async()=>{
 let saved;const store={claimTranslations:async()=>[{id:'a',lease:'l',title:'First',excerpt:''},{id:'b',lease:'l',title:'Second',excerpt:'Details'}],reserveTranslation:async()=>({state:'reserved'}),finishTranslation:async(ids,lease,items)=>{saved=items;return true;}};
 const translator={availability:()=> 'waiting',checkUsage:async()=>({remaining:500000}),translate:async texts=>{assert.deepEqual(texts,['First','Second','Details']);return['첫째','둘째','설명'];}};
 const result=await runTranslationWorker({store,pilotIds:['owner'],translator});assert.equal(result.translated,2);
 assert.deepEqual(saved,[{id:'a',title_ko:'첫째',excerpt_ko:''},{id:'b',title_ko:'둘째',excerpt_ko:'설명'}]);
});

test('a larger reported Free limit is capped, never treated as additional spendable quota',async()=>{
 for(const limit of [500001,1250000,1000000000000]){
  const p=createDeepLTranslation({env,fetchImpl:async()=>json({character_count:499999,character_limit:limit})});
  assert.deepEqual(await p.checkUsage(),{remaining:1});
 }
 assert.deepEqual(await createDeepLTranslation({env,fetchImpl:async()=>json({character_count:500001,character_limit:1250000})}).checkUsage(),{remaining:0});
});
