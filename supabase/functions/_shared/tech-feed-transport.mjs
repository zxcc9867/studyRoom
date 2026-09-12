import {lookup} from 'node:dns/promises';
import {Agent,request as httpsRequest} from 'node:https';
import {connect as tlsConnect,checkServerIdentity} from 'node:tls';
import {isIP} from 'node:net';
import {normalizeUrl,publicIp} from './tech-feed-core.mjs';

const MAX_BYTES=1024*1024;
// No ordinary fetch fallback. Unsupported Node-compatible TLS fails closed.
export function createPinnedTransport({resolve=lookup,request=httpsRequest,connect=tlsConnect}={}) {
 return async function transport(input,{headers={},signal}={}) {
  const deadline=AbortSignal.timeout(12000),combined=signal?AbortSignal.any([signal,deadline]):deadline;
  let current=normalizeUrl(input);
  for(let hop=0;hop<4;hop++) {
   combined.throwIfAborted();
   const url=new URL(current),hostname=url.hostname.replace(/^\[|\]$/g,'');
   const records=await Promise.race([
    isIP(hostname)?Promise.resolve([{address:hostname,family:isIP(hostname)}]):resolve(hostname,{all:true,verbatim:true}),
    new Promise((_,reject)=>combined.addEventListener('abort',()=>reject(Error('source_timeout')),{once:true})),
   ]);
   if(!Array.isArray(records)||!records.length||records.length>32||records.some(r=>!publicIp(r.address)))throw Error('unsafe_address');
   const address=records[0].address;
   const agent=new Agent({keepAlive:false,maxSockets:1});
   // TCP uses the validated literal. TLS verifies the original URL hostname.
   // The socket is not handed to HTTP until the certificate AND peer pin pass.
   agent.createConnection=(_options,callback)=>{
    let done=false;
    const finish=(error,socket)=>{if(done)return;done=true;callback(error,socket);};
    const socket=connect({host:address,port:443,servername:isIP(hostname)?undefined:hostname,
     rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>checkServerIdentity(hostname,cert),ALPNProtocols:['http/1.1']});
    const abort=()=>{socket.destroy();finish(Error('source_timeout'));};
    combined.addEventListener('abort',abort,{once:true});
    socket.once('error',()=>{combined.removeEventListener('abort',abort);finish(Error('source_failed'));});
    socket.once('secureConnect',()=>{
     combined.removeEventListener('abort',abort);
     const remote=String(socket.remoteAddress||'').replace(/^::ffff:/i,'');
     // Literal equality is deliberately conservative for alternate IPv6 spellings.
     if(!socket.authorized||remote!==address||combined.aborted){socket.destroy();finish(Error('unsafe_connection'));return;}
     finish(null,socket);
    });
    return undefined;
   };
   let response;
   try {
    response=await new Promise((resolveResponse,reject)=>{
     let settled=false,req;
     const fail=()=>{if(settled)return;settled=true;reject(Error('source_failed'));};
     const abort=()=>{req?.destroy();fail();};
     combined.addEventListener('abort',abort,{once:true});
     try {
      req=request(url,{method:'GET',agent,headers:{...headers,'Accept-Encoding':'identity','User-Agent':'StudyRoom-Feed/1.0'},signal:combined},res=>{
       const status=res.statusCode||0;
       const safeHeaders=Object.fromEntries(Object.entries(res.headers).filter(([,v])=>typeof v==='string'));
       if(status===304||[301,302,303,307,308].includes(status)){
        settled=true;combined.removeEventListener('abort',abort);res.destroy();resolveResponse({status,headers:safeHeaders,text:''});return;
       }
       if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'||Number(res.headers['content-length'])>MAX_BYTES){
        res.destroy();fail();return;
       }
       const chunks=[];let total=0;
       res.on('data',chunk=>{total+=chunk.length;if(total>MAX_BYTES){res.destroy();fail();}else chunks.push(chunk);});
       res.once('error',fail);res.once('aborted',fail);
       res.once('end',()=>{if(settled)return;settled=true;combined.removeEventListener('abort',abort);resolveResponse({status,headers:safeHeaders,text:Buffer.concat(chunks).toString('utf8')});});
      });
      req.once('error',fail);req.end();
     }catch{fail();}
    });
   }finally{agent.destroy();}
   if([301,302,303,307,308].includes(response.status)){
    if(hop===3||!response.headers.location)throw Error('redirect_limit');
    const next=normalizeUrl(new URL(response.headers.location,current).href);
    // Validators belong to the original endpoint, never a different authority.
    if(new URL(next).origin!==url.origin)headers={Accept:headers.Accept||'application/xml'};
    current=next;continue;
   }
   return {...response,url:current};
  }
  throw Error('source_failed');
 };
}
export const publicTransport=createPinnedTransport();
