import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachState, Recommendation } from './careerCoachTypes';
import { CareerForm, CoachEventForm, CoachEventList, CoachSettingsForm } from './CareerCoachForms';
import CoachIntegrations from './CoachIntegrations';
import CoachChannels from './CoachChannels';
import { localParts, wallTimeToInstant } from './coachTime.mjs';
import './careerCoach.css';

export type CoachRequest = <T=Record<string,unknown>>(name:string,body:Record<string,unknown>)=>Promise<T>;
type Props={supabase:SupabaseClient;userId:string;timeZone:string;legacy?:ReactNode;initialTab?:'today'|'settings';onChanged:()=>void;onState?:(state:CoachState|null)=>void;onManageNotifications:()=>void};
const tabs = [['today','오늘의 추천'],['career','커리어'],['calendar','생활 일정'],['settings','공부·알림 설정'],['connections','외부 연결']] as const;

export default function CareerCoach({supabase,userId,timeZone,legacy,initialTab='today',onChanged,onState,onManageNotifications}:Props) {
  const [state,setState]=useState<CoachState|null>(null);
  const [tab,setTab]=useState<string>(initialTab);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const alive=useRef(true);const requests=useRef(new Set<AbortController>());const mutation=useRef(false);
  const stateVersion=useRef(0);const actions=useRef({onChanged,onState});actions.current={onChanged,onState};
  const request:CoachRequest=useCallback(async <T,>(name:string,body:Record<string,unknown>):Promise<T>=>{
    const controller=new AbortController();requests.current.add(controller);
    const timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const {data:auth}=await supabase.auth.getSession();
      if(!alive.current||controller.signal.aborted||auth.session?.user.id!==userId)throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해 주세요.');
      const {data,error:failure}=await supabase.functions.invoke(name,{body,signal:controller.signal});
      if(failure){
        let message='요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
        if(failure.context instanceof Response){try{const result=await failure.context.clone().json();if(typeof result.error==='string')message=result.error;}catch{/* Do not expose transport details. */}}
        throw new Error(message);
      }
      if(data?.error)throw new Error(String(data.error));
      return data as T;
    } catch(failure){if(controller.signal.aborted)throw new Error('응답이 지연되고 있어요. 잠시 후 다시 확인해 주세요.');throw failure;}
    finally{clearTimeout(timeout);requests.current.delete(controller);}
  },[supabase,userId]);

  const reload=useCallback(async()=>{
    const version=++stateVersion.current;
    const result=await request<CoachState>('career-coach',{action:'state'});
    if(!alive.current||version!==stateVersion.current)return;
    setState(result);actions.current.onState?.(result);setLoading(false);
  },[request]);
  useEffect(()=>{
    alive.current=true;let cancelled=false;let timer:ReturnType<typeof setTimeout>|undefined;
    async function poll(){
      try{if(!mutation.current)await reload();}
      catch(failure){if(!cancelled){setLoading(false);setError(failure instanceof Error?failure.message:'코치를 불러오지 못했어요.');}}
      if(!cancelled)timer=setTimeout(()=>{void poll();},30000);
    }
    void poll();
    return()=>{cancelled=true;alive.current=false;++stateVersion.current;clearTimeout(timer);requests.current.forEach(controller=>controller.abort());requests.current.clear();};
  },[reload]);
  async function run(body:Record<string,unknown>):Promise<boolean>{
    if(mutation.current)return false;mutation.current=true;++stateVersion.current;setBusy(true);setError('');setNotice('');
    try{await request('career-coach',body);if(!alive.current)return false;await reload();actions.current.onChanged();setNotice('저장했어요.');return true;}
    catch(failure){if(alive.current)setError(failure instanceof Error?failure.message:'저장하지 못했어요.');return false;}
    finally{mutation.current=false;if(alive.current)setBusy(false);}
  }
  if(!state)return <section className="career-coach"><p role="status">{loading?'커리어 코치를 확인하고 있어요.':'커리어 코치를 불러오지 못했어요.'}</p>{error&&<><p role="alert" className="coach-error">{error}</p><button className="secondary" onClick={()=>{setError('');void reload().catch(()=>setError('연결을 다시 확인해 주세요.'));}}>다시 확인</button></>}</section>;
  if(state.eligible===false&&!state.enabled)return <>{legacy}</>;
  const pending=state.recommendations.filter(item=>item.status==='pending').slice(0,3);
  const working=state.jobs.some(job=>job.status==='pending'||job.status==='running');
  return <section className="career-coach" aria-label="커리어 코치">
    <header className="coach-row"><div><p className="eyebrow">STUDYROOM 2.0</p><h2>{state.enabled?'오늘의 추천':'나의 커리어 코치'}</h2><p>{state.career?.title||'원하는 커리어부터, 오늘의 작은 실천까지.'}</p></div><span className="coach-zone">{timeZone}</span></header>
    <nav className="coach-tabs" aria-label="커리어 코치 메뉴">{tabs.map(([id,label])=><button type="button" key={id} className={tab===id?'primary':'secondary'} aria-pressed={tab===id} onClick={()=>{setTab(id);setError('');setNotice('');}}>{label}</button>)}</nav>
    {error&&<p role="alert" className="coach-error">{error}</p>}<p className="coach-notice" role="status">{busy?'저장하고 있어요…':notice}</p>
    {tab==='today'&&<>
      {!state.enabled?<div className="coach-empty"><h3>커리어와 공부 가능 시간을 알려주세요</h3><p>설정을 마치면 매일 할 일을 먼저 제안합니다.</p><button type="button" className="primary" onClick={()=>setTab(state.career?'settings':'career')}>{state.career?'공부 시간과 알림 설정':'커리어 설정하기'}</button></div>:!state.career?<div className="coach-empty"><p>원하는 커리어를 먼저 설정해 주세요.</p><button className="primary" onClick={()=>setTab('career')}>커리어 설정</button></div>:!state.career.confirmed?<div className="coach-empty"><h3>{working?'커리어 로드맵을 준비하고 있어요':'로드맵을 검토해 주세요'}</h3><p>스킬과 실습 과제를 조정하고 확정하면 일정에 맞춰 추천합니다.</p><button className="primary" onClick={()=>setTab('career')}>로드맵 확인</button></div>:pending.length? <div className="coach-recommendations">{pending.map((item,index)=><RecommendationCard key={item.id} item={item} primary={index===0} timeZone={timeZone} busy={busy} onAction={run}/>)}</div>:<div className="coach-empty"><h3>{working?'일정과 학습 상황을 살펴보고 있어요':'지금은 새로운 추천이 없어요'}</h3><p>{working?'준비가 끝나면 자동으로 표시됩니다.':'공부 가능 시간과 남은 로드맵을 확인해 주세요. 등록한 계획은 기존 할 일에서 이어갈 수 있어요.'}</p><button className="secondary" onClick={()=>setTab('settings')}>공부 가능 시간 확인</button></div>}
      {state.enabled&&<button type="button" className="plain" disabled={busy} onClick={()=>void run({action:'mute_today'})}>오늘 코칭 알림 쉬기</button>}
    </>}
    {tab==='career'&&<CareerForm key={`${state.career?.id??'new'}:${JSON.stringify(state.career?.skills)}`} career={state.career} busy={busy} onSave={run}/>}
    {tab==='settings'&&<CoachSettingsForm key={JSON.stringify(state.settings)} settings={state.settings} busy={busy} onSave={run} onManageNotifications={onManageNotifications}/>}
    {tab==='calendar'&&<><CoachEventForm timeZone={timeZone} busy={busy} onSave={run}/><CoachEventList events={state.events} timeZone={timeZone} busy={busy} onDelete={id=>void run({action:'delete_event',id})}/></>}
    {tab==='connections'&&<><CoachIntegrations state={state} request={request} onChanged={reload}/><CoachChannels supabase={supabase} userId={userId} settings={state.settings} request={request} onManage={onManageNotifications}/></>}
  </section>;
}

function RecommendationCard({item,primary,timeZone,busy,onAction}:{item:Recommendation;primary:boolean;timeZone:string;busy:boolean;onAction:(body:Record<string,unknown>)=>Promise<boolean>}) {
  const [editing,setEditing]=useState(false);const [start,setStart]=useState(item.start_at?localParts(item.start_at,timeZone):'');const [error,setError]=useState('');
  return <article className={`coach-recommendation ${primary?'coach-primary':''}`}>
    <small>{primary?'오늘 먼저 해볼 일':'다른 선택'} · {item.duration_minutes}분</small><h3>{item.title}</h3><p>{item.reason}</p>
    <p className="coach-slot">{item.start_at?`${localParts(item.start_at,timeZone).replace('T',' ')} · ${timeZone}`:'공부 가능 시간에 시작하세요'}</p>
    <p><strong>완료 기준</strong> {item.acceptance}</p>
    <details><summary>추천 근거와 사용 모델</summary>{item.evidence?.map((value,i)=><p key={i}>{typeof value==='string'?value:JSON.stringify(value)}</p>)}<p>추천 방식: {item.source==='rules'?'로드맵 기반':item.source==='github'?'저장소 분석':'AI'}</p><p>설정 모델/라우터: {item.payload?.configured_model||'기록 없음'}<br/>실제 응답 모델: {item.payload?.model||'AI 호출 없음 또는 기록 없음'}<br/>프롬프트: {item.payload?.prompt_version||'기록 없음'}<br/>생성 시각: {item.created_at?localParts(item.created_at,timeZone).replace('T',' '):'기록 없음'}</p></details>
    {editing&&<label>시작 시각 ({timeZone})<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/><small>서머타임으로 두 번 있는 시각은 첫 번째 시각을 사용합니다.</small></label>}
    {error&&<p role="alert" className="coach-error">{error}</p>}
    <div className="coach-actions"><button type="button" className="primary" disabled={busy} onClick={()=>{setError('');try{void onAction({action:'accept',id:item.id,...(editing?{start_at:wallTimeToInstant(start,timeZone)}:{})});}catch(failure){setError(failure instanceof Error?failure.message:'시간을 확인해 주세요.');}}}>계획에 넣기</button><button type="button" className="secondary" disabled={busy} onClick={()=>setEditing(!editing)}>{editing?'시간 변경 취소':'다른 시간 선택'}</button><button type="button" className="plain" disabled={busy} onClick={()=>void onAction({action:'feedback',id:item.id,feedback:'skip'})}>건너뛰기</button></div>
    <div className="coach-feedback" aria-label="추천 피드백">{([['helpful','유용해요'],['difficult','어려워요'],['known','이미 알아요']] as const).map(([value,label])=><button key={value} type="button" className="plain" aria-pressed={item.feedback===value} disabled={busy} onClick={()=>void onAction({action:'feedback',id:item.id,feedback:value})}>{label}</button>)}</div>
  </article>;
}
