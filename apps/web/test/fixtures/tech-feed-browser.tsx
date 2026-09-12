// Local synthetic data only; never connects to a remote service.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import TechFeed from '../../src/TechFeedSection';
import type { FeedArticle } from '../../src/techFeedTypes';
import '../../src/styles.css';
let fail=false;
const sources=[{id:'rss',name:'기술 블로그',url:'https://example.com/feed',kind:'rss',recommended:true,subscribed:true,permission_status:'approved',last_success_at:'2026-09-12T08:00:00Z',last_error:null}];
const items:FeedArticle[]=Array.from({length:23},(_,index)=>({id:String(index),title:`새로운 기술 살펴보기 ${index+1}`,url:`https://example.com/article/${index}`,published_at:'2026-09-12T07:00:00Z',discovered_at:'2026-09-12T08:00:00Z',excerpt:'공식 발표를 읽고 학습에 활용할 부분을 정리해 보세요.',summary:index===0?{technology:'웹 개발을 위한 새로운 도구입니다.',change:'새로운 개발 흐름을 소개합니다.',usage:'작은 예제로 기능을 확인할 때 참고하세요.'}:null,summary_status:index===0?'ready':'pending',category:index===0?'practice':null,interests:['web'],sources:[{id:'rss',name:'기술 블로그'}],saved:false,todo_id:null}));
const client={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-owner'}}}})},functions:{invoke:async(_name:string,{body}:any)=>{
  if(fail)return {error:new Error('fixture error')};
  const saved=JSON.parse(localStorage.getItem('tech-feed-fixture-saved')||'[]');
  const rows=items.map(item=>({...item,saved:saved.includes(item.id)}));
  let data:any;
  switch(body.action){
    case 'state':data={enabled:true,sources,interests:[],last_success_at:'2026-09-12T08:00:00Z'};break;
    case 'list':{const filtered=rows.filter(row=>body.view!=='saved'||row.saved);const offset=Number(body.cursor||0);data={items:filtered.slice(offset,offset+20),next_cursor:filtered.length>offset+20?String(offset+20):null};break;}
    case 'save':localStorage.setItem('tech-feed-fixture-saved',JSON.stringify(body.saved?[...new Set([...saved,body.article_id])]:saved.filter((id:string)=>id!==body.article_id)));data={ok:true};break;
    case 'preview':data={url:body.url,name:'추가할 기술 소스',items:[{title:'최근 기술 소식',url:'https://example.com/new'}]};break;
    case 'add_source':data={source:sources[0]};break;
    case 'subscribe':sources[0].subscribed=body.subscribed;data={ok:true};break;
    default:data={ok:true};
  }
  return {data,error:null};
}}} as unknown as SupabaseClient;
function Fixture(){const [plan,setPlan]=useState('');const [linked,setLinked]=useState<{userId:string;articleId:string;todoId:string}|null>(null);return <main style={{maxWidth:1120,margin:'20px auto',padding:12}}><p>로컬 검증 화면 · 실제 계정/수집 아님</p><button onClick={()=>{fail=!fail;}}>실패 상태 전환</button><button onClick={()=>setLinked({userId:'fixture-owner',articleId:'22',todoId:'fixture-todo'})}>23번 글 저장 완료 재현</button>{plan&&<p role="status">할 일 편집 요청: {plan}</p>}<TechFeed supabase={client} userId="fixture-owner" timeZone="Asia/Seoul" linkedTodo={linked} onPlan={article=>setPlan(article.title)}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
