function refreshWait(ms,signal){
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();
  const cancel=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
export async function refreshFeedNow(api,expectedRevision,{signal,wait=refreshWait,maxPolls=20}={}){
 const bounded=AbortSignal.any([AbortSignal.timeout(65000),...(signal?[signal]:[])]);
 bounded.throwIfAborted();
 const result=await api('refresh',{expected_revision:expectedRevision},bounded);
 bounded.throwIfAborted();
 if(result.state!=='running')return result;
 for(let i=0;i<maxPolls;i++){
  await wait(2000,bounded);bounded.throwIfAborted();
  const status=await api('refresh_status',{},bounded);bounded.throwIfAborted();
  if(status.state!=='running')return{state:['quota_exhausted','unavailable'].includes(status.search?.state)?'unavailable':'shared',search:status.search};
 }
 return{state:'running'};
}
export function manualRefreshMessage(result){
 if(result.state==='paused')return '현재 소식 수집이 중지되어 있어요. 수신 설정 또는 서비스 준비 상태를 확인해 주세요.';
 if(result.state==='not_configured')return '웹 검색이 아직 연결되지 않았어요. 운영용 검색 연결 준비가 필요하며, 개인 API 키는 필요하지 않아요.';
 if(result.state==='no_sources')return '관심 소식 수신을 시작하거나 수집 가능한 출처를 구독해 주세요.';
 if(result.state==='running')return '같은 소식을 이미 찾고 있어요. 잠시 후 새 글 확인을 눌러 진행 결과를 확인해 주세요.';
 if(result.state==='shared')return '진행 중인 공유 수집이 없어 최신 목록과 수집 상태를 다시 불러왔어요.';
 if(result.search?.state==='quota_exhausted')return `웹 검색 무료 한도를 모두 사용했어요. ${result.rss?.collected?'가능한 RSS 출처는 확인했어요.':'저장된 소식은 계속 볼 수 있어요.'} 유료 검색으로 전환하지 않아요.`;
 if(result.state==='cooldown')return `최근 확인한 소식이에요. 최대 ${Math.max(1,Math.ceil((result.retry_after||300)/60))}분 뒤 다시 수집할 수 있어요. 기존 목록을 새로 불러왔어요.`;
 if(result.state==='unavailable')return '새 소식을 확인하지 못했어요. 연결 상태나 재시도 대기 시간을 확인해 주세요. 기존 소식은 유지됩니다.';
 if(result.state==='partial')return '일부 출처를 확인하지 못했어요. 확인한 소식은 목록에 반영했고 나머지는 재시도 대기 중이에요.';
 return `최신 소식 확인을 마쳤어요. 새 글이 있으면 목록에 반영했어요.${result.search?.state==='not_configured'?' RSS 출처만 확인했으며 웹 검색은 아직 미연결 상태예요.':''}`;
}

export const FEED_INTERESTS = [
  ['ai', 'AI'], ['frontend', '웹·프론트엔드'], ['backend', '백엔드'], ['cloud', '클라우드·인프라'], ['tools', '개발 도구'],
];
export const FEED_CATEGORIES = { news: '새 소식', practice: '실무 활용', deep_dive: '깊이 읽기' };

const PRIVATE_TOPIC_PATTERN = /@|(?:https?|ftp):|www\.|\bAKIA[A-Z0-9]{16}\b|\b[a-z0-9-]+\.[a-z]{2,63}\/|\b[a-z0-9-]+\.(?:com|org|net|io|dev|ai|co|kr|uk)(?:\b|\/)|(?:sk|tvly|ghp|github_pat|AKIA)[-_][a-z0-9_-]{12,}|\bBearer\s|[a-zA-Z0-9_-]{40,}/i;

export function interestPromptResult(value) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) {
    return {prompt:'',error:'공개 기술 관심사만 입력해 주세요. 개인정보나 비밀 정보는 포함할 수 없어요.'};
  }
  const prompt=value.normalize('NFKC').replace(/\s+/gu,' ').trim();
  if ([...prompt].length < 3) return {prompt,error:'관심 내용은 3자 이상 입력해 주세요.'};
  if ([...prompt].length > 300) return {prompt,error:'관심 내용은 300자 이하로 입력해 주세요.'};
  if (PRIVATE_TOPIC_PATTERN.test(prompt)) {
    return {prompt,error:'공개 기술 관심사만 입력해 주세요. URL, 이메일, 개인정보나 비밀 정보는 포함할 수 없어요.'};
  }
  return {prompt,error:null};
}

export function searchStatusLabel(status) {
  return ({
    not_configured:'웹 검색이 아직 연결되지 않았어요',
    paused:'웹 검색 수집을 쉬고 있어요',
    waiting:'첫 웹 검색 결과를 기다리고 있어요',
    ready:'웹 검색 결과를 최근에 확인했어요',
    quota_exhausted:'웹 검색 무료 한도를 모두 사용했어요',
    unavailable:'웹 검색 연결이 잠시 불안정해요',
  })[status?.state] || '웹 검색 상태를 확인하고 있어요';
}

export function interestSavePayload(preferences,value) {
  const result=interestPromptResult(value);
  if (result.error) throw new Error(result.error);
  return {prompt:result.prompt,receiving:true,expected_revision:preferences.revision};
}

export function receivingPayload(preferences,receiving) {
  return {receiving:Boolean(receiving),expected_revision:preferences.revision};
}

export function applyPreferenceResponse(state,response) {
  return {...state,preferences:response.preferences,search_status:response.search_status};
}

export class TechFeedRevisionConflictError extends Error {
  constructor() {
    super('다른 곳에서 설정이 변경되었어요. 최신 상태를 확인하고 다시 저장해 주세요.');
    this.name='TechFeedRevisionConflictError';
    this.code='revision_conflict';
  }
}
export function isRevisionConflict(error) {
  return error instanceof TechFeedRevisionConflictError || error?.code === 'revision_conflict';
}

export function isCurrentFeedRequest(request,current,signal) {
  return request === current && !signal?.aborted;
}
export function preferenceRefreshResult(previousPrompt,state,articles,cursor) {
  const resetFeed=previousPrompt !== state.preferences.prompt;
  return {
    state,
    resetFeed,
    articles:resetFeed?[]:articles,
    cursor:resetFeed?null:cursor,
  };
}

export function currentFeedState(state,stateUserId,currentUserId) {
  return state && stateUserId === currentUserId ? state : null;
}


export function safeFeedUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function feedSourceHost(value) {
  const safe=safeFeedUrl(value);
  if (!safe) return '';
  try { return new URL(safe).hostname.replace(/^www\./,''); }
  catch { return ''; }
}
export function mergeFeedPage(current, incoming) {
  const seen = new Set(current.map(item => item.id));
  return [...current, ...incoming.filter(item => !seen.has(item.id) && seen.add(item.id))];
}
export function summaryLabel(article) {
  if (article.summary_status === 'ready' && article.summary) return 'AI 요약 · 원문 확인 권장';
  const evidence=article.excerpt_provenance === 'search_snippet' ? '검색 결과 소개' : '출처 소개';
  if (article.summary_status === 'pending') return `AI 요약 대기 · ${evidence}`;
  if (article.summary_status === 'failed') return `요약을 준비하지 못했어요 · ${evidence}`;
  return evidence;
}
export function feedTodoDraft(article, date) {
  return { article_id: article.id, title: `${article.title} 읽고 정리하기`.slice(0, 180), local_date: date, start_time: null, end_time: null };
}
export function createTechFeedClient(supabase, userId) {
  return async (action, payload = {}, signal) => {
    const verify = async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase.auth.getSession();
      if (error || data?.session?.user.id !== userId) throw new Error('로그인 상태가 변경되었어요. 다시 열어 주세요.');
      return data.session;
    };
    const verifiedSession = await verify();
    let response;
    try {
      response = await supabase.functions.invoke('tech-feed', {
        body: { ...payload, action },
        headers: { Authorization: `Bearer ${verifiedSession.access_token}` },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(action==='refresh'?60000:20000)]) : AbortSignal.timeout(action==='refresh'?60000:20000),
      });
    } catch {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new Error('기술 피드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    await verify();
    const status=Number(response.error?.context?.status ?? response.error?.context?.response?.status);
    if (status === 409 || response.data?.error === 'revision_conflict') {
      throw new TechFeedRevisionConflictError();
    }
    if (response.error || !response.data || typeof response.data !== 'object') {
      throw new Error('기술 피드에 연결하지 못했어요. 설정 또는 연결 상태를 확인해 주세요.');
    }
    if (response.data.error) throw new Error('요청을 처리하지 못했어요. 입력 내용을 확인해 주세요.');
    return response.data;
  };
}
