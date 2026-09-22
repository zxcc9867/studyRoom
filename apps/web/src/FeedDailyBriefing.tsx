import { useEffect, useRef, useState } from 'react';
import { safeFeedUrl } from './techFeed.mjs';
import type { FeedBriefing, FeedApi } from './techFeedTypes';

export function feedLocalDate(now:Date,timeZone:string):string {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-');
}

// Schedule the next local date boundary, including 23/25-hour DST days, without polling.
export function nextFeedDayDelay(now:Date,timeZone:string):number {
  const date=feedLocalDate(now,timeZone);
  let low=now.getTime(),high=low+36*60*60*1000;
  while(high-low>1000){const mid=Math.floor((low+high)/2);if(feedLocalDate(new Date(mid),timeZone)===date)low=mid;else high=mid;}
  return high-now.getTime()+100;
}

const statusText:Record<FeedBriefing['status'],string>={
  idle:'통계는 자동으로 확인해요. 버튼을 누르면 오늘의 요약과 꼭 읽을 글 최대 3개를 함께 골라드려요.',
  ready:'실제 소개를 바탕으로 정리한 오늘의 읽을거리예요.',
  generating:'같은 계정의 요약을 생성 중이에요. 잠시 후 상태를 확인해 주세요.',
  insufficient:'요약할 소개가 충분한 글이 2건 미만이에요. 아래 원문을 직접 읽어 보세요.',
  quota_exhausted:'오늘의 무료 AI 공유 한도를 모두 사용했어요. 기존 요약과 글은 계속 읽을 수 있어요.',
  unavailable:'AI 요약 연결을 확인하지 못했어요. 통계와 원문을 먼저 읽어 주세요.',
  paused:'소식 수신 또는 서비스가 중지되어 새 요약을 생성하지 않아요.',
};

export function FeedBriefingContent({data,busy,error,onGenerate,onReload}:{data:FeedBriefing|null;busy:boolean;error:string;onGenerate:()=>void;onReload:()=>void}) {
  const status=data?.status || 'idle';
  const generated=data?.generated_at && Number.isFinite(Date.parse(data.generated_at)) ? new Intl.DateTimeFormat('ko-KR',{timeZone:data.time_zone,dateStyle:'short',timeStyle:'short'}).format(new Date(data.generated_at)) : null;
  return <section className="feed-daily-briefing" aria-label="오늘의 기술 브리핑" aria-busy={busy}>
    <header><p className="feed-kicker">DAILY READING NOTE</p><h3>오늘 수집된 내 피드</h3><p>최초 수집 시각 기준 · {data ? `${data.local_date} · ${data.time_zone}` : '날짜와 통계 확인 중'}</p></header>
    {data && <>
      <div className="feed-briefing-totals"><div><strong>{data.total}</strong><span>수집된 글</span></div><div><strong>{data.source_count}</strong><span>출처</span></div></div>
      <div className="feed-briefing-breakdown"><div><h4>콘텐츠 유형</h4><ul>{data.categories.map(item=><li key={item.value}><span>{item.label}</span><strong>{item.count}건</strong></li>)}</ul></div><div><h4>오늘의 주제</h4><ul>{data.topics.map(item=><li key={item.value}><span>{item.label}</span><strong>{item.count}건</strong></li>)}</ul></div></div>
      <p className="feed-budget">한 글이 여러 주제에 포함될 수 있어요. 저장함·목록 필터와 무관한 전체 통계예요.</p>
    </>}
    <p className="feed-briefing-status" role="status">{busy?'오늘의 브리핑을 확인하고 있어요…':data?statusText[status]:error?'통계를 확인하지 못했어요.':'통계를 불러오고 있어요…'}</p>
    {error&&<p className="feed-notice feed-error" role="alert">{error}</p>}
    {data?.stale&&<p className="feed-briefing-stale">새 글이 추가되거나 내용이 바뀌었어요 · 요약 갱신</p>}
    {data&&data.insights.length>0&&<>
      <p className="feed-briefing-sample">전체 {data.total}건 중 소개가 충분한 {data.analyzed_count}건 분석{generated&&<> · <time dateTime={data.generated_at!}>{generated} 생성</time></>}</p>
      <p className="feed-budget">일부 소개에서 확인한 경향이며 전체 업계의 추세를 뜻하지 않아요.</p>
      <section className="feed-highlights" aria-label="오늘 꼭 볼 글">
        <h4>오늘 꼭 볼 글</h4>
        <p className="feed-budget">분석한 소개 중 AI가 고른 읽을거리예요. 원문 전체를 검토한 추천은 아니에요.</p>
        {data.highlights?.length ? <ol>{data.highlights.map((pick,index)=>{const url=safeFeedUrl(pick.source.url);return <li key={pick.source.id} className={index===0?'feed-highlight-primary':''}>
          <p className="feed-highlight-rank">{index===0?'오늘 하나만 읽는다면':`함께 읽을 글 ${index+1}`}</p>
          <h5>{url?<a href={url} target="_blank" rel="noopener noreferrer">{pick.source.title} ↗</a>:pick.source.title}</h5>
          <p><strong>추천 이유</strong> {pick.reason}</p><p><strong>읽을 포인트</strong> {pick.learning}</p>
          {url&&<a className="feed-highlight-link" href={url} target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>}
        </li>;})}</ol>:<p>추천할 만큼 근거가 충분한 글이 없어요. 아래 요약과 원문을 확인해 보세요.</p>}
      </section>
      <ol className="feed-briefing-insights">{data.insights.map((insight,index)=><li key={index}><h4>{insight.title}</h4><p>{insight.body}</p><p className="feed-study-angle"><strong>공부 관점</strong> {insight.study_angle}</p><ul aria-label="근거 원문">{insight.sources.map(source=>{const url=safeFeedUrl(source.url);return <li key={source.id}>{url?<a href={url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>:<span>{source.title}</span>}</li>;})}</ul></li>)}</ol>
    </>}
    <div className="feed-briefing-actions">
      {data&&<button className="primary" type="button" disabled={busy||status==='paused'||status==='generating'||status==='quota_exhausted'||status==='insufficient'} onClick={onGenerate}>{busy?'확인 중…':data.stale?'요약·추천 갱신':status==='ready'?'오늘 요약·추천 다시 보기':'오늘 요약·추천 보기'}</button>}
      {(error||status==='generating'||status==='paused'||status==='quota_exhausted'||status==='insufficient')&&<button className="secondary" type="button" disabled={busy} onClick={onReload}>브리핑 상태 다시 확인</button>}
    </div>
    <p className="feed-budget">요약 생성은 코칭과 하루 무료 AI 호출 한도를 공유해요. 같은 결과 재사용에는 새 AI 호출이 없어요.</p>
  </section>;
}

export function feedBriefingAfterError(data:FeedBriefing|null):FeedBriefing|null {
  return data ? {...data,insights:[],highlights:[],generated_at:null,analyzed_count:0,status:'unavailable'} : null;
}

export function FeedDailyBriefing({api,userId,timeZone,revision}:{api:FeedApi;userId:string;timeZone:string;revision:number}) {
  const [data,setData]=useState<FeedBriefing|null>(null);
  const [dataScope,setDataScope]=useState('');
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const request=useRef(0);
  const scope=useRef<AbortController|null>(null);
  const active=useRef<AbortController|null>(null);
  const lock=useRef(false);
  const generating=useRef(false);
  const queuedRead=useRef(false);
  const previousScope=useRef('');
  const previousRevision=useRef(revision);
  const [day,setDay]=useState(()=>feedLocalDate(new Date(),timeZone));
  const dayRef=useRef(day);
  const scopeKey=userId+':'+timeZone+':'+day;

  async function load(generate:boolean,force=false) {
    if((lock.current&&!force)||!scope.current||scope.current.signal.aborted)return;
    active.current?.abort();
    const controller=new AbortController();active.current=controller;
    const signal=AbortSignal.any([controller.signal,scope.current.signal]);
    const id=++request.current;
    lock.current=true;generating.current=generate;setBusy(true);setError('');
    try{
      const next:FeedBriefing=await api(generate?'briefing_generate':'briefing',{},signal);
      if(signal.aborted||id!==request.current)return;
      setData(next);setDataScope(scopeKey);
    }catch(cause){
      if(signal.aborted||id!==request.current)return;
      // Both read and generate revalidate access. A thrown error may be a 403,
      // so only a valid server DTO can retain previously cited content.
      setData(feedBriefingAfterError);
      setError((cause instanceof Error?cause.message:'브리핑을 확인하지 못했어요. 다시 시도해 주세요.')+' 마지막으로 확인한 통계이며, 최신 내용은 다시 확인해 주세요.');
    }finally{
      if(!signal.aborted&&id===request.current){
        lock.current=false;generating.current=false;setBusy(false);
        if(queuedRead.current){queuedRead.current=false;void loadRef.current(false);}
      }
    }
  }
  const loadRef=useRef(load);
  loadRef.current=load;
  function revalidate(force=false){
    if(generating.current){queuedRead.current=true;return;}
    if(lock.current&&!force)return;
    void loadRef.current(false,force);
  }
  const revalidateRef=useRef(revalidate);
  revalidateRef.current=revalidate;

  useEffect(()=>{
    const controller=new AbortController();scope.current=controller;
    // Same-scope revisions revalidate separately. Never show another owner/day.
    if(previousScope.current!==scopeKey)setData(null);
    previousScope.current=scopeKey;dayRef.current=day;
    setError('');lock.current=false;generating.current=false;queuedRead.current=false;
    previousRevision.current=revision;
    void loadRef.current(false,true);
    return()=>{controller.abort();active.current?.abort();++request.current;queuedRead.current=false;};
    // List filters/view/page are intentionally absent from this lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[api,scopeKey]);

  useEffect(()=>{
    if(previousRevision.current===revision)return;
    previousRevision.current=revision;
    revalidateRef.current(true);
  },[revision]);

  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    let activation:ReturnType<typeof setTimeout>;
    function checkDate(){
      const next=feedLocalDate(new Date(),timeZone);
      if(dayRef.current===next)return false;
      dayRef.current=next;setDay(next);return true;
    }
    function boundary(){
      clearTimeout(timer);checkDate();
      timer=setTimeout(boundary,nextFeedDayDelay(new Date(),timeZone));
    }
    function reactivate(){
      if(document.visibilityState!=='visible')return;
      clearTimeout(activation);
      activation=setTimeout(()=>{
        const changed=checkDate();boundary();
        if(!changed)revalidateRef.current();
      },150);
    }
    boundary();window.addEventListener('focus',reactivate);document.addEventListener('visibilitychange',reactivate);
    return()=>{clearTimeout(timer);clearTimeout(activation);window.removeEventListener('focus',reactivate);document.removeEventListener('visibilitychange',reactivate);};
  },[timeZone]);
  return <FeedBriefingContent data={dataScope===scopeKey?data:null} busy={busy} error={error} onGenerate={()=>void load(true)} onReload={()=>void load(false)}/>;
}
