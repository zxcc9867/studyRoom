// Local-only visual fixture: real feed component, in-memory API boundary, no network credentials.
import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import TechFeed from '../../src/TechFeedSection';
import '../../src/styles.css';
import type {FeedArticle} from '../../src/techFeedTypes';

const sources=[{id:'source',name:'Engineering Journal',url:'https://example.com/feed',kind:'rss',recommended:true,subscribed:true,permission_status:'approved',last_success_at:'2026-09-13T09:00:00Z',last_error:null}];
const articles:FeedArticle[]=Array.from({length:43},(_,i)=>({
 id:'article-'+i,title:'Engineering notes '+(i+1),title_ko:['작은 팀이 AI 도구를 도입하며 배운 것','React에서 접근성을 지키는 작은 습관','PostgreSQL 쿼리 성능, 실행 계획부터 읽기'][i%3]+' · '+(i+1),
 url:'https://example.com/article/'+i,published_at:'2026-09-13T09:00:00Z',discovered_at:'2026-09-13T09:01:00Z',
 excerpt:'Original technical introduction. '.repeat(30),excerpt_ko:'새로운 도구를 도입하기 전에 실제로 해결하고 싶은 문제를 먼저 살펴봅니다. 작은 실험을 통해 팀에 맞는 사용 방법을 찾고, 결과를 함께 기록하는 과정이 중요합니다. '.repeat(i===0?5:1),
 translation_status:'ready',summary_status:i===1?'ready':'pending',summary:i===1?{technology:'React 기반 사용자 인터페이스의 접근성 설계입니다.',change:'키보드 탐색과 포커스 복원 사례를 소개합니다.',usage:'대화상자와 비동기 목록을 구현할 때 살펴볼 수 있습니다.'}:null,
 category:i===2?'deep_dive':'practice',sources:[{id:'source',name:'Engineering Journal'}],interests:[i%3===2?'backend':'frontend'],matched_topics:['웹 개발과 AI 도구'],origin:'rss',excerpt_provenance:'source_excerpt',saved:i<21,todo_id:null,
}));
let failNext=false;
let delayed=false;
let listCalls=0;
function Preview(){
 const [userId,setUserId]=useState('fixture-a');
 const [linked,setLinked]=useState<{userId:string;articleId:string;todoId:string}|null>(null);
 const [planned,setPlanned]=useState('');
 const client=useMemo(()=>({auth:{getSession:async()=>({data:{session:{user:{id:userId},access_token:'local-fixture-not-a-real-token'}},error:null})},functions:{invoke:async(_name:string,{body}:any)=>{
   if(body.action==='state')return{data:{enabled:true,service_available:true,sources,interests:['frontend'],last_success_at:'2026-09-13T09:00:00Z',preferences:{prompt:userId==='fixture-a'?'React 접근성과 AI 도구 활용':'다른 계정의 관심 내용',receiving:true,revision:1},search_status:{state:'ready',last_success_at:'2026-09-13T09:00:00Z'},translation_service:'ready'}};
   if(body.action==='list'){
    listCalls++;document.getElementById('fixture-calls')!.textContent=String(listCalls);
    if(delayed){delayed=false;await new Promise(resolve=>setTimeout(resolve,1500));}
    if(failNext){failNext=false;return{error:{message:'fixture failure'},data:null};}
    const filtered=userId==='fixture-b'?[]:articles.filter(item=>(body.view!=='saved'||item.saved)&&(!body.interest||item.interests.includes(body.interest)));
    const offset=Number(body.cursor||0);const remaining=filtered.filter(item=>Number(item.id.split('-')[1])>=offset);const batch=remaining.slice(0,20);return{data:{items:batch.map(item=>({...item})),next_cursor:remaining.length>20?String(Number(batch.at(-1)!.id.split('-')[1])+1):null}};
   }
   if(body.action==='save'){const item=articles.find(item=>item.id===body.article_id)!;item.saved=body.saved;return{data:{ok:true}};}
   if(body.action==='refresh')return{data:{state:'ready',new_articles:0,search:{state:'ready',articles:0}}};
   return{data:{ok:true}};
 }}}),[userId]);
 return <><aside style={{padding:12,fontSize:12}}><strong>로컬 UI 검증용 예시 데이터 · 운영 연결 없음</strong> · 목록 요청 <output id="fixture-calls">{listCalls}</output><button onClick={()=>setUserId(value=>value==='fixture-a'?'fixture-b':'fixture-a')}>계정 전환</button><button onClick={()=>{failNext=true;}}>다음 목록 실패</button><button onClick={()=>{delayed=true;}}>다음 목록 지연</button><output>{planned}</output></aside><main style={{padding:'20px 8px'}}><TechFeed supabase={client as any} userId={userId} timeZone="Asia/Seoul" linkedTodo={linked} onPlan={article=>{setPlanned('할 일 편집 요청: '+article.title);setLinked({userId,articleId:article.id,todoId:'fixture-todo'});}}/></main></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
