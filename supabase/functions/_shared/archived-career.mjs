export function archivedCareerResponse(request) {
  const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store',
    'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, GET, OPTIONS' };
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  return new Response(JSON.stringify({error:'커리어 코칭은 보관된 기능입니다. 기술 피드를 이용해 주세요.',archived:true}),{status:410,headers});
}
