import {safeMediaUrl,videoFromUrl} from '../../../packages/core/src/feedMedia.mjs';
const empty=()=>({image_url:null,video:null});
function decode(value){
 return value.replace(/&(?:amp|quot|apos|lt|gt|#\d{1,7}|#x[\da-f]{1,6});/gi,entity=>{
  const key=entity.slice(1,-1).toLowerCase(),map={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  if(key in map)return map[key];
  const code=key[1]==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
 });
}
function attributes(tag){
 const result=Object.create(null);
 for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)){
  const key=match[1].toLowerCase();if(!(key in result))result[key]=decode(match[2]??match[3]??match[4]??'');
 }
 return result;
}
export function extractArticleMedia(html,pageUrl,robots=''){
 if(typeof html!=='string'||html.length>1048576)return empty();
 const clean=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const head=clean.includes('</head>')?clean.slice(0,clean.indexOf('</head>')):clean;
 const meta=Object.create(null);
 for(const tag of head.match(/<meta\b[^>]{0,8192}>/gi)||[]){
  const attrs=attributes(tag),key=(attrs.property||attrs.name||'').toLowerCase();
  if(key==='robots'||key==='googlebot')robots+=' '+(attrs.content||'');
  if(!(key in meta))meta[key]=attrs.content||'';
 }
 if(/\b(noimageindex|none|noindex)\b|max-image-preview\s*:\s*none/i.test(robots))return empty();
 const image=safeMediaUrl(meta['og:image:secure_url'],pageUrl)||safeMediaUrl(meta['og:image'],pageUrl)||safeMediaUrl(meta['og:image:url'],pageUrl)||safeMediaUrl(meta['twitter:image'],pageUrl)||safeMediaUrl(meta['twitter:image:src'],pageUrl);
 let video=videoFromUrl(meta['og:video:secure_url'],pageUrl)||videoFromUrl(meta['og:video'],pageUrl)||videoFromUrl(meta['og:video:url'],pageUrl)||videoFromUrl(meta['twitter:player'],pageUrl)||videoFromUrl(pageUrl);
 if(!video)for(const tag of clean.match(/<iframe\b[^>]{0,8192}>/gi)||[]){
  video=videoFromUrl(attributes(tag).src,pageUrl);if(video)break;
 }
 return{image_url:image,video};
}
export async function runMediaWorker({store,pilotIds,transport,signal=AbortSignal.timeout(12000)}){
 const result={checked:0,ready:0,failed:0};
 if(!store.claimMedia||!pilotIds?.length||signal.aborted)return result;
 try{
  const jobs=await store.claimMedia(pilotIds,3);
  for(const job of jobs.slice(0,3)){
   if(signal.aborted)break;
   try{
    if(!await store.mediaAllowed(job.id,job.lease)){await store.finishMedia(job.id,job.lease,empty(),'deferred');continue;}
    const directVideo=videoFromUrl(job.url);
    if(directVideo){
     const saved=await store.finishMedia(job.id,job.lease,{image_url:null,video:directVideo},null);
     result.checked++;if(saved)result.ready++;continue;
    }
    const response=await transport(job.url,{headers:{Accept:'text/html,application/xhtml+xml'},signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])});
    const header=name=>response.headers?.get?.(name)??response.headers?.[name]??'';
    if(response.status!==200||!/^text\/html\b|^application\/xhtml\+xml\b/i.test(header('content-type')))throw Error('media_unavailable');
    const media=extractArticleMedia(response.text,response.url||job.url,header('x-robots-tag'));
    const saved=await store.finishMedia(job.id,job.lease,media,null);
    result.checked++;if(saved&&(media.image_url||media.video))result.ready++;
   }catch{
    result.failed++;
    try{await store.finishMedia(job.id,job.lease,empty(),'media_unavailable');}catch{/* bounded lease permits retry */}
   }
  }
 }catch{result.failed++;}
 return result;
}
