export const FEED_INTERESTS = [
  ['ai', 'AI'], ['frontend', '웹·프론트엔드'], ['backend', '백엔드'], ['cloud', '클라우드·인프라'], ['tools', '개발 도구'],
];
export const FEED_CATEGORIES = { news: '새 소식', practice: '실무 활용', deep_dive: '깊이 읽기' };

export function safeFeedUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function mergeFeedPage(current, incoming) {
  const seen = new Set(current.map(item => item.id));
  return [...current, ...incoming.filter(item => !seen.has(item.id) && seen.add(item.id))];
}
export function summaryLabel(article) {
  if (article.summary_status === 'ready' && article.summary) return 'AI 요약 · 원문 확인 권장';
  if (article.summary_status === 'pending') return 'AI 요약 대기 · 출처 소개';
  if (article.summary_status === 'failed') return '요약을 준비하지 못했어요 · 출처 소개';
  return '출처 소개';
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
    if (response.error || !response.data || typeof response.data !== 'object') {
      throw new Error('기술 피드에 연결하지 못했어요. 설정 또는 연결 상태를 확인해 주세요.');
    }
    if (response.data.error) throw new Error('요청을 처리하지 못했어요. 입력과 구독 상태를 확인해 주세요.');
    return response.data;
  };
}
