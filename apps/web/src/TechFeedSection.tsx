import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {manualRefreshMessage,refreshFeedNow} from './techFeed.mjs';
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Leaf, Plus, RefreshCw, Rss, Settings2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyPreferenceResponse, createTechFeedClient, currentFeedState, feedSourceHost, FEED_CATEGORIES, interestSavePayload, isCurrentFeedRequest, isRevisionConflict, mergeFeedPage, preferenceRefreshResult, receivingPayload, safeFeedUrl, summaryLabel } from './techFeed.mjs';
import type { FeedArticle, FeedFacets, FeedPage, FeedPreferenceResponse, FeedPreview, FeedState } from './techFeedTypes';
import { FeedInterestSettings } from './FeedInterestSettings';
import { feedContinuousView, feedExcerptView, feedStructuredIntroduction } from './feedPresentation.mjs';
import {feedContentKind} from '../../../packages/core/src/feedContent.mjs';
import {FeedArticleMedia} from './FeedArticleMedia';
import {classifyFeedArticle,feedTopicTags} from '../../../packages/core/src/feedClassification.mjs';
import {FeedArticleText} from './FeedArticleText';
import {FeedDailyBriefing} from './FeedDailyBriefing';
import {FeedViewFilters} from './FeedViewFilters';
import {feedOriginalLanguage,FEED_LANGUAGE_LABELS} from '../../../packages/core/src/feedLanguage.mjs';
import './techFeed.css';

type Props = {supabase:SupabaseClient;userId:string;timeZone:string;onPlan:(article:FeedArticle)=>void;linkedTodo?:{userId:string;articleId:string;todoId:string}|null};
export function FeedArticleCard({article,onSave,onPlan,busy,timeZone,translationService}:{article:FeedArticle;onSave:()=>void;onPlan:()=>void;busy:boolean;timeZone:string;translationService?:FeedState['translation_service']}) {
  const [expanded,setExpanded] = useState(false);
  const contentId = useId();
  const originalLanguage = feedOriginalLanguage(article.title,article.excerpt);
  const translated = originalLanguage !== 'ko' && article.translation_status === 'ready' && Boolean(article.title_ko?.trim()) && typeof article.excerpt_ko === 'string';
  const translationNotice = originalLanguage==='ko' ? '한국어로 작성된 원문' : translated ? 'DeepL 자동 번역 · 원문 확인 권장' : `${translationService==='quota_exhausted'?'무료 번역 한도에 도달':translationService==='paused'?'한국어 번역 일시 중지':translationService==='unavailable'?'번역 서비스 확인 필요':translationService==='not_configured'?'한국어 번역 미연결':originalLanguage==='en'?'한국어 번역 대기':'원문 언어 확인 필요 · 번역 대기'} · ${originalLanguage==='en'?'영어 원문 표시':'원문 표시'}`;
  const link = safeFeedUrl(article.url);
  const host = feedSourceHost(article.url);
  const sourceNames = article.origin === 'web_search' ? ['웹 검색',host] : [...article.sources.map(source=>source.name),host];
  const sourceLine = [...new Set(sourceNames.filter(Boolean))].join(' · ');
  const formatTime = (value:string|null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '날짜 미확인';
  const published = article.published_at && Number.isFinite(Date.parse(article.published_at));
  const video = feedContentKind(article.url) === 'video';
  const hasSummary = !video && article.summary_status === 'ready' && Boolean(article.summary);
  const excerpt = feedExcerptView(video ? '' : feedStructuredIntroduction(hasSummary ? article.summary!.technology : (translated ? article.excerpt_ko : article.excerpt)));
  const classification = classifyFeedArticle(article);
  const tags = [...new Set([...(article.topics || []).filter(tag=>typeof tag==='string'&&tag.length<=32),...feedTopicTags(article.title,article.excerpt,(article.matched_topics || []).join(', '))])].slice(0,3);
  const sourceName = article.sources[0]?.name || host || '기술 소식';
  const expandable = excerpt.expandable || hasSummary;
  return <article className="feed-card">
    <header className="feed-author">
      <span className="feed-avatar" aria-hidden="true">{Array.from(sourceName.replace(/^www\./,'')).slice(0,2).join('').toUpperCase()}</span>
      <div className="feed-author-info"><strong>{sourceName}</strong><div className="feed-card-meta">{published ? <time dateTime={article.published_at!}>{article.origin==='web_search'?'검색 제공 날짜':'발행일'} {formatTime(article.published_at)}</time> : <span>날짜 미확인</span>}<time dateTime={article.discovered_at}>찾은 날짜 {formatTime(article.discovered_at)}</time>{classification.category && <span>{FEED_CATEGORIES[classification.category]}</span>}</div></div>
      {article.saved && <Bookmark className="feed-saved-mark" size={17} aria-label="저장한 글" fill="currentColor"/>}
    </header>
    <div className="feed-card-body">
      <div className="feed-topic-tags"><span className="feed-language-tag"># {FEED_LANGUAGE_LABELS[originalLanguage]}</span>{tags.map(tag=><span key={tag}># {tag}</span>)}</div>
      <h3>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{translated ? article.title_ko : article.title}</a> : (translated ? article.title_ko : article.title)}</h3>
      <FeedArticleMedia key={article.id+JSON.stringify(article.media)} media={article.media} title={(translated?article.title_ko:article.title)||article.title} original={link}/>
      <div id={contentId}>
        {expanded && hasSummary ? <dl className="feed-summary">
          <div><dt>어떤 기술인가요</dt><dd><FeedArticleText text={feedStructuredIntroduction(article.summary!.technology)}/></dd></div>
          <div><dt>핵심 변화</dt><dd><FeedArticleText text={feedStructuredIntroduction(article.summary!.change)}/></dd></div>
          <div><dt>이럴 때 살펴보세요</dt><dd><FeedArticleText text={feedStructuredIntroduction(article.summary!.usage)}/></dd></div>
        </dl> : expanded && excerpt.full ? <FeedArticleText text={excerpt.full}/> : <p className="feed-excerpt">{excerpt.preview || (video ? '영상 자료입니다. 시간표·출연자 목록은 소개에서 제외했어요. 내용은 원문에서 확인해 주세요.' : '충분한 글 소개가 없어 내용을 추측하지 않았어요. 원문에서 자세히 읽어 보세요.')}</p>}
      </div>
      {expandable && <button type="button" className="feed-expand" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpanded(value=>!value)}>{expanded?'내용 접기':hasSummary?'AI 요약 펼치기':'내용 더 보기'}<ChevronRight size={14}/></button>}
      {link && <div className="feed-citation"><span>{article.origin === 'web_search' ? '검색 소개 출처' : '발췌 출처'}</span><a href={link} target="_blank" rel="noopener noreferrer">{host || sourceName}<ExternalLink size={15}/></a></div>}
      <div className="feed-evidence"><p>{video ? '영상 원문 링크 · 본문 요약 없음' : summaryLabel(article)}</p><p>{translationNotice}</p></div>
      {translated && !video && <details className="feed-original-text"><summary>원문 텍스트 보기</summary><p>{article.title}</p><FeedArticleText text={feedStructuredIntroduction(article.excerpt)}/></details>}
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
  const [view,setView] = useState<'latest'|'deep_read'|'saved'>('latest');
  const [topic,setTopic] = useState('');
  const [language,setLanguage] = useState('');
  const [total,setTotal] = useState<number|null>(null);
  const [facets,setFacets] = useState<FeedFacets|null>(null);
  const [facetsLoading,setFacetsLoading] = useState(true);
  const [facetsError,setFacetsError] = useState('');
  const [facetsRevision,setFacetsRevision] = useState(0);
  const [briefingRevision,setBriefingRevision] = useState(0);
  const [source,setSource] = useState('');
  const [cursor,setCursor] = useState<string|null>(null);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const pageHeading = useRef<HTMLHeadingElement|null>(null);
  const bottomSentinel = useRef<HTMLDivElement|null>(null);
  const loadMoreLock = useRef(false);
  const loadMoreRequest = useRef(0);
  const [loadingMore,setLoadingMore] = useState(false);
  const [newAvailable,setNewAvailable] = useState(false);
  const continuousView = feedContinuousView(articles,cursor,view==='saved');
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
    setSettingsOpen(false);
    setNewAvailable(false);
    setView('latest');setTopic('');setLanguage('');setFacets(null);setTotal(null);
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
    ++loadMoreRequest.current;loadMoreLock.current=false;setLoadingMore(false);
    setLoading(true); setError(''); setCursor(null); setArticles([]);setTotal(null);setNewAvailable(false);
    void (async()=>{
      try {
        const next:FeedState = await api('state',{},controller.signal);
        if (request !== generation.current) return;
        setState(next);setStateOwner(userId);
        if(!next.preferences.prompt) setSettingsOpen(true);
        if (!interestDraftDirty.current) setInterestDraft(next.preferences.prompt);
        if (!next.enabled) return;
        const page:FeedPage = await api('list',{view,topic:topic || undefined,source_key:source || undefined,language:language || undefined},controller.signal);
        if (request !== generation.current) return;
        setArticles(page.items);setCursor(page.next_cursor);setTotal(page.total);
      } catch(e) {if(!controller.signal.aborted && request===generation.current)setError(e instanceof Error?e.message:'피드를 불러오지 못했어요.');}
      finally {if(!controller.signal.aborted && request===generation.current)setLoading(false);}
    })();
    return ()=>{controller.abort();++generation.current;};
  },[api,view,topic,source,language,revision]);

  useEffect(()=>{
    const controller=new AbortController();
    setFacets(null);setFacetsLoading(true);setFacetsError('');
    void api('facets',{view},controller.signal).then((next:FeedFacets)=>{if(!controller.signal.aborted)setFacets(next);}).catch(cause=>{if(!controller.signal.aborted)setFacetsError(cause instanceof Error?cause.message:'필터를 확인하지 못했어요.');}).finally(()=>{if(!controller.signal.aborted)setFacetsLoading(false);});
    return()=>controller.abort();
  },[api,view,revision,facetsRevision]);

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
    if(refresh.resetFeed)setRevision(value=>value+1);setBriefingRevision(value=>value+1);
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
        setRevision(value=>value+1);setBriefingRevision(value=>value+1);
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
        if(refresh.resetFeed)setRevision(value=>value+1);setBriefingRevision(value=>value+1);
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
        if(view==='latest'){
          if(articles.length)await checkForNewArticles();
          else setRevision(value=>value+1);
        }
        setBriefingRevision(value=>value+1);
      }catch(nextError){
        if(!isRevisionConflict(nextError))throw nextError;
        await latestPreferencesAfterConflict(request,state.preferences.prompt);
      }
    });
  }
  async function checkForNewArticles() {
    if(view!=='latest'||!articles.length)return;
    const request=generation.current;
    try{
      const head:FeedPage=await api('list',{view,topic:topic||undefined,source_key:source||undefined,language:language||undefined},lifetime.current?.signal);
      if(request===generation.current&&head.items.some(item=>!articles.some(loaded=>loaded.id===item.id)))setNewAvailable(true);
    }catch{/* Keep the current reading position; the explicit refresh reports errors. */}
  }
  async function loadMore() {
    if(loading || loadMoreLock.current || actionLock.current || !cursor)return;
    const request=generation.current;
    const token=++loadMoreRequest.current;
    loadMoreLock.current=true;setLoadingMore(true);
    try{
      const next:FeedPage=await api('list',{view,topic:topic||undefined,source_key:source||undefined,language:language||undefined,cursor},lifetime.current?.signal);
      if(request!==generation.current)return;
      setArticles(current=>mergeFeedPage(current,next.items));setCursor(next.next_cursor);setTotal(next.total);
    }catch(cause){if(request===generation.current)setError(cause instanceof Error?cause.message:'이어서 불러오지 못했어요.');}
    finally{if(token===loadMoreRequest.current){loadMoreLock.current=false;setLoadingMore(false);}}
  }
  useEffect(()=>{
    if(!cursor||loading||!bottomSentinel.current||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadMore();},{rootMargin:'480px'});
    observer.observe(bottomSentinel.current);
    return()=>observer.disconnect();
  },[cursor,loading,articles.length,view,topic,source,language]);
  useEffect(()=>{
    if(view!=='latest'||loading||!articles.length)return;
    const onFocus=()=>{if(document.visibilityState==='visible')void checkForNewArticles();};
    const timer=window.setInterval(onFocus,300000);
    window.addEventListener('focus',onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',onFocus);};
  },[view,loading,articles,topic,source,language]);
  function save(article:FeedArticle) {
    const request=settingsGeneration.current;
    void action(article.id,async()=>{
      await api('save',{article_id:article.id,saved:!article.saved},lifetime.current?.signal);
      if(request!==settingsGeneration.current)return;
      setArticles(current=>current.map(item=>item.id===article.id?{...item,saved:!article.saved}:item));
      setNotice(article.saved?'저장을 해제했어요.':'다른 기기에서도 볼 수 있도록 저장했어요.');
      setFacetsRevision(value=>value+1);if(view==='saved'&&article.saved)setTotal(value=>value===null?null:Math.max(0,value-1));
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
      <FeedDailyBriefing key={userId+':'+timeZone} api={api} userId={userId} timeZone={timeZone} revision={briefingRevision}/>
      <div className="feed-toolbar"><div className="feed-tabs" aria-label="피드 보기">{(['latest','deep_read','saved'] as const).map(tab=><button key={tab} type="button" aria-pressed={view===tab} disabled={Boolean(busy)} onClick={()=>setView(tab)}>{tab==='latest'?'최신':tab==='deep_read'?'깊이 읽기':'저장'}</button>)}</div><button className="secondary" type="button" disabled={loading||Boolean(busy)} aria-busy={busy==='refresh'} onClick={refreshNow}><RefreshCw size={16}/>{busy==='refresh'?'새 소식 찾는 중…':'새 글 확인'}</button></div>
      <FeedViewFilters facets={facets} topic={topic} source={source} language={language} total={total} busy={Boolean(busy)} loading={facetsLoading} error={facetsError} onTopic={setTopic} onSource={setSource} onLanguage={setLanguage} onReset={()=>{setTopic('');setSource('');setLanguage('');}} onRetry={()=>setFacetsRevision(value=>value+1)}/>
      <details className="feed-collection-status"><summary>수집·번역 상태와 출처 관리<ChevronRight size={15}/></summary>
      <details className="feed-subscriptions"><summary><Settings2 size={17}/>고급 설정: 수집 출처 <span>{state.sources.filter(item=>item.subscribed).length}개 구독</span></summary>
        <div className="feed-source-options">{state.sources.map(item=><label key={item.id}><input type="checkbox" checked={item.subscribed} disabled={Boolean(busy)||item.permission_status==='blocked'} onChange={()=>void action(item.id,async()=>{await api('subscribe',{source_id:item.id,subscribed:!item.subscribed},lifetime.current?.signal);setRevision(n=>n+1);setBriefingRevision(n=>n+1);})}/><span><strong>{item.name}</strong><small>{item.permission_status==='approved'?'공개 소스':item.permission_status==='pending'?'이용 조건 확인 중 · 자동 수집 대기':'수집 중지'}{item.last_error?' · 최근 수집 실패':''}</small></span></label>)}</div>
        <form className="feed-add-source" onSubmit={inspect}><label htmlFor="feed-url">공개 RSS·Atom 주소 추가</label><div><input id="feed-url" type="url" required placeholder="https://example.com/feed.xml" value={feedUrl} onChange={e=>{setFeedUrl(e.target.value);setPreview(null);}} disabled={Boolean(busy)}/><button className="secondary" disabled={Boolean(busy)}><Rss size={16}/>미리 보기</button></div><small>로그인이 필요 없는 주소만 지원해요. 최대 10개 · 이용 조건 확인 후 자동 수집됩니다.</small></form>
        {preview && <div className="feed-preview"><h3>{preview.name}</h3><ul>{preview.items.slice(0,3).map((item,i)=><li key={`${item.url}-${i}`}>{item.title}</li>)}</ul><button className="primary" type="button" disabled={Boolean(busy)} onClick={()=>void action('add',async()=>{await api('add_source',{url:preview.url},lifetime.current?.signal);setPreview(null);setFeedUrl('');setNotice('구독을 등록했어요. 이용 조건 확인 후 자동 수집이 시작됩니다.');setRevision(n=>n+1);setBriefingRevision(n=>n+1);})}><Plus size={16}/>이 소스 구독</button></div>}
      </details>
      <p className="feed-sync">{!state.service_available?'현재 새 소식 수집 중지':state.sources.filter(item=>item.subscribed&&item.permission_status==='approved').length>0?`승인된 RSS/API 출처 ${state.sources.filter(item=>item.subscribed&&item.permission_status==='approved').length}곳 설정됨`:'현재 수집 가능한 RSS/API 출처 없음'} · {state.last_success_at ? `마지막 RSS/API 성공 ${new Intl.DateTimeFormat('ko-KR',{timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(state.last_success_at))}` : 'RSS/API 성공 기록 없음'}{failures.length>0&&` · ${failures.length}개 소스 재시도 대기`}</p>
      <p className="feed-budget">{state.translation_service === 'not_configured' ? '한국어 번역 연결 준비 중 · 현재 원문으로 표시합니다.' : state.translation_service === 'quota_exhausted' ? '무료 번역 한도에 도달했어요. 기존 번역은 유지하고 새 번역은 대기합니다.' : state.translation_service === 'unavailable' ? '번역 연결을 확인하고 있어요. 원문을 먼저 읽어 주세요.' : state.translation_service === 'paused' ? '자동 번역이 일시 중지되어 있어요.' : '제목·소개는 무료 한도 내에서 순차적으로 한국어 번역해요. 번역과 AI 요약은 별도로 처리됩니다.'}</p>
      <p className="feed-budget">무료 AI 한도 내에서 요약해요. 요약이 없는 글도 출처 소개와 원문으로 읽을 수 있어요.</p>
      </details>
    </>}
    {state?.enabled && !loading && <div className="feed-page-heading"><h3 ref={pageHeading} tabIndex={-1}>{view==='saved'?'저장한 글':view==='deep_read'?'깊이 읽기':'최신 기술 소식'}</h3><p>{view==='latest'?'최근 30일 이내 원문 날짜가 확인된 글이에요.':'차례대로 아래로 읽어 보세요.'}</p></div>}
    {newAvailable && view==='latest' && !loading && <button type="button" className="feed-new-banner" onClick={()=>{setNewAvailable(false);setRevision(value=>value+1);pageHeading.current?.scrollIntoView({block:'start'});}}>새 글이 도착했어요 · 위에서 보기</button>}
    {loading ? <p className="feed-empty" role="status">새로운 배움을 불러오고 있어요…</p> : state?.enabled && continuousView.items.length===0 && !cursor && !error ? <div className="feed-empty"><BookOpen size={32}/><h3>{view==='saved'?'나중에 읽을 글을 모아 보세요':view==='deep_read'?'이전 자료가 아직 없어요':language==='ko'?'한국어 원문이 아직 없어요':language==='en'?'영어 원문이 아직 없어요':'최근 글이 아직 없어요'}</h3><p>{view==='saved'?'관심 있는 글의 저장 버튼을 눌러 주세요.':view==='latest'?'새 글 확인으로 다시 찾아보거나 깊이 읽기에서 이전 자료를 살펴보세요.':'다른 필터를 선택해 주세요.'}</p></div> : <div className="feed-list" aria-busy={loadingMore}>{(state?.enabled?continuousView.items:[]).map(article=><FeedArticleCard key={article.id} article={article} timeZone={timeZone} translationService={state?.translation_service} busy={Boolean(busy)} onSave={()=>save(article)} onPlan={()=>onPlan(article)}/>)}</div>}
    {state?.enabled && cursor && !loading && <div className="feed-more" ref={bottomSentinel}><button className="secondary" type="button" disabled={loadingMore||Boolean(busy)} onClick={()=>void loadMore()}>{loadingMore?'이전 글 불러오는 중…':'이전 글 더 보기'}</button></div>}
    </>}
  </section>;
}
