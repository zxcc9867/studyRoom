import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {manualRefreshMessage,refreshFeedNow} from './techFeed.mjs';
import { Bookmark, BookOpen, ExternalLink, Leaf, Plus, RefreshCw, Rss, Settings2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyPreferenceResponse, createTechFeedClient, currentFeedState, feedSourceHost, FEED_CATEGORIES, FEED_INTERESTS, interestSavePayload, isCurrentFeedRequest, isRevisionConflict, mergeFeedPage, preferenceRefreshResult, receivingPayload, safeFeedUrl, summaryLabel } from './techFeed.mjs';
import type { FeedArticle, FeedPage, FeedPreferenceResponse, FeedPreview, FeedState } from './techFeedTypes';
import { FeedInterestSettings } from './FeedInterestSettings';
import './techFeed.css';

type Props = {supabase:SupabaseClient;userId:string;timeZone:string;onPlan:(article:FeedArticle)=>void;linkedTodo?:{userId:string;articleId:string;todoId:string}|null};
export function FeedArticleCard({article,onSave,onPlan,busy,timeZone}:{article:FeedArticle;onSave:()=>void;onPlan:()=>void;busy:boolean;timeZone:string}) {
  const link = safeFeedUrl(article.url);
  const host = feedSourceHost(article.url);
  const sourceNames = article.origin === 'web_search' ? ['웹 검색',host] : [...article.sources.map(source=>source.name),host];
  const sourceLine = [...new Set(sourceNames.filter(Boolean))].join(' · ');
  const date = article.published_at || article.discovered_at;
  const time = date && Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat('ko-KR', {timeZone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date)) : '날짜 미확인';
  return <article className="feed-card">
    <div className="feed-card-meta"><span>{article.category ? FEED_CATEGORIES[article.category] : '미분류'}</span><time dateTime={date}>{article.published_at ? '' : '발견 '} {time}</time></div>
    <h3>{article.title}</h3>
    <p className="feed-sources">{sourceLine}</p>
    <p className="feed-provenance">{summaryLabel(article)}</p>
    {article.summary_status === 'ready' && article.summary ? <dl className="feed-summary">
      <div><dt>어떤 기술인가요</dt><dd>{article.summary.technology}</dd></div>
      <div><dt>핵심 변화</dt><dd>{article.summary.change}</dd></div>
      <div><dt>이럴 때 살펴보세요</dt><dd>{article.summary.usage}</dd></div>
    </dl> : <p className="feed-excerpt">{article.excerpt || '소개가 짧아 요약하지 않았어요. 원문에서 자세한 내용을 확인해 보세요.'}</p>}
    <div className="feed-card-actions">
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="feed-original"><ExternalLink size={16}/> 원문 읽기</a>}
      <button type="button" className="secondary" aria-pressed={article.saved} disabled={busy} onClick={onSave}><Bookmark size={16} fill={article.saved?'currentColor':'none'}/>{article.saved?'저장됨':'저장'}</button>
      <button type="button" className="secondary" disabled={busy || Boolean(article.todo_id)} onClick={onPlan}><BookOpen size={16}/>{article.todo_id?'할 일에 추가됨':'공부할 일에 추가'}</button>
    </div>
  </article>;
}

export default function TechFeed({supabase,userId,timeZone,onPlan,linkedTodo=null}:Props) {
  const api = useMemo(()=>createTechFeedClient(supabase,userId),[supabase,userId]);
  const [loadedState,setState] = useState<FeedState|null>(null);
  const [stateOwner,setStateOwner] = useState('');
  const [articles,setArticles] = useState<FeedArticle[]>([]);
  const [view,setView] = useState<'latest'|'saved'>('latest');
  const [interest,setInterest] = useState('');
  const [source,setSource] = useState('');
  const [cursor,setCursor] = useState<string|null>(null);
  const [interestDraft,setInterestDraft] = useState('');
  const [preferenceConflict,setPreferenceConflict] = useState(false);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [revision,setRevision] = useState(0);
  const [feedUrl,setFeedUrl] = useState('');
  const [preview,setPreview] = useState<FeedPreview|null>(null);
  const generation = useRef(0);
  const actionLock = useRef(false);
  const lifetime = useRef<AbortController|null>(null);
  const interestDraftDirty = useRef(false);
  const settingsGeneration = useRef(0);
  useEffect(()=>{
    const controller=new AbortController();
    lifetime.current=controller;
    ++settingsGeneration.current;
    setStateOwner('');
    setState(null);
    setArticles([]);
    setCursor(null);
    setSource('');
    setFeedUrl('');
    setPreview(null);
    setLoading(true);
    interestDraftDirty.current=false;
    setInterestDraft('');
    setPreferenceConflict(false);
    actionLock.current=false;
    setBusy('');
    setError('');
    setNotice('');
    return()=>controller.abort();
  },[userId]);
  useEffect(()=>{
    if(linkedTodo?.userId===userId)setArticles(current=>current.map(item=>item.id===linkedTodo.articleId?{...item,todo_id:linkedTodo.todoId}:item));
  },[linkedTodo,userId]);

  useEffect(()=>{
    const controller = new AbortController(); const request = ++generation.current;
    setLoading(true); setError(''); setCursor(null); setArticles([]);
    void (async()=>{
      try {
        const next:FeedState = await api('state',{},controller.signal);
        if (request !== generation.current) return;
        setState(next);setStateOwner(userId);
        if (!interestDraftDirty.current) setInterestDraft(next.preferences.prompt);
        if (!next.enabled) return;
        const page:FeedPage = await api('list',{view,interest:interest || undefined,source_id:source || undefined},controller.signal);
        if (request !== generation.current) return;
        setArticles(page.items);setCursor(page.next_cursor);
      } catch(e) {if(!controller.signal.aborted && request===generation.current)setError(e instanceof Error?e.message:'피드를 불러오지 못했어요.');}
      finally {if(!controller.signal.aborted && request===generation.current)setLoading(false);}
    })();
    return ()=>{controller.abort();++generation.current;};
  },[api,view,interest,source,revision]);

  async function action(key:string, work:()=>Promise<void>) {
    if(actionLock.current) return;
    const request=settingsGeneration.current;
    const controller=lifetime.current;
    actionLock.current=true;setBusy(key);setError('');setNotice('');
    try {await work();}
    catch(e){if(isCurrentFeedRequest(request,settingsGeneration.current,controller?.signal))setError(e instanceof Error?e.message:'요청을 처리하지 못했어요.');}
    finally {
      if(isCurrentFeedRequest(request,settingsGeneration.current,controller?.signal)){actionLock.current=false;setBusy('');}
    }
  }
  async function latestPreferencesAfterConflict(request:number,previousPrompt:string) {
    const latest:FeedState=await api('state',{},lifetime.current?.signal);
    if(request!==settingsGeneration.current)return;
    const refresh=preferenceRefreshResult(previousPrompt,latest,articles,cursor);
    setState(refresh.state);
    setStateOwner(userId);
    setArticles(refresh.articles);
    setCursor(refresh.cursor);
    setPreferenceConflict(true);
    if(refresh.resetFeed)setRevision(value=>value+1);
  }
  function changeInterestDraft(value:string) {
    interestDraftDirty.current=true;
    setInterestDraft(value);
  }
  function saveInterest() {
    if(!state)return;
    const request=settingsGeneration.current;
    void action('interest-settings',async()=>{
      try {
        const payload=interestSavePayload(state.preferences,interestDraft);
        const response:FeedPreferenceResponse=await api('topics_save',payload,lifetime.current?.signal);
        if(request!==settingsGeneration.current)return;
        setState(current=>current?applyPreferenceResponse(current,response):current);
        interestDraftDirty.current=false;
        setInterestDraft(response.preferences.prompt);
        setPreferenceConflict(false);
        setNotice(state.preferences.prompt?'관심 내용을 변경했어요. 새 주제의 첫 결과를 기다려 주세요.':'관심 소식 받기를 시작했어요.');
        setCursor(null);
        setRevision(value=>value+1);
      } catch(nextError) {
        if(!isRevisionConflict(nextError))throw nextError;
        await latestPreferencesAfterConflict(request,state.preferences.prompt);
      }
    });
  }
  function changeReceiving(receiving:boolean) {
    if(!state)return;
    const request=settingsGeneration.current;
    void action('interest-settings',async()=>{
      try {
        await api('receiving',receivingPayload(state.preferences,receiving),lifetime.current?.signal);
        const latest:FeedState=await api('state',{},lifetime.current?.signal);
        if(request!==settingsGeneration.current)return;
        const refresh=preferenceRefreshResult(state.preferences.prompt,latest,articles,cursor);
        setState(refresh.state);
        setStateOwner(userId);
        setArticles(refresh.articles);
        setCursor(refresh.cursor);
        if(refresh.resetFeed)setRevision(value=>value+1);
        setPreferenceConflict(false);
        setNotice(receiving?'관심 소식 받기를 다시 시작했어요. 저장된 소식은 그대로 이어집니다.':'관심 소식 수신을 잠시 멈췄어요. 저장한 글과 공부할 일은 그대로예요.');
      } catch(nextError) {
        if(!isRevisionConflict(nextError))throw nextError;
        await latestPreferencesAfterConflict(request,state.preferences.prompt);
      }
    });
  }
  function retryInterest() {
    saveInterest();
  }
  function refreshNow() {
    if(!state)return;
    const request=settingsGeneration.current;
    const signal=lifetime.current?.signal;
    void action('refresh',async()=>{
      try{
        const result=await refreshFeedNow(api,state.preferences.revision,{signal});
        if(!isCurrentFeedRequest(request,settingsGeneration.current,signal))return;
        setNotice(manualRefreshMessage(result));
        setRevision(value=>value+1);
      }catch(nextError){
        if(!isRevisionConflict(nextError))throw nextError;
        await latestPreferencesAfterConflict(request,state.preferences.prompt);
      }
    });
  }
  async function loadMore() {
    const request=generation.current;
    await action('more',async()=>{
      const page:FeedPage=await api('list',{view,interest:interest||undefined,source_id:source||undefined,cursor},lifetime.current?.signal);
      if(request!==generation.current)return;
      setArticles(current=>mergeFeedPage(current,page.items));setCursor(page.next_cursor);
    });
  }
  function save(article:FeedArticle) {
    void action(article.id,async()=>{
      await api('save',{article_id:article.id,saved:!article.saved},lifetime.current?.signal);
      setArticles(current=>view==='saved'&&article.saved?current.filter(item=>item.id!==article.id):current.map(item=>item.id===article.id?{...item,saved:!article.saved}:item));
      setNotice(article.saved?'저장을 해제했어요.':'다른 기기에서도 볼 수 있도록 저장했어요.');
    });
  }
  async function inspect(event:FormEvent) {
    event.preventDefault();setPreview(null);
    await action('preview',async()=>{const next:FeedPreview=await api('preview',{url:feedUrl},lifetime.current?.signal);setPreview(next);});
  }
  const state=currentFeedState(loadedState,stateOwner,userId);
  const failures=state?.sources.filter(item=>item.subscribed&&item.last_error) || [];
  return <section className="tech-feed" aria-labelledby="tech-feed-title">
    <header className="feed-header"><div><p className="eyebrow">THE LEARNING POST</p><h2 id="tech-feed-title">오늘의 발견, 내일의 공부.</h2><p>작은 소식을 모아, 나의 배움으로 이어가요.</p></div><span className="feed-seal" aria-hidden="true"><Leaf size={32}/><small>TECH<br/>FEED</small></span></header>
    {error && <div className="feed-notice feed-error" role="alert">{error}<button type="button" className="secondary" disabled={loading||Boolean(busy)} onClick={()=>setRevision(n=>n+1)}>다시 시도</button></div>}
    {notice && <p className="feed-notice" role="status">{notice}</p>}
    {!loading && state && !state.enabled ? <div className="feed-empty"><Rss size={32}/><h3>기술 피드를 준비하고 있어요</h3><p>현재는 승인된 파일럿 계정에서만 사용할 수 있어요. 기존 공부 기능은 그대로 이용해 주세요.</p></div> : <>
    {state?.enabled && <>
      <FeedInterestSettings
        preferences={state.preferences}
        searchStatus={state.search_status}
        serviceAvailable={state.service_available}
        draft={interestDraft}
        busy={Boolean(busy)}
        conflict={preferenceConflict}
        onDraftChange={changeInterestDraft}
        onSave={saveInterest}
        onReceivingChange={changeReceiving}
        onRetry={retryInterest}
      />
      <div className="feed-toolbar"><div className="feed-tabs" aria-label="피드 보기">{(['latest','saved'] as const).map(tab=><button key={tab} type="button" aria-pressed={view===tab} disabled={Boolean(busy)} onClick={()=>setView(tab)}>{tab==='latest'?'최신':'저장'}</button>)}</div><button className="secondary" type="button" disabled={loading||Boolean(busy)} aria-busy={busy==='refresh'} onClick={refreshNow}><RefreshCw size={16}/>{busy==='refresh'?'새 소식 찾는 중…':'새 글 확인'}</button></div>
      <div className="feed-filters"><label>관심 분야<select value={interest} onChange={e=>setInterest(e.target.value)} disabled={Boolean(busy)}><option value="">전체 분야</option>{FEED_INTERESTS.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>출처<select value={source} onChange={e=>setSource(e.target.value)} disabled={Boolean(busy)}><option value="">전체 출처</option>{state.sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <details className="feed-subscriptions"><summary><Settings2 size={17}/>고급 설정: 수집 출처 <span>{state.sources.filter(item=>item.subscribed).length}개 구독</span></summary>
        <fieldset disabled={Boolean(busy)}><legend>관심 분야를 골라 주세요</legend><div className="feed-interest-options">{FEED_INTERESTS.map(([id,label])=><label key={id}><input type="checkbox" checked={state.interests.includes(id)} onChange={()=>void action('interests',async()=>{const interests=state.interests.includes(id)?state.interests.filter(i=>i!==id):[...state.interests,id];await api('interests',{interests},lifetime.current?.signal);setState(s=>s?{...s,interests}:s);setRevision(n=>n+1);})}/>{label}</label>)}</div></fieldset>
        <div className="feed-source-options">{state.sources.map(item=><label key={item.id}><input type="checkbox" checked={item.subscribed} disabled={Boolean(busy)||item.permission_status==='blocked'} onChange={()=>void action(item.id,async()=>{await api('subscribe',{source_id:item.id,subscribed:!item.subscribed},lifetime.current?.signal);setRevision(n=>n+1);})}/><span><strong>{item.name}</strong><small>{item.permission_status==='approved'?'공개 소스':item.permission_status==='pending'?'이용 조건 확인 중 · 자동 수집 대기':'수집 중지'}{item.last_error?' · 최근 수집 실패':''}</small></span></label>)}</div>
        <form className="feed-add-source" onSubmit={inspect}><label htmlFor="feed-url">공개 RSS·Atom 주소 추가</label><div><input id="feed-url" type="url" required placeholder="https://example.com/feed.xml" value={feedUrl} onChange={e=>{setFeedUrl(e.target.value);setPreview(null);}} disabled={Boolean(busy)}/><button className="secondary" disabled={Boolean(busy)}><Rss size={16}/>미리 보기</button></div><small>로그인이 필요 없는 주소만 지원해요. 최대 10개 · 이용 조건 확인 후 자동 수집됩니다.</small></form>
        {preview && <div className="feed-preview"><h3>{preview.name}</h3><ul>{preview.items.slice(0,3).map((item,i)=><li key={`${item.url}-${i}`}>{item.title}</li>)}</ul><button className="primary" type="button" disabled={Boolean(busy)} onClick={()=>void action('add',async()=>{await api('add_source',{url:preview.url},lifetime.current?.signal);setPreview(null);setFeedUrl('');setNotice('구독을 등록했어요. 이용 조건 확인 후 자동 수집이 시작됩니다.');setRevision(n=>n+1);})}><Plus size={16}/>이 소스 구독</button></div>}
      </details>
      <p className="feed-sync">{!state.service_available?'현재 새 소식 수집 중지':state.sources.filter(item=>item.subscribed&&item.permission_status==='approved').length>0?`승인된 RSS/API 출처 ${state.sources.filter(item=>item.subscribed&&item.permission_status==='approved').length}곳 설정됨`:'현재 수집 가능한 RSS/API 출처 없음'} · {state.last_success_at ? `마지막 RSS/API 성공 ${new Intl.DateTimeFormat('ko-KR',{timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(state.last_success_at))}` : 'RSS/API 성공 기록 없음'}{failures.length>0&&` · ${failures.length}개 소스 재시도 대기`}</p>
      <p className="feed-budget">무료 AI 한도 내에서 요약해요. 요약이 없는 글도 출처 소개와 원문으로 읽을 수 있어요.</p>
    </>}
    {loading ? <p className="feed-empty" role="status">새로운 배움을 불러오고 있어요…</p> : state?.enabled && articles.length===0 && !error ? <div className="feed-empty"><BookOpen size={32}/><h3>{view==='saved'?'나중에 읽을 글을 모아 보세요':'아직 도착한 소식이 없어요'}</h3><p>{view==='saved'?'관심 있는 글의 저장 버튼을 눌러 주세요.':'구독과 수집 상태를 확인하거나 다른 필터를 선택해 주세요.'}</p></div> : <div className="feed-list">{articles.map(article=><FeedArticleCard key={article.id} article={article} timeZone={timeZone} busy={Boolean(busy)} onSave={()=>save(article)} onPlan={()=>onPlan(article)}/>)}</div>}
    {state && cursor && !loading && <button className="secondary feed-more" disabled={Boolean(busy)} type="button" onClick={()=>void loadMore()}>{busy==='more'?'불러오는 중…':'이전 소식 더 보기'}</button>}
    </>}
  </section>;
}
