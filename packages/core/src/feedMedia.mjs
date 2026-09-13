// Shared validation for metadata and the browser. Never accept arbitrary embed HTML.
export function safeMediaUrl(value,base){
 if(typeof value!=='string'||!value.trim()||value.length>2048||/[\u0000-\u0020\\]/.test(value))return null;
 try{
  const url=new URL(value,base),host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')return null;
  // Media never needs literal IPs or private/single-label hostnames.
  if(!host.includes('.')||host.includes(':')||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal|intranet|test|invalid)$/.test(host))return null;
  if([...url.searchParams.keys()].some(key=>/(?:token|secret|password|credential|signature|authorization|api[_-]?key)/i.test(key)))return null;
  url.hash='';return url.href;
 }catch{return null;}
}
export function videoFromUrl(value,base){
 const safe=safeMediaUrl(value,base);if(!safe)return null;
 const url=new URL(safe),host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
 let id=null,provider=null;
 if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
  id=parts[0]==='watch'?url.searchParams.get('v'):['embed','shorts'].includes(parts[0])?parts[1]:null;provider='youtube';
 }else if(host==='youtu.be'){id=parts[0];provider='youtube';}
 else if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){id=parts[0]==='video'?parts[1]:parts[0];provider='vimeo';}
 if(provider==='youtube'&&/^[\w-]{11}$/.test(id||''))return{provider,id};
 if(provider==='vimeo'&&/^\d{1,12}$/.test(id||''))return{provider,id};
 return null;
}
export function videoEmbedUrl(video){
 if(video?.provider==='youtube'&&/^[\w-]{11}$/.test(video.id))return 'https://www.youtube-nocookie.com/embed/'+video.id+'?autoplay=0&playsinline=1&rel=0';
 if(video?.provider==='vimeo'&&/^\d{1,12}$/.test(video.id))return 'https://player.vimeo.com/video/'+video.id+'?autoplay=0&dnt=1';
 return null;
}
