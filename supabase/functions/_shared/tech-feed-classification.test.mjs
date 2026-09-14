import test from 'node:test';
import assert from 'node:assert/strict';
import {runClassificationWorker} from './tech-feed-classification.mjs';
test('classification worker uses public rule helpers, handles null evidence and preserves AI provenance',async()=>{
 const jobs=[{id:'1',lease:'l',title:'FluxDB tutorial with AWS',excerpt:'',prompt:'FluxDB'},
 {id:'2',lease:'l',title:'A plain note',excerpt:''},{id:'3',lease:'l',title:'AWS release',excerpt:'',summary_status:'ready',category:'deep_dive',category_method:'ai'}];
 const results=[];const store={claimClassification:async(version,limit)=>{assert.equal(limit,50);return jobs;},finishClassificationBatch:async items=>{for(const item of items)results.push({id:item.id,lease:item.lease,result:item});return{classified:2,stale:1};}};
 const result=await runClassificationWorker({store});assert.equal(result.classified,2);assert.equal(result.stale,1);
 assert.deepEqual(results[0].result.tags,['AWS']);assert.equal(results[0].result.category,'practice');assert.equal(results[1].result.category,null);assert.equal(results[2].result.method,'ai');
});
