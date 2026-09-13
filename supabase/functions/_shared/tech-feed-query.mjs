import {canonicalTopic} from './tech-feed-topics.mjs';

// Preserve private saved input and shared topic identity; only the outbound
// search is focused. One cursor step is reserved with one actual search call.
export function focusedSearchQuery(value,cursor=0){
 const {prompt}=canonicalTopic(value);
 const parts=prompt.split(/\s*(?:[,;、]|\s+(?:및|그리고|and)\s+)\s*/iu);
 if(parts.length===1)return prompt;
 const seen=new Set(),topics=[];
 for(const part of parts){
  const topic=part.replace(/\s*(?:에\s*대해(?:서)?|에\s*관한|관련\s*소식)\s*$/u,'').trim();
  if(topic&&!seen.has(topic.toLowerCase())){seen.add(topic.toLowerCase());topics.push(topic);}
 }
 if(!topics.length)return prompt;
 const index=Number.isSafeInteger(cursor)&&cursor>=0?cursor%topics.length:0;
 const query=topics[index]+' technology news';
 // Keep the original validation and 300-character cap at the provider boundary.
 return [...query].length<=300?query:topics[index];
}
