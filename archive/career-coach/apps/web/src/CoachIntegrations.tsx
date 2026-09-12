import { useEffect, useRef, useState } from 'react';
import type { CoachRequest } from './CareerCoach';
import type { CoachState } from './careerCoachTypes';
import { requestIntegration } from './coachIntegrationRequest.mjs';

type CalendarChoice={id:string;title?:string;summary?:string;time_zone?:string;selected?:boolean};
type RepoChoice={owner:string;name:string;private:boolean;selected?:boolean;ai_enabled?:boolean};
export default function CoachIntegrations({state,request,onChanged}:{state:CoachState;request:CoachRequest;onChanged:()=>Promise<void>}) {
  const [configured,setConfigured]=useState<{google:boolean;github:boolean}|null>(null);
  const [calendars,setCalendars]=useState<CalendarChoice[]|null>(null);const [selected,setSelected]=useState<string[]>([]);
  const [repos,setRepos]=useState<RepoChoice[]|null>(null);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const live=useRef(true);const lock=useRef(false);
  useEffect(()=>{live.current=true;void requestIntegration<{configured:{google:boolean;github:boolean}}>(request,{action:'status'}).then(result=>{if(live.current)setConfigured(result.configured);}).catch(()=>{if(live.current)setError('외부 연결 상태를 확인하지 못했어요.');});return()=>{live.current=false;};},[request]);
  async function run(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await task();if(live.current){await onChanged();setNotice('연결 설정을 반영했어요.');}}catch(failure){if(live.current)setError(failure instanceof Error?failure.message:'연결을 처리하지 못했어요.');}finally{lock.current=false;if(live.current)setBusy(false);}}
  const google=state.integrations.find(i=>i.provider==='google');
  const github=state.integrations.find(i=>i.provider==='github');
  return <div className="coach-connections"><h3>외부 연결</h3><p>필요한 서비스만 연결하세요. 연결을 해제하면 해당 자료의 동기화와 예약 분석도 중단합니다.</p>
    {error&&<p className="coach-error" role="alert">{error}</p>}<p role="status">{busy?'연결 처리 중…':notice}</p>
    {(['google','github'] as const).map(provider=>{const connection=provider==='google'?google:github;return <article className="coach-connection" key={provider}><div className="coach-row"><h4>{provider==='google'?'Google 캘린더':'GitHub 저장소'}</h4><span>{connection?.status==='connected'?'연결됨':connection?.status==='error'?'다시 연결 필요':'연결 안 됨'}</span></div>
      <p>{provider==='google'?'선택한 캘린더를 읽어 공부 가능한 시간을 찾습니다. Google 일정은 수정하지 않습니다.':'선택한 저장소를 읽고 개선할 실습 과제를 제안합니다. 코드를 실행하거나 수정하지 않습니다.'}</p>
      {configured?.[provider]===false&&<p>서비스 연결 준비가 필요합니다. 관리자에게 연결 설정을 요청해 주세요.</p>}
      {connection?.last_error&&<p role="status">최근 연결 확인에 실패했어요. 다시 연결하거나 동기화해 주세요.</p>}
      <div className="coach-actions"><button className="secondary" disabled={busy||!configured?.[provider]} onClick={()=>void run(async()=>{const result=await requestIntegration<{url:string}>(request,{action:'connect',provider});const url=new URL(result.url);if(url.protocol!=='https:'||!['accounts.google.com','github.com'].includes(url.hostname))throw new Error('연결 주소를 확인하지 못했어요.');window.location.assign(url.href);})}>{connection?.status==='connected'?'다시 연결':'연결하기'}</button>
      {connection&&connection.status!=='disconnected'&&<><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await requestIntegration(request,{action:'sync',provider});})}>동기화</button><button className="plain" disabled={busy} onClick={()=>void run(async()=>{await requestIntegration(request,{action:'disconnect',provider});if(provider==='google'){setCalendars(null);setSelected([]);}else setRepos(null);})}>연결 해제</button></>}</div>
      {provider==='google'&&connection?.status==='connected'&&<><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{const result=await requestIntegration<{calendars:CalendarChoice[]}>(request,{action:'calendars'});if(!live.current)return;setCalendars(result.calendars);setSelected(result.calendars.filter(c=>c.selected||connection.config?.calendar_ids?.includes(c.id)).map(c=>c.id));})}>캘린더 선택</button>{calendars&&<div><p>분석할 캘린더만 선택하세요.</p>{calendars.map(calendar=><label key={calendar.id} className="coach-check"><input type="checkbox" disabled={busy} checked={selected.includes(calendar.id)} onChange={e=>setSelected(e.target.checked?[...selected,calendar.id]:selected.filter(id=>id!==calendar.id))}/>{calendar.summary||calendar.title||calendar.id}</label>)}<button className="primary" disabled={busy} onClick={()=>void run(async()=>{await requestIntegration(request,{action:'select_calendars',calendar_ids:selected});})}>캘린더 선택 저장</button></div>}</>}
      {provider==='github'&&connection?.status==='connected'&&<><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{const result=await requestIntegration<{repositories:RepoChoice[]}>(request,{action:'repositories'});if(live.current)setRepos(result.repositories);})}>저장소 선택</button>{repos?.map(repo=>{const saved=state.repositories.find(r=>r.owner===repo.owner&&r.name===repo.name);return <div className="coach-repository" key={`${repo.owner}/${repo.name}`}><strong>{repo.owner}/{repo.name}</strong><small>{repo.private?'비공개':'공개'}</small><label className="coach-check"><input type="checkbox" disabled={busy} checked={Boolean(saved)} onChange={e=>{const checked=e.target.checked;void run(async()=>{await requestIntegration(request,{action:'select_repository',owner:repo.owner,name:repo.name,selected:checked,ai_enabled:false});});}}/>분석 대상에 연결</label>{saved&&<label className="coach-check"><input type="checkbox" disabled={busy} checked={saved.ai_enabled} onChange={e=>{const enabled=e.target.checked;void run(async()=>{await requestIntegration(request,{action:'select_repository',owner:repo.owner,name:repo.name,selected:true,ai_enabled:enabled});});}}/>{repo.private?'비공개 코드 일부의 외부 AI 분석 허용':'외부 AI 분석 허용'}</label>}</div>;})}</>}
    </article>;})}
    {state.repositories.length>0&&<section><h4>연결한 저장소 분석</h4>{state.repositories.map(repo=><details className="coach-repository" key={repo.id}><summary>{repo.owner}/{repo.name} · {repo.analyzed_sha?'분석 기록':'분석 대기'}</summary><p>분석 커밋: {repo.analyzed_sha||'아직 없음'}</p>{repo.analysis.length===0&&<p>아직 표시할 개선 과제가 없습니다.</p>}{repo.analysis.slice(0,3).map((result,index)=><RepositoryAnalysis key={index} value={result} owner={repo.owner} name={repo.name}/>)}</details>)}</section>}
  </div>;
}

function asRecord(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function boundedText(value:unknown,limit=300){return typeof value==='string'?value.slice(0,limit):'';}
function RepositoryAnalysis({value,owner,name}:{value:unknown;owner:string;name:string}){
  const task=asRecord(value),scope=asRecord(task.scope);
  const evidence=Array.isArray(task.evidence)?task.evidence.slice(0,3):[];
  const paths=Array.isArray(scope.paths)?scope.paths.filter((path):path is string=>typeof path==='string').slice(0,12):[];
  const title=boundedText(task.title,160),acceptance=boundedText(task.acceptance,600);
  if(!title)return <p>과제 정보를 확인하지 못했어요. 저장소를 다시 동기화해 주세요.</p>;
  return <article className="coach-recommendation">
    <h4>{title}</h4>
    {typeof task.duration_minutes==='number'&&Number.isFinite(task.duration_minutes)&&<p>예상 시간: {task.duration_minutes}분</p>}
    {acceptance&&<p><strong>완료 기준</strong> {acceptance}</p>}
    <h5>코드에서 확인한 근거</h5>
    {evidence.length===0?<p>표시할 코드 근거가 없습니다.</p>:evidence.map((value,index)=>{
      const reference=asRecord(value),path=boundedText(reference.path,500),sha=boundedText(reference.sha,40);
      const line=typeof reference.line==='number'&&Number.isInteger(reference.line)&&reference.line>0?reference.line:null;
      const excerpt=boundedText(reference.excerpt,600);
      const validPath=path&&!path.startsWith('/')&&!path.split('/').includes('..');
      const href=validPath&&/^[a-f0-9]{7,40}$/i.test(sha)?`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}${line?`#L${line}`:''}`:null;
      return <div className="coach-repository" key={index}>
        {href?<a href={href} target="_blank" rel="noopener noreferrer">{path}{line?` · ${line}번째 줄`:''}</a>:<strong>{path||'파일 경로 확인 필요'}{line?` · ${line}번째 줄`:''}</strong>}
        {sha&&<p>커밋 {sha}</p>}{excerpt&&<pre><code>{excerpt}</code></pre>}
      </div>;
    })}
    <details><summary>분석 범위와 사용 모델</summary>
      <p>{scope.truncated?'저장소 일부를 확인한 결과입니다.':'아래 파일을 기준으로 확인한 결과입니다.'}</p>
      {paths.length>0&&<ul>{paths.map((path,index)=><li key={index}>{path.slice(0,500)}</li>)}</ul>}
      <p>분석 방식: {task.source==='ai'?'AI 코드 분석':'코드 규칙 기반 분석'}</p>
      {boundedText(task.configured_model)&&<p>설정 모델/라우터: {boundedText(task.configured_model,120)}</p>}
      {boundedText(task.model)&&<p>실제 응답 모델: {boundedText(task.model,120)}</p>}
      {boundedText(task.prompt_version)&&<p>분석 버전: {boundedText(task.prompt_version,100)}</p>}
    </details>
  </article>;
}
