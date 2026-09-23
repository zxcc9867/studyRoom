import {canonicalTopic} from './tech-feed-topics.mjs';

// Preserve private saved input and shared topic identity; only the outbound
// search is focused. One cursor step is reserved with one actual search call.
export function focusedSearchQuery(value,cursor=0){
 const {prompt}=canonicalTopic(value);
 const parts=prompt.split(/\s*(?:[,;、]|\s+(?:및|그리고|and)\s+)\s*/iu);
 const seen=new Set(),topics=[];
 for(const part of parts){
  const topic=part.replace(/\s*(?:에\s*대해(?:서)?|에\s*관한|관련\s*소식)\s*$/u,'').trim();
  if(topic&&!seen.has(topic.toLowerCase())){seen.add(topic.toLowerCase());topics.push(topic);}
 }
 if(!topics.length)return prompt;
 const step=Number.isSafeInteger(cursor)&&cursor>=0?cursor:0;
 const index=step%topics.length;
 // Never ask for "blogs": a search engine answers that with blog homepages,
 // blog roundups and blog launch posts. Ask for the technology instead.
 const intents=['engineering deep dive internals 동작 원리','engineering case study architecture','technical guide tutorial best practices'];
 const intentIndex=Math.floor(step/topics.length)%5;
 const intent=intentIndex===1?'실서비스 기술 구현 사례 아키텍처 설계':intentIndex===3?'한국어 실무 기술 튜토리얼 구현 방법':intents[intentIndex===0?0:intentIndex===2?1:2];
 const query=topics[index]+' '+intent;
 // Keep the original validation and 300-character cap at the provider boundary.
 return [...query].length<=300?query:topics[index];
}
