const safeCode=/^(usage|translate)_(http_[1-5][0-9]{2}|request_failed|invalid_count|invalid_limit|pro_response|invalid_response)$/;
export const translationErrorCode=error=>typeof error?.code==='string'&&safeCode.test(error.code)?error.code:null;
const failure=(code,message='unavailable')=>Object.assign(Error(message),{code});
// Deliberately fixed to DeepL Free. No paid endpoint, fallback or browser key.
export function createDeepLTranslation({env={},fetchImpl=globalThis.fetch}){
 const key=env.DEEPL_API_KEY?.trim();
 const availability=()=>env.TECH_FEED_TRANSLATION_ENABLED==='false'?'paused':!key?'not_configured':/^[\x21-\x7e]{8,200}:fx$/.test(key)?'waiting':'unavailable';
 async function request(path,body,signal){
  if(availability()!=='waiting')throw Error(availability());
  const bounded=AbortSignal.any([AbortSignal.timeout(12000),...(signal?[signal]:[])]);
  let response,reader;
  try{
   bounded.throwIfAborted();
   response=await fetchImpl('https://api-free.deepl.com/v2/'+path,{method:body?'POST':'GET',redirect:'error',signal:bounded,
    headers:{Authorization:'DeepL-Auth-Key '+key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   if(response.status===456)throw failure(path+'_http_456','quota_exhausted');
   if(response.status!==200)throw failure(path+'_http_'+response.status);
   if(Number(response.headers.get('content-length'))>131072)throw failure(path+'_invalid_response');
   reader=response.body?.getReader();if(!reader)throw Error('unavailable');
   let size=0,text='';const decoder=new TextDecoder();
   const cancel=()=>{void reader.cancel().catch(()=>{});};bounded.addEventListener('abort',cancel,{once:true});
   try{for(;;){const{done,value}=await reader.read();bounded.throwIfAborted();if(done)break;size+=value.byteLength;if(size>131072)throw Error('unavailable');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
   finally{bounded.removeEventListener('abort',cancel);}
  }catch(error){throw failure(translationErrorCode(error)||path+'_request_failed',error?.message==='quota_exhausted'?'quota_exhausted':'unavailable');}
  finally{if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}else if(response?.body)void response.body.cancel().catch(()=>{});}
 }
 return{availability,
  async checkUsage(signal){
   const data=await request('usage',null,signal);
   if(!Number.isSafeInteger(data.character_count)||data.character_count<0)throw failure('usage_invalid_count');
   if(!Number.isSafeInteger(data.character_limit)||data.character_limit<1)throw failure('usage_invalid_limit');
   if(data.products!==undefined||data.api_key_character_count!==undefined)throw failure('usage_pro_response');
   return{remaining:Math.max(0,Math.min(500000,data.character_limit)-data.character_count)};
  },
  async translate(texts,signal){
   if(!Array.isArray(texts)||texts.length<1||texts.length>6||texts.some(t=>typeof t!=='string'||!t.trim()||[...t].length>2000))throw Error('unavailable');
   const data=await request('translate',{text:texts,target_lang:'KO',preserve_formatting:true},signal);
   if(!Array.isArray(data.translations)||data.translations.length!==texts.length||data.translations.some(t=>typeof t?.text!=='string'||!t.text.trim()||[...t.text].length>6000))throw Error('unavailable');
   return data.translations.map(t=>t.text.trim());
  },
 };
}
