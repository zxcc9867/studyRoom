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
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
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
