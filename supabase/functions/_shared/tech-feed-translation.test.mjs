import test from 'node:test';
import assert from 'node:assert/strict';
import {runFeedWorker} from './tech-feed-worker-core.mjs';
import {runManualRefresh} from './tech-feed-refresh.mjs';

const jobs=[{id:'a',lease:'lease',title:'AI update',excerpt:'A public update 😀'}];
function fixture(){
 const calls=[];
 const store={claimSources:async()=>[],claimSummaries:async()=>[],cleanup:async()=>{},
  claimTranslations:async()=>jobs,reserveTranslation:async(ids,lease,cap)=>{calls.push(['reserve',ids,lease,cap]);return{state:'reserved'};},
  finishTranslation:async(ids,lease,items,error)=>{calls.push(['finish',items,error]);return true;}};
 const translator={availability:()=> 'waiting',checkUsage:async()=>{calls.push(['usage']);return{remaining:500000};},translate:async texts=>{calls.push(['translate',texts]);return['AI 업데이트','공개 업데이트 😀'];}};
 return{store,translator,calls,pilotIds:['owner'],transport:async()=>{throw Error('no RSS');},ask:async()=>null};
}
test('scheduled collector translates using independent character reservation even without AI summaries',async()=>{
 const f=fixture();const result=await runFeedWorker(f);
 assert.equal(result.translation?.translated,1);assert.deepEqual(f.calls[1],['reserve',['a'],'lease',450000]);
 assert.deepEqual(f.calls[2],['translate',['AI update','A public update 😀']]);
});
test('manual collection also translates existing backlog without making AI calls',async()=>{
 const f=fixture();Object.assign(f.store,{state:async()=>({preferences:{prompt:'ai news',receiving:true}}),beginRefresh:async()=>({state:'started',lease:'r'}),
 claimManualSearch:async()=>null,finishRefresh:async()=>true,refreshStatus:async()=>({state:'idle'})});
 const result=await runManualRefresh({...f,userId:'owner',expectedRevision:1,env:{TECH_FEED_ENABLED:'true',TAVILY_API_KEY:'test'},search:{availability:()=> 'waiting'}});
 assert.equal(result.translation?.translated,1);
});
