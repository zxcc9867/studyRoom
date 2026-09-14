import {classifyFeedArticle,FEED_CLASSIFICATION_RULES_VERSION} from '../../../packages/core/src/feedClassification.mjs';

export async function runClassificationWorker({store,signal}) {
 const result={classified:0,stale:0};
 if(signal?.aborted)return result;
 const jobs=await store.claimClassification(FEED_CLASSIFICATION_RULES_VERSION,50);
 if(signal?.aborted||!jobs.length)return result;
 // Never pass a user prompt to shared persisted classification. One bounded RPC
 // finishes the batch, avoiding fifty network round trips on the shared worker.
 return store.finishClassificationBatch(jobs.map(job=>({id:job.id,lease:job.lease,...classifyFeedArticle(job)})));
}
