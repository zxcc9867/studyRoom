// Local synthetic data only; never connects to a remote service.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {SupabaseClient} from '@supabase/supabase-js';
import TechFeed from '../../src/TechFeedSection';
import type {FeedArticle, FeedPreferences, FeedSearchStatus, FeedState} from '../../src/techFeedTypes';
import '../../src/styles.css';

type Scenario='not_configured'|'quota_exhausted'|'paused'|'ready';
let activeUserId='fixture-owner-a';
let scenario:Scenario='not_configured';
let fail=false;
let conflictNext=false;
let delayNextState=false;
let delayNextMutation=false;
let failNextState=false;
let changeTopicAfterReceiving=false;
let changeTopicOnNextState=false;
let refreshMode='ready';
let refreshCalls=0;
const refreshedOwners=new Set<string>();
const refreshPolls=new Map<string,number>();
const profiles=new Map<string,FeedPreferences>([
  ['fixture-owner-a',{prompt:'',receiving:false,revision:0}],
  ['fixture-owner-b',{prompt:'Rust 비동기 런타임',receiving:true,revision:3}],
]);
const sources=[{id:'rss',name:'기술 블로그',url:'https://example.com/feed',kind:'rss' as const,recommended:true,subscribed:true,permission_status:'approved' as const,last_success_at:'2026-09-12T08:00:00Z',last_error:null}];
const items:FeedArticle[]=Array.from({length:23},(_,index)=>({
  id:String(index),title:`새로운 기술 살펴보기 ${index+1}`,
  url:index===0?'https://engineering.example.com/postgres/plans':`https://example.com/article/${index}`,
  published_at:index===0?null:'2026-09-12T07:00:00Z',discovered_at:'2026-09-12T08:00:00Z',
  excerpt:index===0?'검색 결과에 표시된 PostgreSQL 실행 계획 소개입니다.':'공식 발표를 읽고 학습에 활용할 부분을 정리해 보세요.',
  excerpt_provenance:index===0?'search_snippet':'source_excerpt',origin:index===0?'web_search':'rss',matched_topics:index===0?['PostgreSQL 성능']:[],
  summary:index===1?{technology:'웹 개발을 위한 새로운 도구입니다.',change:'새로운 개발 흐름을 소개합니다.',usage:'작은 예제로 기능을 확인할 때 참고하세요.'}:null,
  summary_status:index===1?'ready':'pending',category:index===1?'practice':null,interests:index===0?['backend']:['frontend'],
  sources:index===0?[]:[{id:'rss',name:'기술 블로그'}],saved:false,todo_id:null,
}));
const conflictItems:FeedArticle[]=items.map((item,index)=>({...item,id:`server-topic-${item.id}`,title:`서버 주제 소식 ${index+1}`,
  matched_topics:['다른 기기에서 저장한 서버 관심사']}));

function profile(userId:string) {
  const value=profiles.get(userId);
  if(!value)throw new Error('fixture profile missing');
  return value;
}
function searchStatus(value:FeedPreferences):FeedSearchStatus {
  const state=!value.receiving||scenario==='paused'?'paused':scenario;
  return {state,last_success_at:state==='ready'?'2026-09-12T08:00:00Z':null};
}
function stateFor(userId:string):FeedState {
  const preferences=profile(userId);
  return {
    enabled:true,sources,interests:[],last_success_at:'2026-09-12T08:00:00Z',preferences,
    search_status:searchStatus(preferences),service_available:preferences.receiving&&scenario!=='paused',
  };
}
function conflict() {
  return {data:null,error:{context:{status:409},message:'synthetic revision conflict'}};
}
const client={
  auth:{getSession:async()=>({data:{session:{user:{id:activeUserId},access_token:`token-${activeUserId}`}},error:null})},
  functions:{invoke:async(_name:string,{body,headers}:any)=>{
    const requestUser=String(headers?.Authorization||'').replace('Bearer token-','');
    if(body.action==='state'&&delayNextState){delayNextState=false;await new Promise(resolve=>setTimeout(resolve,900));}
    if(body.action==='state'&&failNextState){failNextState=false;return {data:null,error:{context:{status:503},message:'synthetic next-owner state error'}};}
    if(['topics_save','receiving'].includes(body.action)&&delayNextMutation){delayNextMutation=false;await new Promise(resolve=>setTimeout(resolve,900));}
    if(fail)return {data:null,error:{context:{status:503},message:'synthetic fixture error'}};
    const current=profile(requestUser);
    const saved=JSON.parse(localStorage.getItem(`tech-feed-fixture-saved-${requestUser}`)||'[]');
    const rows=(current.prompt==='다른 기기에서 저장한 서버 관심사'?conflictItems:items).map(item=>({...item,saved:saved.includes(item.id)}));
    let data:any;
    if(refreshedOwners.has(requestUser))rows.unshift({...items[0],id:'manual-refresh',title:'수동 수집으로 발견한 새 소식'});
    switch(body.action){
      case 'refresh':
        refreshCalls++;document.body.dataset.refreshCalls=String(refreshCalls);
        await new Promise(resolve=>setTimeout(resolve,900));
        if(body.expected_revision!==profile(requestUser).revision)return conflict();
        if(scenario==='paused'){data={state:'paused'};break;}
        if(scenario==='not_configured'){data={state:'not_configured'};break;}
        if(scenario==='quota_exhausted'){data={state:'partial',search:{state:'quota_exhausted'},rss:{collected:1}};break;}
        if(refreshMode==='cooldown'){data={state:'cooldown',retry_after:240};break;}
        if(refreshMode==='running'){refreshPolls.set(requestUser,0);data={state:'running'};break;}
        refreshedOwners.add(requestUser);data={state:'ready'};break;
      case 'refresh_status':{
        const count=(refreshPolls.get(requestUser)||0)+1;refreshPolls.set(requestUser,count);
        if(count>=2)refreshedOwners.add(requestUser);
        data={state:count<2?'running':'idle'};break;
      }
      case 'state':
        if(changeTopicOnNextState){
          changeTopicOnNextState=false;
          const latest=profile(requestUser);
          profiles.set(requestUser,{...latest,prompt:'다른 기기에서 저장한 서버 관심사',revision:latest.revision+1});
        }
        data=stateFor(requestUser);break;
      case 'list':{
        const filtered=rows.filter(row=>(body.view!=='saved'||row.saved)&&(!body.interest||row.interests.includes(body.interest))&&(!body.source_id||row.sources.some(source=>source.id===body.source_id)));
        const offset=Number(body.cursor||0);data={items:filtered.slice(offset,offset+20),next_cursor:filtered.length>offset+20?String(offset+20):null};break;
      }
      case 'topics_save':
        if(conflictNext){
          conflictNext=false;
          profiles.set(requestUser,{prompt:'다른 기기에서 저장한 서버 관심사',receiving:false,revision:current.revision+1});
          return conflict();
        }
        if(body.expected_revision!==current.revision)return conflict();
        profiles.set(requestUser,{prompt:body.prompt,receiving:body.receiving,revision:current.revision+1});
        data={preferences:profile(requestUser),search_status:searchStatus(profile(requestUser))};break;
      case 'receiving':
        if(body.expected_revision!==current.revision)return conflict();
        profiles.set(requestUser,{...current,receiving:body.receiving,revision:current.revision+1});
        if(changeTopicAfterReceiving){changeTopicAfterReceiving=false;changeTopicOnNextState=true;}
        data={preferences:profile(requestUser),search_status:searchStatus(profile(requestUser))};break;
      case 'save':
        localStorage.setItem(`tech-feed-fixture-saved-${requestUser}`,JSON.stringify(body.saved?[...new Set([...saved,body.article_id])]:saved.filter((id:string)=>id!==body.article_id)));
        data={ok:true};break;
      case 'preview':data={url:body.url,name:'추가할 기술 소스',items:[{title:'최근 기술 소식',url:'https://example.com/new'}]};break;
      case 'add_source':data={source:sources[0]};break;
      case 'subscribe':sources[0].subscribed=body.subscribed;data={ok:true};break;
      default:data={ok:true};
    }
    return {data,error:null};
  }},
} as unknown as SupabaseClient;

function Fixture(){
  const [userId,setUserId]=useState(activeUserId);
  const [fixtureVersion,setFixtureVersion]=useState(0);
  const [plan,setPlan]=useState('');
  const [linked,setLinked]=useState<{userId:string;articleId:string;todoId:string}|null>(null);
  function setFixtureScenario(value:Scenario){scenario=value;setFixtureVersion(version=>version+1);}
  function switchAccount(){activeUserId=activeUserId==='fixture-owner-a'?'fixture-owner-b':'fixture-owner-a';setUserId(activeUserId);}
  function loadPausedProfile(){
    const current=profile(activeUserId);
    profiles.set(activeUserId,{prompt:'PostgreSQL 성능',receiving:false,revision:current.revision+1});
    scenario='ready';setFixtureVersion(version=>version+1);
  }
  return <main style={{maxWidth:1120,margin:'20px auto',padding:12}}>
    <aside className="fixture-controls" aria-label="로컬 검증 제어">
      <strong>로컬 검증 화면 · 실제 계정/수집 아님 · {userId}</strong>
      <button onClick={()=>setFixtureScenario('not_configured')}>검색 키 미설정</button>
      <button onClick={()=>setFixtureScenario('quota_exhausted')}>429 무료 한도 소진</button>
      <button onClick={()=>setFixtureScenario('paused')}>전체 수집 중지</button>
      <button onClick={()=>setFixtureScenario('ready')}>검색 준비됨</button>
      <button onClick={loadPausedProfile}>수신 중지 상태 불러오기</button>
      <button onClick={()=>{conflictNext=true;}}>다음 관심 저장을 409로</button>
      <button onClick={()=>{delayNextState=true;}}>다음 상태 응답 지연</button>
      <button onClick={()=>{delayNextMutation=true;}}>다음 설정 응답 지연</button>
      <button onClick={()=>{failNextState=true;}}>다음 상태 응답 실패</button>
      <button onClick={()=>{changeTopicAfterReceiving=true;}}>다음 수신 변경 후 서버 주제 변경</button>
      <button onClick={switchAccount}>계정 전환</button>
      <button onClick={()=>{fail=!fail;setFixtureVersion(version=>version+1);}}>연결 실패 전환</button>
      <button onClick={()=>{refreshMode='cooldown';}}>다음 수집 5분 대기</button>
      <button onClick={()=>{refreshMode='running';}}>다음 수집 공유 작업</button>
      <button onClick={()=>{refreshMode='ready';}}>다음 수집 즉시 완료</button>
      <button onClick={()=>setLinked({userId,articleId:'22',todoId:'fixture-todo'})}>23번 글 할 일 연결</button>
    </aside>
    {plan&&<p role="status">할 일 편집 요청: {plan}</p>}
    <TechFeed key={fixtureVersion} supabase={client} userId={userId} timeZone="Asia/Seoul" linkedTodo={linked} onPlan={article=>setPlan(article.title)}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
