import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {manualRefreshMessage,refreshFeedNow} from './techFeed.mjs';
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Leaf, Plus, RefreshCw, Rss, Settings2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyPreferenceResponse, createTechFeedClient, currentFeedState, feedSourceHost, FEED_CATEGORIES, FEED_INTERESTS, interestSavePayload, isCurrentFeedRequest, isRevisionConflict, mergeFeedPage, preferenceRefreshResult, receivingPayload, safeFeedUrl, summaryLabel } from './techFeed.mjs';
import type { FeedArticle, FeedPage, FeedPreferenceResponse, FeedPreview, FeedState } from './techFeedTypes';
import { FeedInterestSettings } from './FeedInterestSettings';
import { feedExcerptView, feedPageView } from './feedPresentation.mjs';
import {cleanFeedIntroduction,feedContentKind} from '../../../packages/core/src/feedContent.mjs';
import './techFeed.css';

type Props = {supabase:SupabaseClient;userId:string;timeZone:string;onPlan:(article:FeedArticle)=>void;linkedTodo?:{userId:string;articleId:string;todoId:string}|null};
export function FeedArticleCard({article,onSave,onPlan,busy,timeZone}:{article:FeedArticle;onSave:()=>void;onPlan:()=>void;busy:boolean;timeZone:string}) {
  const [expanded,setExpanded] = useState(false);
  const contentId = useId();
  const translated = article.translation_status === 'ready' && Boolean(article.title_ko?.trim()) && typeof article.excerpt_ko === 'string';
  const link = safeFeedUrl(article.url);
  const host = feedSourceHost(article.url);
  const sourceNames = article.origin === 'web_search' ? ['웹 검색',host] : [...article.sources.map(source=>source.name),host];
  const sourceLine = [...new Set(sourceNames.filter(Boolean))].join(' · ');
  const date = article.published_at || article.discovered_at;
  const time = date && Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat('ko-KR', {timeZone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date)) : '날짜 미확인';
  const video = feedContentKind(article.url) === 'video';
  const hasSummary = !video && article.summary_status === 'ready' && Boolean(article.summary);
  const excerpt = feedExcerptView(video ? '' : cleanFeedIntroduction(hasSummary ? article.summary!.technology : (translated ? article.excerpt_ko : article.excerpt)));
  const tags = [...new Set([...(article.matched_topics || []),...article.interests.map(id=>FEED_INTERESTS.find(([key])=>key===id)?.[1] || '').filter(Boolean)])].slice(0,2);
  const sourceName = article.sources[0]?.name || host || '기술 소식';
  const expandable = excerpt.expandable || hasSummary;
  return <article className="feed-card">
    <header className="feed-author">
      <span className="feed-avatar" aria-hidden="true">{Array.from(sourceName.replace(/^www\./,'')).slice(0,2).join('').toUpperCase()}</span>
      <div className="feed-author-info"><strong>{sourceName}</strong><div className="feed-card-meta"><time dateTime={date}>{article.published_at ? '' : '발견 '} {time}</time><span>{article.category ? FEED_CATEGORIES[article.category] : '미분류'}</span></div></div>
      {article.saved && <Bookmark className="feed-saved-mark" size={17} aria-label="저장한 글" fill="currentColor"/>}
    </header>
    <div className="feed-card-body">
      {tags.length>0 && <div className="feed-topic-tags">{tags.map(tag=><span key={tag}># {tag}</span>)}</div>}
      <h3>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{translated ? article.title_ko : article.title}</a> : (translated ? article.title_ko : article.title)}</h3>
      <div id={contentId}>
        {expanded && hasSummary ? <dl className="feed-summary">
          <div><dt>어떤 기술인가요</dt><dd>{cleanFeedIntroduction(article.summary!.technology)}</dd></div>
          <div><dt>핵심 변화</dt><dd>{cleanFeedIntroduction(article.summary!.change)}</dd></div>
          <div><dt>이럴 때 살펴보세요</dt><dd>{cleanFeedIntroduction(article.summary!.usage)}</dd></div>
        </dl> : <p className="feed-excerpt">{(expanded ? excerpt.full : excerpt.preview) || (video ? '영상 자료입니다. 시간표·출연자 목록은 소개에서 제외했어요. 내용은 원문에서 확인해 주세요.' : '충분한 글 소개가 없어 내용을 추측하지 않았어요. 원문에서 자세히 읽어 보세요.')}</p>}
      </div>
      {expandable && <button type="button" className="feed-expand" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpanded(value=>!value)}>{expanded?'내용 접기':hasSummary?'AI 요약 펼치기':'내용 더 보기'}<ChevronRight size={14}/></button>}
      {link && <div className="feed-citation"><span>{article.origin === 'web_search' ? '검색 소개 출처' : '발췌 출처'}</span><a href={link} target="_blank" rel="noopener noreferrer">{host || sourceName}<ExternalLink size={15}/></a></div>}
      <div className="feed-evidence"><p>{video ? '영상 원문 링크 · 본문 요약 없음' : summaryLabel(article)}</p><p>{translated ? 'DeepL 자동 번역 · 원문 확인 권장' : '한국어 번역 대기 · 원문 표시'}</p></div>
      {translated && !video && <details className="feed-original-text"><summary>원문 텍스트 보기</summary><p>{article.title}</p><p>{cleanFeedIntroduction(article.excerpt)}</p></details>}
      <p className="feed-sources">{sourceLine}</p>
      <div className="feed-card-actions">
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="feed-original"><ExternalLink size={17}/> 원문 읽기</a>}
        <button type="button" className="secondary" aria-pressed={article.saved} disabled={busy} onClick={onSave}><Bookmark size={17} fill={article.saved?'currentColor':'none'}/>{article.saved?'저장됨':'저장'}</button>
        <button type="button" className="secondary feed-study-action" disabled={busy || Boolean(article.todo_id)} onClick={onPlan}><BookOpen size={17}/>{article.todo_id?'할 일에 추가됨':'공부할 일에 추가'}</button>
      </div>
    </div>
  </article>;
}

export function FeedPagination({page,numbers,hasNext,busy,onPage}:{page:number;numbers:number[];hasNext:boolean;busy:boolean;onPage:(page:number)=>void}) {
  return <nav className="feed-pagination" aria-label="피드 페이지">
    <button className="secondary" type="button" disabled={busy||page===1} aria-label="이전 페이지" onClick={()=>onPage(page-1)}><ChevronLeft size={18}/><span>이전</span></button>
    <div className="feed-page-numbers">{numbers.map(number=><button className="secondary" type="button" key={number} disabled={busy} aria-label={number+'페이지'} aria-current={number===page?'page':undefined} onClick={()=>onPage(number)}>{number}</button>)}</div>
    <button className="secondary" type="button" disabled={busy||!hasNext} aria-label="다음 페이지" onClick={()=>onPage(page+1)}><span>다음</span><ChevronRight size={18}/></button>
  </nav>;
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
  const [pageNumber,setPageNumber] = useState(1);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const pageHeading = useRef<HTMLHeadingElement|null>(null);
  const focusPage = useRef(false);
  const pageView = feedPageView(articles,pageNumber,cursor,view==='saved');
  useEffect(()=>{
    if(focusPage.current){focusPage.current=false;pageHeading.current?.focus({preventScroll:true});pageHeading.current?.scrollIntoView({block:'start'});}
  },[pageView.page,articles]);
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
    setPageNumber(1);
    setSettingsOpen(false);
    focusPage.current=false;
    setView('latest');setInterest('');
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
    setLoading(true); setError(''); setCursor(null); setArticles([]); setPageNumber(1);
    void (async()=>{
      try {
        const next:FeedState = await api('state',{},controller.signal);
        if (request !== generation.current) return;
        setState(next);setStateOwner(userId);
        if(!next.preferences.prompt) setSettingsOpen(true);
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
  async function goToPage(target:number) {
    if(loading || actionLock.current || target<1 || target===pageView.page)return;
    if(target<=pageView.loadedPages){
      focusPage.current=true;setPageNumber(target);return;
    }
    if(!cursor || target!==pageView.page+1)return;
    const request=generation.current;
    await action('page',async()=>{
      const next:FeedPage=await api('list',{view,interest:interest||undefined,source_id:source||undefined,cursor},lifetime.current?.signal);
      if(request!==generation.current)return;
      const merged=mergeFeedPage(articles,next.items);
      focusPage.current=true;
      setArticles(merged);setCursor(next.next_cursor);
      setPageNumber(feedPageView(merged,target,next.next_cursor,view==='saved').page);
    });
  }
  function save(article:FeedArticle) {
    const request=settingsGeneration.current;
    void action(article.id,async()=>{
      await api('save',{article_id:article.id,saved:!article.saved},lifetime.current?.signal);
      if(request!==settingsGeneration.current)return;
      setArticles(current=>current.map(item=>item.id===article.id?{...item,saved:!article.saved}:item));
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
      <details className="feed-settings-panel" open={settingsOpen || preferenceConflict} onToggle={event=>setSettingsOpen(event.currentTarget.open)}><summary><Settings2 size={17}/><span>내 관심 소식 설정<small>{state.preferences.prompt || '어떤 기술 소식을 받아볼까요?'}</small></span><ChevronRight size={17}/></summary>
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
      </details>
      <div className="feed-toolbar"><div className="feed-tabs" aria-label="피드 보기">{(['latest','saved'] as const).map(tab=><button key={tab} type="button" aria-pressed={view===tab} disabled={Boolean(busy)} onClick={()=>setView(tab)}>{tab==='latest'?'최신':'저장'}</button>)}</div><button className="secondary" type="button" disabled={loading||Boolean(busy)} aria-busy={busy==='refresh'} onClick={refreshNow}><RefreshCw size={16}/>{busy==='refresh'?'새 소식 찾는 중…':'새 글 확인'}</button></div>
      <div className="feed-filters"><label>관심 분야<select value={interest} onChange={e=>setInterest(e.target.value)} disabled={Boolean(busy)}><option value="">전체 분야</option>{FEED_INTERESTS.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>출처<select value={source} onChange={e=>setSource(e.target.value)} disabled={Boolean(busy)}><option value="">전체 출처</option>{state.sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <details className="feed-collection-status"><summary>수집·번역 상태와 출처 관리<ChevronRight size={15}/></summary>
      <details className="feed-subscriptions"><summary><Settings2 size={17}/>고급 설정: 수집 출처 <span>{state.sources.filter(item=>item.subscribed).length}개 구독</span></summary>
        <fieldset disabled={Boolean(busy)}><legend>관심 분야를 골라 주세요</legend><div className="feed-interest-options">{FEED_INTERESTS.map(([id,label])=><label key={id}><input type="checkbox" checked={state.interests.includes(id)} onChange={()=>void action('interests',async()=>{const interests=state.interests.includes(id)?state.interests.filter(i=>i!==id):[...state.interests,id];await api('interests',{interests},lifetime.current?.signal);setState(s=>s?{...s,interests}:s);setRevision(n=>n+1);})}/>{label}</label>)}</div></fieldset>
        <div className="feed-source-options">{state.sources.map(item=><label key={item.id}><input type="checkbox" checked={item.subscribed} disabled={Boolean(busy)||item.permission_status==='blocked'} onChange={()=>void action(item.id,async()=>{await api('subscribe',{source_id:item.id,subscribed:!item.subscribed},lifetime.current?.signal);setRevision(n=>n+1);})}/><span><strong>{item.name}</strong><small>{item.permission_status==='approved'?'공개 소스':item.permission_status==='pending'?'이용 조건 확인 중 · 자동 수집 대기':'수집 중지'}{item.last_error?' · 최근 수집 실패':''}</small></span></label>)}</div>
        <form className="feed-add-source" onSubmit={inspect}><label htmlFor="feed-url">공개 RSS·Atom 주소 추가</label><div><input id="feed-url" type="url" required placeholder="https://example.com/feed.xml" value={feedUrl} onChange={e=>{setFeedUrl(e.target.value);setPreview(null);}} disabled={Boolean(busy)}/><button className="secondary" disabled={Boolean(busy)}><Rss size={16}/>미리 보기</button></div><small>로그인이 필요 없는 주소만 지원해요. 최대 10개 · 이용 조건 확인 후 자동 수집됩니다.</small></form>
        {preview && <div className="feed-preview"><h3>{preview.name}</h3><ul>{preview.items.slice(0,3).map((item,i)=><li key={`${item.url}-${i}`}>{item.title}</li>)}</ul><button className="primary" type="button" disabled={Boolean(busy)} onClick={()=>void action('add',async()=>{await api('add_source',{url:preview.url},lifetime.current?.signal);setPreview(null);setFeedUrl('');setNotice('구독을 등록했어요. 이용 조건 확인 후 자동 수집이 시작됩니다.');setRevision(n=>n+1);})}><Plus size={16}/>이 소스 구독</button></div>}
      </details>
      <p className="feed-sync">{!state.service_available?'현재 새 소식 수집 중지':state.sources.filter(item=>item.subscribed&&item.permission_status==='approved').length>0?`승인된 RSS/API 출처 ${state.sources.filter(item=>item.subscribed&&item.permission_status==='approved').length}곳 설정됨`:'현재 수집 가능한 RSS/API 출처 없음'} · {state.last_success_at ? `마지막 RSS/API 성공 ${new Intl.DateTimeFormat('ko-KR',{timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(state.last_success_at))}` : 'RSS/API 성공 기록 없음'}{failures.length>0&&` · ${failures.length}개 소스 재시도 대기`}</p>
      <p className="feed-budget">{state.translation_service === 'not_configured' ? '한국어 번역 연결 준비 중 · 현재 원문으로 표시합니다.' : state.translation_service === 'quota_exhausted' ? '무료 번역 한도에 도달했어요. 기존 번역은 유지하고 새 번역은 대기합니다.' : state.translation_service === 'unavailable' ? '번역 연결을 확인하고 있어요. 원문을 먼저 읽어 주세요.' : state.translation_service === 'paused' ? '자동 번역이 일시 중지되어 있어요.' : '제목·소개는 무료 한도 내에서 순차적으로 한국어 번역해요. 번역과 AI 요약은 별도로 처리됩니다.'}</p>
      <p className="feed-budget">무료 AI 한도 내에서 요약해요. 요약이 없는 글도 출처 소개와 원문으로 읽을 수 있어요.</p>
      </details>
    </>}
    {state?.enabled && !loading && <div className="feed-page-heading"><h3 ref={pageHeading} tabIndex={-1}>{view==='saved'?'저장한 발견':'새로운 발견'} <span>{pageView.page}페이지</span></h3><p>한 페이지에 20개씩</p></div>}
    {loading ? <p className="feed-empty" role="status">새로운 배움을 불러오고 있어요…</p> : state?.enabled && pageView.items.length===0 && !error ? <div className="feed-empty"><BookOpen size={32}/><h3>{view==='saved'?(cursor?'이 페이지의 저장한 글을 모두 읽었어요':'나중에 읽을 글을 모아 보세요'):'아직 도착한 소식이 없어요'}</h3><p>{view==='saved'?(cursor?'다음 페이지에서 저장한 글을 이어서 확인해 주세요.':'관심 있는 글의 저장 버튼을 눌러 주세요.'):'구독과 수집 상태를 확인하거나 다른 필터를 선택해 주세요.'}</p></div> : <div className="feed-list" aria-busy={busy==='page'}>{(state?.enabled?pageView.items:[]).map(article=><FeedArticleCard key={article.id} article={article} timeZone={timeZone} busy={Boolean(busy)} onSave={()=>save(article)} onPlan={()=>onPlan(article)}/>)}</div>}
    {state?.enabled && (articles.length>0 || cursor) && !loading && <><FeedPagination page={pageView.page} numbers={pageView.numbers} hasNext={pageView.hasNext} busy={Boolean(busy)} onPage={number=>void goToPage(number)}/><p className="feed-page-status" role="status">{busy==='page'?'다음 페이지를 불러오는 중…':pageView.hasNext?'다음 페이지에서 더 많은 소식을 읽어 보세요.':'마지막 페이지예요. 새 글 확인으로 소식을 찾아보세요.'}</p></>}
    </>}
  </section>;
}
